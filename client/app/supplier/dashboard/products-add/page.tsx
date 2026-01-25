/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import type React from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

// ---- Types ----
interface Category {
  _id: string;
  name: string;
  slug: string;
  parentCategory?: Category | string | null;

}

interface VariantInput {
  label: string;
  size: string;
  weight: string;
  // color: string;
  comboText: string;
  mrp: string;
  salePrice: string;
  quantity: string;
}
interface ColorInput {
  name: string;
  hex: string;
  orderIndex: string;
}
export default function AdminProductsPage() {
  // basic fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  // const [features, setFeatures] = useState("");
  const [featuresText, setFeaturesText] = useState("");

  const [baseMrp, setBaseMrp] = useState("");
  const [baseSalePrice, setBaseSalePrice] = useState("");
  const [baseStock, setBaseStock] = useState("");              // NEW
  const [lowStockThreshold, setLowStockThreshold] = useState("5"); // NEW (default 5)


  // IMAGES (FILE UPLOAD)
  const [featureImageFile, setFeatureImageFile] = useState<File | null>(null);
  const [featureImagePreview, setFeatureImagePreview] = useState<string>("");

  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);

  // category selection
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [parentCategoryId, setParentCategoryId] = useState<string>("");
  const [subCategoryId, setSubCategoryId] = useState<string>("");
  // Shipping (admin/vendor only)
  const [shipLengthCm, setShipLengthCm] = useState("20");
  const [shipBreadthCm, setShipBreadthCm] = useState("15");
  const [shipHeightCm, setShipHeightCm] = useState("10");
  const [shipWeightKg, setShipWeightKg] = useState("0.5");

  // variations
  const [variants, setVariants] = useState<VariantInput[]>([
    {
      label: "",
      size: "",
      weight: "",
      // color: "",
      comboText: "",
      mrp: "",
      salePrice: "",
      quantity: "",
    },
  ]);

  // variant images (per-row)
  const [variantImages, setVariantImages] = useState<Record<number, File[]>>({});
  const [variantImagePreviews, setVariantImagePreviews] = useState<
    Record<number, string[]>
  >({});
  // Color
  const [colors, setColors] = useState<ColorInput[]>([
    { name: "", hex: "", orderIndex: "0" },
  ]);
  // color images (per-color row)
  const [colorImages, setColorImages] = useState<Record<number, File[]>>({});
  const [colorImagePreviews, setColorImagePreviews] = useState<Record<number, string[]>>({});

  // ui states
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- helpers ----

  const getVendorToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("vendor_token");
  };


  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slug) {
      const generated = value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
      setSlug(generated);
    }
  };

  // categories grouped (parent + children)
  const parents = useMemo(
    () => categories.filter((c) => !c.parentCategory),
    [categories],
  );

  const childrenMap = useMemo(() => {
    const map: Record<string, Category[]> = {};
    categories.forEach((cat) => {
      if (!cat.parentCategory) return;

      const parentId =
        typeof cat.parentCategory === "string"
          ? cat.parentCategory
          : (cat.parentCategory as Category)._id;

      if (!parentId) return;
      if (!map[parentId]) map[parentId] = [];
      map[parentId].push(cat);
    });
    return map;
  }, [categories]);

  const availableSubcategories = useMemo(
    () => (parentCategoryId ? childrenMap[parentCategoryId] || [] : []),
    [childrenMap, parentCategoryId],
  );

  // ---- load categories once ----
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true);

        const res = await fetch(`${API_BASE}/admin/categories`, {
          method: "GET",
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.message || "Failed to load categories");
        }

        setCategories(data.data || data.categories || []);
      } catch (err: any) {
        console.error("Category load error:", err);
        setError(err.message || "Error loading categories");
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  // ---- variant handlers ----
  const handleVariantChange = (
    index: number,
    field: keyof VariantInput,
    value: string,
  ) => {
    setVariants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const addVariantRow = () => {
    setVariants((prev) => [
      ...prev,
      {
        label: "",
        size: "",
        weight: "",
        // color: "",
        comboText: "",
        mrp: "",
        salePrice: "",
        quantity: "",
      },
    ]);
  };

  const removeVariantRow = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));

    // shift variantImages map
    setVariantImages((prev) => {
      const next: Record<number, File[]> = {};
      Object.entries(prev).forEach(([key, files]) => {
        const idx = Number(key);
        if (idx < index) next[idx] = files;
        else if (idx > index) next[idx - 1] = files;
      });
      return next;
    });

    // shift previews map
    setVariantImagePreviews((prev) => {
      const next: Record<number, string[]> = {};
      Object.entries(prev).forEach(([key, previews]) => {
        const idx = Number(key);
        if (idx < index) next[idx] = previews;
        else if (idx > index) next[idx - 1] = previews;
      });
      return next;
    });
  };

  const handleVariantImageUpload = (index: number, files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    const previews = fileArray.map((f) => URL.createObjectURL(f));

    setVariantImages((prev) => ({
      ...prev,
      [index]: [...(prev[index] || []), ...fileArray],
    }));

    setVariantImagePreviews((prev) => ({
      ...prev,
      [index]: [...(prev[index] || []), ...previews],
    }));
  };

  const removeVariantImage = (variantIndex: number, imgIndex: number) => {
    setVariantImages((prev) => ({
      ...prev,
      [variantIndex]: (prev[variantIndex] || []).filter(
        (_, i) => i !== imgIndex,
      ),
    }));
    setVariantImagePreviews((prev) => ({
      ...prev,
      [variantIndex]: (prev[variantIndex] || []).filter(
        (_, i) => i !== imgIndex,
      ),
    }));
  };

  // COlor handlers
  // ---- color handlers ----
  const handleColorChange = (
    index: number,
    field: keyof ColorInput,
    value: string
  ) => {
    setColors((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const addColorRow = () => {
    setColors((prev) => [
      ...prev,
      { name: "", hex: "", orderIndex: String(prev.length) },
    ]);
  };

  const removeColorRow = (index: number) => {
    setColors((prev) => prev.filter((_, i) => i !== index));

    // shift colorImages map
    setColorImages((prev) => {
      const next: Record<number, File[]> = {};
      Object.entries(prev).forEach(([key, files]) => {
        const idx = Number(key);
        if (idx < index) next[idx] = files;
        else if (idx > index) next[idx - 1] = files;
      });
      return next;
    });

    // shift previews map
    setColorImagePreviews((prev) => {
      const next: Record<number, string[]> = {};
      Object.entries(prev).forEach(([key, previews]) => {
        const idx = Number(key);
        if (idx < index) next[idx] = previews;
        else if (idx > index) next[idx - 1] = previews;
      });
      return next;
    });
  };

  const handleColorImageUpload = (index: number, files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    const previews = fileArray.map((f) => URL.createObjectURL(f));

    setColorImages((prev) => ({
      ...prev,
      [index]: [...(prev[index] || []), ...fileArray],
    }));

    setColorImagePreviews((prev) => ({
      ...prev,
      [index]: [...(prev[index] || []), ...previews],
    }));
  };

  const removeColorImage = (colorIndex: number, imgIndex: number) => {
    setColorImages((prev) => ({
      ...prev,
      [colorIndex]: (prev[colorIndex] || []).filter((_, i) => i !== imgIndex),
    }));
    setColorImagePreviews((prev) => ({
      ...prev,
      [colorIndex]: (prev[colorIndex] || []).filter((_, i) => i !== imgIndex),
    }));
  };

  // ---- IMAGE handlers ----

  const handleFeatureImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeatureImageFile(file);
    const url = URL.createObjectURL(file);
    setFeatureImagePreview(url);
  };

  const clearFeatureImage = () => {
    setFeatureImageFile(null);
    setFeatureImagePreview("");
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setGalleryFiles((prev) => [...prev, ...files]);
    const previews = files.map((f) => URL.createObjectURL(f));
    setGalleryPreviews((prev) => [...prev, ...previews]);
  };

  const removeGalleryImage = (index: number) => {
    setGalleryFiles((prev) => prev.filter((_, i) => i !== index));
    setGalleryPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // ---- submit handler ----
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    if (!title.trim()) {
      setError("Product title is required");
      setSubmitting(false);
      return;
    }

    if (!parentCategoryId) {
      setError("Please select a category");
      setSubmitting(false);
      return;
    }

    if (!baseMrp || !baseSalePrice) {
      setError("Base MRP and Base Sale Price are required");
      setSubmitting(false);
      return;
    }

    try {
      const token = getVendorToken();
      if (!token) {
        setError("Vendors token not found. Please login again.");
        setSubmitting(false);
        return;
      }

      type CleanVariant = {
        label?: string;
        size?: string;
        weight?: string;
        color?: string;
        comboText?: string;
        mrp: number;
        salePrice: number;
        quantity: number;
      };

      const cleanText = (s: string) => s.trim();

      const cleanVariants: CleanVariant[] = variants
        .filter((v) => {
          const hasIdentity = !!(v.label || v.size || v.weight || v.comboText);
          const hasPriceOrStock =
            v.mrp.trim() !== "" || v.salePrice.trim() !== "" || v.quantity.trim() !== "";
          return hasIdentity && hasPriceOrStock;
        })
        .map((v) => ({
          label: v.label ? cleanText(v.label) : undefined,
          size: v.size ? cleanText(v.size) : undefined,
          weight: v.weight ? cleanText(v.weight) : undefined,
          // color: v.color ? cleanText(v.color) : undefined,
          comboText: v.comboText ? cleanText(v.comboText) : undefined,
          mrp: Number(v.mrp || 0),
          salePrice: Number(v.salePrice || 0),
          quantity: Number(v.quantity || 0),
        }));

      const hasAnyVariant = cleanVariants.length > 0;


      if (!hasAnyVariant && baseStock.trim() === "") {
        setError("Base stock is required when no variants are added");
        setSubmitting(false);
        return;
      }
      // description me featuresText ko bhi append kar dete hain
      type CleanColor = {
        name: string;
        hex?: string;
        orderIndex: number;
        images?: string[]; // keep for update page; create page can send empty
      };

      const cleanColors: CleanColor[] = colors
        .map((c, idx) => ({
          name: (c.name || "").trim(),
          hex: (c.hex || "").trim(),
          orderIndex: Number(c.orderIndex ?? idx),
        }))
        .filter((c) => c.name); // only keep named colors

      // ✅ ensure default color exists if colors section used
      // not required, but safe: if user leaves empty -> it won't send


      // ---- FormData (multipart/form-data) ----
      const formData = new FormData();
      formData.append("title", title);
      formData.append("slug", slug);
      formData.append("description", description.trim());
      formData.append("features", featuresText.trim()); // ✅ NEW

      formData.append("mrp", baseMrp);
      formData.append("salePrice", baseSalePrice);
formData.append(
  "ship",
  JSON.stringify({
    lengthCm: Number(shipLengthCm || 20),
    breadthCm: Number(shipBreadthCm || 15),
    heightCm: Number(shipHeightCm || 10),
    weightKg: Number(shipWeightKg || 0.5),
  })
);

      formData.append("categoryId", parentCategoryId);
      formData.append("lowStockThreshold", lowStockThreshold || "5"); // NEW
      if (subCategoryId) {
        formData.append("subCategoryId", subCategoryId);
      }
      // formData.append("isActive", "true");

      // variants as JSON string (backend normalizeVariants handle karega)
      if (cleanVariants.length > 0) {
        formData.append("variants", JSON.stringify(cleanVariants));
      }
      // color append
      if (cleanColors.length > 0) {
        formData.append("colors", JSON.stringify(cleanColors));
      }


      // Feature image file
      if (featureImageFile) {
        formData.append("featureImage", featureImageFile);
      }
      // send baseStock only if no variants
      if (cleanVariants.length === 0) {
        formData.append("baseStock", baseStock || "0"); // NEW
      }
      // Gallery images
      galleryFiles.forEach((file) => {
        formData.append("galleryImages", file);
      });

      // Variant images (per variant index)
      Object.keys(variantImages).forEach((variantIndex) => {
        variantImages[Number(variantIndex)].forEach((file) => {
          formData.append(`variantImages[${variantIndex}]`, file);
        });
      });
      Object.keys(colorImages).forEach((colorIndex) => {
        colorImages[Number(colorIndex)].forEach((file) => {
          formData.append(`colorImages[${colorIndex}]`, file);
        });
      });

      const res = await fetch(`${API_BASE}/vendors/products`, {
        method: "POST",
        headers: {
          // IMPORTANT: Content-Type mat set karo, browser khud boundary set karega
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Failed to create product");
      }

      setMessage("Product created successfully.");

      // reset form
      setTitle("");
      setSlug("");
      setDescription("");
      // setFeatures("");
      setFeaturesText("");
      setBaseMrp("");
      setBaseSalePrice("");
      setShipLengthCm("20");
      setShipBreadthCm("15");
      setShipHeightCm("10");
      setShipWeightKg("0.5");
      setBaseStock("");                 // NEW
      setLowStockThreshold("5");        // NEW
      setParentCategoryId("");
      setSubCategoryId("");
      setVariants([
        {
          label: "",
          size: "",
          weight: "",
          // color: "",
          comboText: "",
          mrp: "",
          salePrice: "",
          quantity: "",
        },
      ]);
      setColors([{ name: "", hex: "", orderIndex: "0" }]);
      setColorImages({});
      setColorImagePreviews({});

      clearFeatureImage();
      setGalleryFiles([]);
      setGalleryPreviews([]);
      setVariantImages({});
      setVariantImagePreviews({});
    } catch (err: any) {
      console.error("Create product error:", err);
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- UI ----
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-md">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Add Product
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Create and manage your product catalog
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-emerald-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm font-medium text-emerald-800">
                {message}
              </span>
            </div>
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-red-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm font-medium text-red-800">
                {error}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-200 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Basic Information
              </h2>
            </div>
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    Product Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                    placeholder="e.g. Floral Printed Rayon Kurti"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    URL Slug <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                    placeholder="auto-generated-from-title"
                    required
                  />
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Auto-generated from title, you can customize it.
                  </p>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-slate-900 focus:border-slate-900 resize-none bg-white"
                    placeholder="Write a compelling description for your product..."
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Features / Bullet Points
                  </label>
                  <textarea
                    value={featuresText}
                    onChange={(e) => setFeaturesText(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-slate-900 focus:border-slate-900 resize-none bg-white"
                    placeholder={`• Rayon fabric\n• Machine washable\n• Regular fit`}
                  />
                  <p className="text-xs text-slate-500">
                    One feature per line
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & Media Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-200 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Pricing & Media
              </h2>
            </div>
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    Base MRP <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={baseMrp}
                      onChange={(e) => setBaseMrp(e.target.value)}
                      className="w-full border border-gray-300 rounded-md pl-7 pr-3 py-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                      placeholder="1499"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    Base Sale Price <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={baseSalePrice}
                      onChange={(e) => setBaseSalePrice(e.target.value)}
                      className="w-full border border-gray-300 rounded-md pl-7 pr-3 py-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                      placeholder="899"
                      required
                    />
                  </div>
                </div>
                {/* base stock */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Low Stock Alert Threshold
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                    placeholder="5"
                  />
                  <p className="text-xs text-slate-500">
                    Total stock = this value will be marked as low stock.
                  </p>
                </div>
                {/* Feature Image Upload */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    Feature Image
                  </label>
                  <div className="flex flex-col md:flex-row gap-4 items-start">
                    <label className="inline-flex items-center justify-center px-4 py-2.5 border border-dashed border-slate-300 rounded-md text-sm text-slate-700 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFeatureImageChange}
                      />
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4-4 4 4 4-4 4 4"
                        />
                      </svg>
                      Upload feature image
                    </label>

                    {featureImagePreview && (
                      <div className="relative w-32 h-32 rounded-md overflow-hidden border border-slate-200 bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={featureImagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={clearFeatureImage}
                          className="absolute top-1 right-1 bg-white/90 rounded-full p-1 shadow hover:bg-red-50"
                        >
                          <svg
                            className="w-3 h-3 text-red-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    JPG, PNG ya WebP, max 5MB recommended.
                  </p>
                </div>

                {/* Gallery Images Upload */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    Gallery Images
                  </label>
                  <div className="space-y-3">
                    <label className="inline-flex items-center justify-center px-4 py-2.5 border border-dashed border-slate-300 rounded-md text-sm text-slate-700 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleGalleryChange}
                      />
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4-4 4 4 4-4 4 4"
                        />
                      </svg>
                      Upload gallery images
                    </label>

                    {galleryPreviews.length > 0 && (
                      <div className="flex flex-wrap gap-3">
                        {galleryPreviews.map((preview, idx) => (
                          <div
                            key={idx}
                            className="relative w-20 h-20 rounded-md overflow-hidden border border-slate-200 bg-slate-50"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={preview}
                              alt={`Gallery ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeGalleryImage(idx)}
                              className="absolute top-1 right-1 bg-white/90 rounded-full p-1 shadow hover:bg-red-50"
                            >
                              <svg
                                className="w-3 h-3 text-red-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Multiple images select karein, alag-alag angles ke liye.
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* Shipping (Vendor/Admin only) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-200 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                Shipping Details (Internal)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                These values are used for shipment calculation. Customers will not see this.
              </p>
            </div>

            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Length (cm)</label>
                  <input
                    type="number"
                    min={0}
                    value={shipLengthCm}
                    onChange={(e) => setShipLengthCm(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Breadth (cm)</label>
                  <input
                    type="number"
                    min={0}
                    value={shipBreadthCm}
                    onChange={(e) => setShipBreadthCm(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Height (cm)</label>
                  <input
                    type="number"
                    min={0}
                    value={shipHeightCm}
                    onChange={(e) => setShipHeightCm(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Weight (kg)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={shipWeightKg}
                    onChange={(e) => setShipWeightKg(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>


          {/* Categories Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-200 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
                Categories
              </h2>
            </div>
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    Parent Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={parentCategoryId}
                    onChange={(e) => {
                      setParentCategoryId(e.target.value);
                      setSubCategoryId("");
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm outline-none bg-white transition-all focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                    required
                  >
                    <option value="">Select parent category</option>
                    {loadingCategories && (
                      <option disabled>Loading categories...</option>
                    )}
                    {!loadingCategories &&
                      parents.map((cat) => (
                        <option key={cat._id} value={cat._id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Sub Category
                  </label>
                  <select
                    value={subCategoryId}
                    onChange={(e) => setSubCategoryId(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm outline-none bg-white transition-all focus:ring-1 focus:ring-slate-900 focus:border-slate-900 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    disabled={!parentCategoryId}
                  >
                    <option value="">
                      {parentCategoryId
                        ? "Select sub category"
                        : "Select parent category first"}
                    </option>
                    {availableSubcategories.map((sub) => (
                      <option key={sub._id} value={sub._id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
          {variants.filter(v =>
            v.label || v.size || v.weight || v.comboText ||
            v.mrp.trim() !== "" || v.salePrice.trim() !== "" || v.quantity.trim() !== ""
          ).length === 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                  Base Stock <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={baseStock}
                  onChange={(e) => setBaseStock(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                  placeholder="e.g. 20"
                />
                <p className="text-xs text-slate-500">
                  Used only when you have no variants.
                </p>
              </div>
            )}
          {/* Colors Card (Product-level) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-200 bg-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Product Colors
              </h2>

              <button
                type="button"
                onClick={addColorRow}
                className="flex items-center gap-2 border border-slate-300 text-slate-800 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-slate-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Color
              </button>
            </div>

            <div className="p-6">
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Color Name
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Hex
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Order Index
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Color Images
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="bg-white divide-y divide-gray-200">
                    {colors.map((c, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={c.name}
                            onChange={(e) => handleColorChange(index, "name", e.target.value)}
                            className="w-full min-w-[140px] border border-gray-300 rounded-md px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                            placeholder="e.g. Black"
                          />
                        </td>

                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={c.hex}
                            onChange={(e) => handleColorChange(index, "hex", e.target.value)}
                            className="w-full min-w-[120px] border border-gray-300 rounded-md px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                            placeholder="#000000"
                          />
                        </td>

                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            min={0}
                            value={c.orderIndex}
                            onChange={(e) => handleColorChange(index, "orderIndex", e.target.value)}
                            className="w-full min-w-[90px] border border-gray-300 rounded-md px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                            placeholder="0"
                          />
                        </td>

                        <td className="px-4 py-2.5">
                          <div className="space-y-2">
                            <label className="inline-flex items-center justify-center px-2 py-1.5 border border-dashed border-slate-300 rounded-md text-[11px] text-slate-700 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => handleColorImageUpload(index, e.target.files)}
                              />
                              Upload
                            </label>

                            {(colorImagePreviews[index] || []).length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {colorImagePreviews[index].map((src, imgIdx) => (
                                  <div
                                    key={imgIdx}
                                    className="relative w-10 h-10 rounded border border-slate-200 overflow-hidden bg-slate-50"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={src}
                                      alt={`Color ${index + 1}-${imgIdx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeColorImage(index, imgIdx)}
                                      className="absolute top-0 right-0 bg-white/90 text-red-600 rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => removeColorRow(index)}
                            disabled={colors.length === 1}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Remove color"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                Colors affect PDP images only. Default color should have orderIndex = 0.
              </p>
            </div>
          </div>

          {/* Variants Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-200 bg-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
                Product Variants
              </h2>
              <button
                type="button"
                onClick={addVariantRow}
                className="flex items-center gap-2 border border-slate-300 text-slate-800 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-slate-100 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Add Variant
              </button>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Label
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Size
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Weight
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Combo Text
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        MRP
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Sale Price
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Quantity
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Variant Images
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {variants.map((v, index) => (
                      <tr
                        key={index}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={v.label}
                            onChange={(e) =>
                              handleVariantChange(
                                index,
                                "label",
                                e.target.value,
                              )
                            }
                            className="w-full min-w-[120px] border border-gray-300 rounded-md px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                            placeholder="e.g. 500g pack"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={v.size}
                            onChange={(e) =>
                              handleVariantChange(
                                index,
                                "size",
                                e.target.value,
                              )
                            }
                            className="w-full min-w-20 border border-gray-300 rounded-md px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                            placeholder="S/M/L"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={v.weight}
                            onChange={(e) =>
                              handleVariantChange(
                                index,
                                "weight",
                                e.target.value,
                              )
                            }
                            className="w-full min-w-20 border border-gray-300 rounded-md px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                            placeholder="500g"
                          />
                        </td>
                        {/* <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={v.color}
                            onChange={(e) =>
                              handleVariantChange(
                                index,
                                "color",
                                e.target.value,
                              )
                            }
                            className="w-full min-w-20 border border-gray-300 rounded-md px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                            placeholder="Red / Blue"
                          />
                        </td> */}
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={v.comboText}
                            onChange={(e) =>
                              handleVariantChange(
                                index,
                                "comboText",
                                e.target.value,
                              )
                            }
                            className="w-full min-w-[140px] border border-gray-300 rounded-md px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                            placeholder="Buy 2 Get 1 / Combo Pack"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            min={0}
                            value={v.mrp}
                            onChange={(e) =>
                              handleVariantChange(
                                index,
                                "mrp",
                                e.target.value,
                              )
                            }
                            className="w-full min-w-[100px] border border-gray-300 rounded-md px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                            placeholder="1499"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            min={0}
                            value={v.salePrice}
                            onChange={(e) =>
                              handleVariantChange(
                                index,
                                "salePrice",
                                e.target.value,
                              )
                            }
                            className="w-full min-w-[100px] border border-gray-300 rounded-md px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                            placeholder="899"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            min={0}
                            value={v.quantity}
                            onChange={(e) =>
                              handleVariantChange(
                                index,
                                "quantity",
                                e.target.value,
                              )
                            }
                            className="w-full min-w-20 border border-gray-300 rounded-md px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                            placeholder="10"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="space-y-2">
                            <label className="inline-flex items-center justify-center px-2 py-1.5 border border-dashed border-slate-300 rounded-md text-[11px] text-slate-700 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) =>
                                  handleVariantImageUpload(
                                    index,
                                    e.target.files,
                                  )
                                }
                              />
                              Upload
                            </label>
                            {(variantImagePreviews[index] || []).length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {variantImagePreviews[index].map(
                                  (src, imgIdx) => (
                                    <div
                                      key={imgIdx}
                                      className="relative w-10 h-10 rounded border border-slate-200 overflow-hidden bg-slate-50"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={src}
                                        alt={`Var ${index + 1}-${imgIdx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeVariantImage(index, imgIdx)
                                        }
                                        className="absolute top-0 right-0 bg-white/90 text-red-600 rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ),
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => removeVariantRow(index)}
                            disabled={variants.length === 1}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Remove variant"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                Variants are optional. If you do not add any, the product will
                use base MRP and sale price only.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="text-xs sm:text-sm text-slate-600">
              <span className="font-medium text-slate-800">
                Ready to publish?
              </span>{" "}
              Ensure all required fields are filled.
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-md font-semibold text-sm shadow-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <>
                  <svg
                    className="animate-spin w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating Product...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Create Product
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
