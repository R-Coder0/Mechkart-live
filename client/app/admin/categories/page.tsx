/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo,useRef, useState, FormEvent } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

// resolve stored path -> full URL (works if backend serves /uploads as static)
const resolveImageUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const apiBase = API_BASE || "";
  // if API_BASE is like https://domain.com/api, remove /api
  const host = apiBase.replace(/\/api\/?$/, "");
  if (path.startsWith("/")) return `${host}${path}`;
  return `${host}/${path}`;
};

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string; // ✅ added
  parentCategory?: Category | string | null;
}

export default function AdminCategoriesPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<string>("");
const formTopRef = useRef<HTMLDivElement | null>(null);

  // ✅ category image states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [existingImage, setExistingImage] = useState<string>(""); // for edit mode

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // edit mode
  const [editingId, setEditingId] = useState<string | null>(null);

  // search
  const [searchTerm, setSearchTerm] = useState("");

  // ----- helpers -----
  const handleNameChange = (value: string) => {
    setName(value);
    const generated = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    setSlug(generated);
  };

  const getToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("admin_token");
  };

  // ✅ image change handler
  const handleImageChange = (file?: File | null) => {
    if (!file) {
      setImageFile(null);
      setImagePreview(existingImage ? resolveImageUrl(existingImage) : "");
      return;
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  // cleanup blob url
  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  // ----- load categories -----
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true);
        setError(null);

        const token = getToken();

        const res = await fetch(`${API_BASE}/admin/categories`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
        });

        const data = await res.json();
        if (!res.ok)
          throw new Error(data?.message || "Failed to load categories");

        setCategories(data.data || data.categories || []);
      } catch (err: any) {
        setError(err.message || "Error loading categories");
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  // ---------- DERIVED LISTS ----------
  const mainCategories = useMemo(
    () => categories.filter((c) => !c.parentCategory),
    [categories]
  );

  const subCategories = useMemo(
    () => categories.filter((c) => Boolean(c.parentCategory)),
    [categories]
  );

  // Parent dropdown (only main categories)
  const parentOnlyCategories = mainCategories;

  // Search filters
  const q = searchTerm.trim().toLowerCase();

  const filteredMain = mainCategories.filter(
    (c) =>
      (c.name || "").toLowerCase().includes(q) ||
      (c.slug || "").toLowerCase().includes(q)
  );

  const filteredSub = subCategories.filter(
    (c) =>
      (c.name || "").toLowerCase().includes(q) ||
      (c.slug || "").toLowerCase().includes(q)
  );

  // group filtered subcategories by parentId
  const filteredSubByParent = filteredSub.reduce(
    (acc: Record<string, Category[]>, sub) => {
      const pid =
        typeof sub.parentCategory === "string"
          ? sub.parentCategory
          : (sub.parentCategory as any)?._id;

      if (!pid) return acc;
      if (!acc[pid]) acc[pid] = [];
      acc[pid].push(sub);
      return acc;
    },
    {}
  );

  const filteredParentsForSubs = mainCategories.filter(
    (p) => (filteredSubByParent[p._id] || []).length > 0
  );

  // ----- submit (create / update) -----
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const token = getToken();
      if (!token) {
        setError("Admin token not found. Please login again.");
        setSubmitting(false);
        return;
      }

      const isEdit = Boolean(editingId);
      const url = isEdit
        ? `${API_BASE}/admin/categories/${editingId}`
        : `${API_BASE}/admin/categories`;
      const method = isEdit ? "PUT" : "POST";

      // ✅ multipart/form-data because image upload
      const fd = new FormData();
      fd.append("name", name);
      fd.append("slug", slug); // backend may ignore, safe
      fd.append("description", description || "");
      fd.append("parentCategory", parentId ? parentId : "");

      if (imageFile) {
        fd.append("image", imageFile); // field name must be "image"
      }

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          // DO NOT set Content-Type manually for FormData
        },
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save category");

      if (isEdit) {
        setMessage("Category updated successfully.");
        const updated: Category = data.data;

        // attach parent object locally if backend returns string
        if (typeof updated.parentCategory === "string" && updated.parentCategory) {
          const parent = categories.find((c) => c._id === updated.parentCategory);
          if (parent) updated.parentCategory = parent;
        }

        setCategories((prev) =>
          prev.map((c) => (c._id === updated._id ? updated : c))
        );
      } else {
        setMessage("Category created successfully.");
        if (data.data) {
          const newCat: Category = data.data;

          if (typeof newCat.parentCategory === "string" && newCat.parentCategory) {
            const parent = categories.find((c) => c._id === newCat.parentCategory);
            if (parent) newCat.parentCategory = parent;
          }

          setCategories((prev) => [newCat, ...prev]);
        }
      }

      // reset form
      setName("");
      setSlug("");
      setDescription("");
      setParentId("");
      setEditingId(null);

      // ✅ reset image
      setImageFile(null);
      setExistingImage("");
      setImagePreview("");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  // ----- delete -----
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;

    try {
      setError(null);
      setMessage(null);

      const token = getToken();
      if (!token) {
        setError("Admin token not found. Please login again.");
        return;
      }

      const res = await fetch(`${API_BASE}/admin/categories/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to delete category");

      setCategories((prev) => prev.filter((c) => c._id !== id));
      setMessage("Category deleted successfully.");

      // if deleting current edit item
      if (editingId === id) {
        resetForm();
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong while deleting");
    }
  };

  // ----- edit click -----
  const handleEditClick = (cat: Category) => {
    setEditingId(cat._id);
    setName(cat.name);
    setSlug(cat.slug || "");
    setDescription(cat.description || "");

    if (
      cat.parentCategory &&
      typeof cat.parentCategory === "object" &&
      (cat.parentCategory as any)._id
    ) {
      setParentId((cat.parentCategory as any)._id);
    } else if (typeof cat.parentCategory === "string") {
      setParentId(cat.parentCategory);
    } else {
      setParentId("");
    }

    // ✅ set existing image + preview
    const img = cat.image || "";
    setExistingImage(img);
    setImageFile(null);
    setImagePreview(img ? resolveImageUrl(img) : "");

    setMessage(null);
    setError(null);
      // ✅ Auto scroll to form
  setTimeout(() => {
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
  };

  const isEditMode = Boolean(editingId);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setSlug("");
    setDescription("");
    setParentId("");

    // ✅ reset image
    setImageFile(null);
    setExistingImage("");
    setImagePreview("");
  };

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto py-6 px-4 lg:px-0">
        {/* Page Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">
              {isEditMode ? "Edit Category" : "Create Category"}
            </h1>
            <p className="text-sm text-gray-500">
              Add main categories or subcategories for your store.
            </p>
          </div>

          {isEditMode && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs border border-gray-300 px-3 py-2 hover:bg-gray-50 w-fit"
            >
              Cancel Edit
            </button>
          )}
        </div>

        {/* Messages */}
        {message && (
          <div className="mb-4 rounded border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Form Card */}
        <div ref={formTopRef} />
        <div className="bg-white border border-gray-200 shadow-sm p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Category Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Electronics"
                className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                required
              />
            </div>

            {/* Slug */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="electronics"
                className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                required
              />
              <p className="text-xs text-gray-400">
                This will be used in URLs. You can edit it if needed.
              </p>
            </div>

            {/* Parent Category (ONLY MAIN CATEGORIES) */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Parent Category (optional)
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white"
              >
                <option value="">Main Category (No parent)</option>
                {loadingCategories ? (
                  <option disabled>Loading...</option>
                ) : (
                  parentOnlyCategories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))
                )}
              </select>
              <p className="text-xs text-gray-400">
                Select a parent to create a subcategory. Leave empty for a main
                category.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 resize-none"
                placeholder="Short description about this category"
              />
            </div>

            {/* ✅ Category Image */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Category Image (optional)
              </label>

              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageChange(e.target.files?.[0])}
                className="w-full border border-gray-300 px-3 py-2 text-sm bg-white"
              />

              {imagePreview ? (
                <div className="pt-2">
                  <img
                    src={imagePreview}
                    alt="Category preview"
                    className="h-20 w-20 object-cover border border-gray-200"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Preview shown above. If you don’t select a new file in edit
                    mode, old image stays.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-400">
                  Upload one image for category cards and navigation.
                </p>
              )}
            </div>

            {/* Submit */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center px-4 py-2 text-sm font-medium border border-sky-600 bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60"
              >
                {submitting
                  ? isEditMode
                    ? "Updating..."
                    : "Saving..."
                  : isEditMode
                  ? "Update Category"
                  : "Create Category"}
              </button>

              {isEditMode && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                >
                  Reset
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Separated Lists */}
        <div className="mt-8 space-y-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-gray-800">
              Existing Categories
            </h2>

            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search category / subcategory..."
              className="w-full sm:max-w-sm border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>

          {/* MAIN CATEGORIES TABLE */}
          <div className="bg-white border border-gray-200 shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                Main Categories
              </h3>
              <span className="text-xs text-gray-500">
                Total:{" "}
                <span className="font-semibold">{filteredMain.length}</span>
              </span>
            </div>

            {filteredMain.length === 0 && !loadingCategories ? (
              <div className="px-4 py-4 text-sm text-gray-500">
                No main categories found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Name
                      </th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Slug
                      </th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Image
                      </th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loadingCategories && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-4 text-sm text-gray-500"
                        >
                          Loading...
                        </td>
                      </tr>
                    )}

                    {!loadingCategories &&
                      filteredMain.map((cat) => (
                        <tr key={cat._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {cat.name}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{cat.slug}</td>
                          <td className="px-4 py-3">
                            {cat.image ? (
                              <img
                                src={resolveImageUrl(cat.image)}
                                alt={cat.name}
                                className="h-10 w-10 object-cover border border-gray-200"
                              />
                            ) : (
                              <span className="text-xs text-gray-400">
                                No image
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditClick(cat)}
                                className="text-xs px-2 py-1 border border-gray-300 hover:bg-gray-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(cat._id)}
                                className="text-xs px-2 py-1 border border-red-400 text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SUBCATEGORIES GROUPED BY PARENT */}
          <div className="bg-white border border-gray-200 shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                Sub Categories (Grouped by Parent)
              </h3>
              <span className="text-xs text-gray-500">
                Total:{" "}
                <span className="font-semibold">{filteredSub.length}</span>
              </span>
            </div>

            {Object.keys(filteredSubByParent).length === 0 &&
            !loadingCategories ? (
              <div className="px-4 py-4 text-sm text-gray-500">
                No sub categories found.
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {loadingCategories && (
                  <div className="text-sm text-gray-500">Loading...</div>
                )}

                {!loadingCategories &&
                  filteredParentsForSubs.map((parent) => {
                    const subs = filteredSubByParent[parent._id] || [];
                    if (subs.length === 0) return null;

                    return (
                      <div
                        key={parent._id}
                        className="border border-gray-200 rounded-md overflow-hidden"
                      >
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                          <div className="text-sm font-semibold text-gray-800">
                            {parent.name}
                            <span className="ml-2 text-xs font-medium text-gray-500">
                              ({subs.length})
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">{parent.slug}</div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b border-gray-200 bg-white">
                              <tr>
                                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                  Sub Category
                                </th>
                                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                  Slug
                                </th>
                                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                  Image
                                </th>
                                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {subs.map((sub) => (
                                <tr key={sub._id} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 font-medium text-gray-800">
                                    {sub.name}
                                  </td>
                                  <td className="px-3 py-2 text-gray-500">
                                    {sub.slug}
                                  </td>
                                  <td className="px-3 py-2">
                                    {sub.image ? (
                                      <img
                                        src={resolveImageUrl(sub.image)}
                                        alt={sub.name}
                                        className="h-10 w-10 object-cover border border-gray-200"
                                      />
                                    ) : (
                                      <span className="text-xs text-gray-400">
                                        No image
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleEditClick(sub)}
                                        className="text-xs px-2 py-1 border border-gray-300 hover:bg-gray-50"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDelete(sub._id)}
                                        className="text-xs px-2 py-1 border border-red-400 text-red-600 hover:bg-red-50"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
