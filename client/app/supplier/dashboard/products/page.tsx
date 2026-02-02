/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

// import type React from "react";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

// ---- helper: image URL ko backend host ke saath resolve kare ----
const resolveImageUrl = (path?: string) => {
  if (!path) return "";

  // already full URL?
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const apiBase = API_BASE || "";
  const host = apiBase.replace(/\/api\/?$/, "");

  if (path.startsWith("/")) {
    return `${host}${path}`;
  }

  return `${host}/${path}`;
};

interface CategoryRef {
  _id: string;
  name: string;
  slug?: string;
}

interface Variant {
  _id: string;
  label?: string;
  weight?: string;
  size?: string;
  comboText?: string;
  quantity: number;
  mrp: number;
  salePrice: number;
  images: string[];
}
interface ProductColor {
  name: string;
  hex?: string;
  orderIndex: number;
  images?: string[];
}

type Ship = {
  lengthCm?: number;
  breadthCm?: number;
  heightCm?: number;
  weightKg?: number;
};

interface Product {
  _id: string;
  productId: string;
  title: string;
  slug: string;
  description?: string;
  features: string;
  featureImage?: string;
  galleryImages: string[];
  mrp: number;
  salePrice: number;

  baseStock?: number;
  lowStockThreshold?: number;
  colors?: ProductColor[]; // ✅ ADD

  variants: Variant[];
  category?: CategoryRef;
  subCategory?: CategoryRef | null;
  isActive: boolean;
  createdAt: string;
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  rejectReason?: string;
  ownerType?: "ADMIN" | "VENDOR";
  ship?: Ship;   // ✅ add this
}

interface EditVariantInput {
  _id?: string;
  label: string;
  size: string;
  weight: string;
  comboText: string;
  mrp: string;
  salePrice: string;
  quantity: string;
  images: string[];
}
type Category = {
  _id: string;
  name: string;
  slug: string;
  parentCategory?: Category | string | null;
};
type EditColorInput = {
  name: string;
  hex: string;
  orderIndex: string;
  images: string[];          // existing stored paths
  removedImages: string[];   // existing images removed in UI
  newImages: File[];         // new uploads
};


export default function AdminProductsListPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  // edit modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editTitle, setEditTitle] = useState("");
  // categories (same logic as add page)
  const [categories, setCategories] = useState<Category[]>([]);
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editSubCategoryId, setEditSubCategoryId] = useState("");
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [editFeatures, setEditFeatures] = useState(""); // ✅ NEW
  const [editMrp, setEditMrp] = useState("");
  const [editSalePrice, setEditSalePrice] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editFeatureExisting, setEditFeatureExisting] = useState<string>(""); // existing path
  const [editFeatureNewFile, setEditFeatureNewFile] = useState<File | null>(null);
  const [editFeatureNewPreview, setEditFeatureNewPreview] = useState<string>("");
  const [removeFeatureImage, setRemoveFeatureImage] = useState(false);
  const [editShipLengthCm, setEditShipLengthCm] = useState("");
  const [editShipBreadthCm, setEditShipBreadthCm] = useState("");
  const [editShipHeightCm, setEditShipHeightCm] = useState("");
  const [editShipWeightKg, setEditShipWeightKg] = useState("");

  // gallery editing state
  const [editGalleryExisting, setEditGalleryExisting] = useState<string[]>([]);
  const [editGalleryNewFiles, setEditGalleryNewFiles] = useState<File[]>([]);

  const [editColors, setEditColors] = useState<EditColorInput[]>([]);
  const [editColorNewPreviews, setEditColorNewPreviews] = useState<Record<number, string[]>>({});


  const [editBaseStock, setEditBaseStock] = useState("");
  const [editLowStockThreshold, setEditLowStockThreshold] = useState("");

  const [editGalleryNewPreviews, setEditGalleryNewPreviews] = useState<
    string[]
  >([]);

  // variants editing state
  const [editVariants, setEditVariants] = useState<EditVariantInput[]>([]);

  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editVariantNewFiles, setEditVariantNewFiles] = useState<Record<number, File[]>>({});
  const [editVariantNewPreviews, setEditVariantNewPreviews] = useState<Record<number, string[]>>({});
  const [editVariantRemovedImages, setEditVariantRemovedImages] = useState<Record<number, string[]>>({});

  const getToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("vendor_token");
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        setError("Vendor token not found. Please login again.");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/vendors/products`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      console.log("vendors/products status:", res.status);

      const data = await res.json(); // ✅ declare FIRST

      console.log("vendors/products raw response:", data);
      console.log("vendors/products data keys:", Object.keys(data || {}));
      console.log(
        "vendors/products data.data keys:",
        data?.data && typeof data.data === "object" && !Array.isArray(data.data)
          ? Object.keys(data.data)
          : []
      );

      if (!res.ok) {
        throw new Error(data?.message || "Failed to load products");
      }

      const arr =
        Array.isArray(data?.data) ? data.data :
          Array.isArray(data?.data?.items) ? data.data.items :
            Array.isArray(data?.data?.products) ? data.data.products :
              Array.isArray(data?.products) ? data.products :
                Array.isArray(data?.items) ? data.items :
                  [];

      console.log("vendors/products resolved length:", arr.length);
      setProducts(arr);
    } catch (err: any) {
      console.error("Load products error:", err);
      setError(err.message || "Error loading products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true);
        const token = getToken();

        const res = await fetch(`${API_BASE}/admin/categories`, {

        });
        const data = await res.json();
        if (res.ok) {
          setCategories(data.data || []);
        }
      } catch (err) {
        console.error("Category load error", err);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);
  // ---------- CATEGORY HELPERS (EDIT PRODUCT) ----------

  // parent categories
  const parentCategories = categories.filter((c) => !c.parentCategory);

  // sub categories based on selected parent
  const subCategories = categories.filter((c) => {
    if (!c.parentCategory) return false;

    const pid =
      typeof c.parentCategory === "string"
        ? c.parentCategory
        : c.parentCategory._id;

    return pid === editCategoryId;
  });

  const handleDelete = async (id: string) => {
    const sure = window.confirm(
      "Are you sure you want to delete this product? This action cannot be undone."
    );
    if (!sure) return;

    try {
      setDeletingId(id);
      setError(null);
      setMessage(null);

      const token = getToken();
      if (!token) {
        setError("Admin token not found. Please login again.");
        setDeletingId(null);
        return;
      }

      const res = await fetch(`${API_BASE}/vendors/products/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Failed to delete product");
      }

      setMessage("Product deleted successfully.");
      setProducts((prev) => prev.filter((p) => p._id !== id));
    } catch (err: any) {
      console.error("Delete product error:", err);
      setError(err.message || "Error deleting product");
    } finally {
      setDeletingId(null);
    }
  };
  // ---- EDIT MODAL HELPERS ----
  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setEditTitle(product.title);
    setEditDescription(product.description || "");
    setEditFeatures(product.features || ""); // ✅ NEW
    setEditMrp(product.mrp.toString());
    setEditSalePrice(product.salePrice.toString());
    setEditIsActive(product.isActive);
    setEditError(null);
    setEditBaseStock(String(product.baseStock ?? ""));
    setEditLowStockThreshold(String(product.lowStockThreshold ?? ""));
    // shipment Detials
    const ship = (product as any).ship || {};

    setEditShipLengthCm(String(product.ship?.lengthCm ?? ""));
    setEditShipBreadthCm(String(product.ship?.breadthCm ?? ""));
    setEditShipHeightCm(String(product.ship?.heightCm ?? ""));
    setEditShipWeightKg(String(product.ship?.weightKg ?? ""));


    // feature image
    setEditFeatureExisting(product.featureImage || "");
    setEditFeatureNewFile(null);
    setEditFeatureNewPreview("");
    setRemoveFeatureImage(false);
    // gallery
    setEditGalleryExisting(product.galleryImages || []);
    setEditGalleryNewFiles([]);
    setEditGalleryNewPreviews([]);
    // ✅ CATEGORY PREFILL
    setEditCategoryId(product.category?._id || "");
    setEditSubCategoryId(product.subCategory?._id || "");
    const mappedColors: EditColorInput[] =
      (product.colors || []).length > 0
        ? (product.colors || []).map((c, idx) => ({
          name: c.name || "",
          hex: c.hex || "",
          orderIndex: String(c.orderIndex ?? idx),
          images: c.images || [],
          removedImages: [],
          newImages: [],
        }))
        : [
          {
            name: "",
            hex: "",
            orderIndex: "0",
            images: [],
            removedImages: [],
            newImages: [],
          },
        ];

    setEditColors(mappedColors);
    setEditColorNewPreviews({});


    // variants
    const mappedVariants: EditVariantInput[] =
      product.variants?.map((v) => ({
        _id: v._id,
        label: v.label || "",
        size: v.size || "",
        weight: v.weight || "",
        comboText: v.comboText || "",
        mrp: v.mrp.toString(),
        salePrice: v.salePrice.toString(),
        quantity: v.quantity.toString(),
        images: v.images || [],
      })) || [];

    setEditVariants(mappedVariants);
    // variant images editing maps reset
    setEditVariantNewFiles({});
    setEditVariantNewPreviews({});
    setEditVariantRemovedImages({});
  };

  const closeEditModal = () => {
    if (savingEdit) return;
    setEditingProduct(null);
    setEditError(null);
    setEditGalleryNewFiles([]);
    setEditGalleryNewPreviews([]);
    setEditColors([]);

    setEditColorNewPreviews({});
    setEditFeatureExisting("");
    setEditFeatureNewFile(null);
    setEditFeatureNewPreview("");
    setRemoveFeatureImage(false);

    setEditVariantNewFiles({});
    setEditVariantNewPreviews({});
    setEditVariantRemovedImages({});
  };
  const handleEditColorChange = (
    index: number,
    field: "name" | "hex" | "orderIndex",
    value: string
  ) => {
    setEditColors((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };
  const addEditColorRow = () => {
    setEditColors((prev) => [
      ...prev,
      {
        name: "",
        hex: "",
        orderIndex: String(prev.length),
        images: [],
        removedImages: [],
        newImages: [],
      },
    ]);
  };

  const removeEditColorRow = (index: number) => {
    setEditColors((prev) => prev.filter((_, i) => i !== index));

    // previews shift
    setEditColorNewPreviews((prev) => {
      const next: Record<number, string[]> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const idx = Number(k);
        if (idx < index) next[idx] = v;
        else if (idx > index) next[idx - 1] = v;
      });
      return next;
    });
  };

  const handleEditColorImageUpload = (index: number, files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const previews = arr.map((f) => URL.createObjectURL(f));

    setEditColors((prev) => {
      const copy = [...prev];
      const curr = copy[index];
      copy[index] = { ...curr, newImages: [...(curr.newImages || []), ...arr] };
      return copy;
    });

    setEditColorNewPreviews((prev) => ({
      ...prev,
      [index]: [...(prev[index] || []), ...previews],
    }));
  };
  const removeExistingEditColorImage = (colorIndex: number, imgPath: string) => {
    setEditColors((prev) => {
      const copy = [...prev];
      const curr = copy[colorIndex];
      copy[colorIndex] = {
        ...curr,
        images: (curr.images || []).filter((x) => x !== imgPath),
        removedImages: [...(curr.removedImages || []), imgPath],
      };
      return copy;
    });
  };
  const removeNewEditColorImage = (colorIndex: number, fileIndex: number) => {
    setEditColors((prev) => {
      const copy = [...prev];
      const curr = copy[colorIndex];
      copy[colorIndex] = {
        ...curr,
        newImages: (curr.newImages || []).filter((_, i) => i !== fileIndex),
      };
      return copy;
    });

    setEditColorNewPreviews((prev) => ({
      ...prev,
      [colorIndex]: (prev[colorIndex] || []).filter((_, i) => i !== fileIndex),
    }));
  };
  const handleEditFeatureImageChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setEditFeatureNewFile(file);
    setEditFeatureNewPreview(URL.createObjectURL(file));
    setRemoveFeatureImage(false); // new file aaya toh remove flag false
  };

  const removeExistingFeatureImage = () => {
    setEditFeatureExisting("");
    setRemoveFeatureImage(true);
  };

  const removeNewFeatureImage = () => {
    setEditFeatureNewFile(null);
    setEditFeatureNewPreview("");
  };

  // gallery handlers inside modal
  const handleEditGalleryAdd = (
    e: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setEditGalleryNewFiles((prev) => [...prev, ...files]);
    const previews = files.map((f) => URL.createObjectURL(f));
    setEditGalleryNewPreviews((prev) => [...prev, ...previews]);
  };

  const removeExistingGalleryImage = (index: number) => {
    setEditGalleryExisting((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewGalleryImage = (index: number) => {
    setEditGalleryNewFiles((prev) => prev.filter((_, i) => i !== index));
    setEditGalleryNewPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditVariantChange = (
    index: number,
    field: keyof EditVariantInput,
    value: string,
  ) => {
    setEditVariants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const addEditVariantRow = () => {
    setEditVariants((prev) => [
      ...prev,
      {
        label: "",
        size: "",
        weight: "",
        comboText: "",
        mrp: "",
        salePrice: "",
        quantity: "",
        images: [],
      },
    ]);
  };
  const handleEditVariantImageUpload = (variantIndex: number, files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const previews = arr.map((f) => URL.createObjectURL(f));

    setEditVariantNewFiles((prev) => ({
      ...prev,
      [variantIndex]: [...(prev[variantIndex] || []), ...arr],
    }));

    setEditVariantNewPreviews((prev) => ({
      ...prev,
      [variantIndex]: [...(prev[variantIndex] || []), ...previews],
    }));
  };

  const removeExistingVariantImage = (variantIndex: number, imgPath: string) => {
    // remove from editVariants.images
    setEditVariants((prev) => {
      const copy = [...prev];
      const v = copy[variantIndex];
      copy[variantIndex] = { ...v, images: (v.images || []).filter((x) => x !== imgPath) };
      return copy;
    });

    // track removed
    setEditVariantRemovedImages((prev) => ({
      ...prev,
      [variantIndex]: [...(prev[variantIndex] || []), imgPath],
    }));
  };

  const removeNewVariantImage = (variantIndex: number, fileIndex: number) => {
    setEditVariantNewFiles((prev) => ({
      ...prev,
      [variantIndex]: (prev[variantIndex] || []).filter((_, i) => i !== fileIndex),
    }));

    setEditVariantNewPreviews((prev) => ({
      ...prev,
      [variantIndex]: (prev[variantIndex] || []).filter((_, i) => i !== fileIndex),
    }));
  };

  const removeEditVariantRow = (index: number) => {
    setEditVariants((prev) => prev.filter((_, i) => i !== index));
  };
  const hasVariants = editVariants.length > 0;
  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      setSavingEdit(true);
      setEditError(null);
      setMessage(null);

      const token = getToken();
      if (!token) {
        setEditError("Admin token not found. Please login again.");
        setSavingEdit(false);
        return;
      }

      // 1️⃣ CLEAN VARIANTS
      const cleanVariants = editVariants
        .filter(
          (v) =>
            v._id || // keep even if only image removal
            v.label ||
            v.size ||
            v.weight ||
            v.comboText ||
            v.mrp.trim() !== "" ||
            v.salePrice.trim() !== "" ||
            v.quantity.trim() !== "" ||
            (v.images && v.images.length >= 0) // images array always relevant
        )
        .map((v) => ({
          _id: v._id, // ✅ MUST
          label: v.label || undefined,
          size: v.size || undefined,
          weight: v.weight || undefined,
          comboText: v.comboText || undefined,
          mrp: Number(v.mrp || 0),
          salePrice: Number(v.salePrice || 0),
          quantity: Number(v.quantity || 0),
          images: v.images || [], // ✅ this should reflect removed images already
        }));

      const hasAnyVariantDraft = editVariants.some(
        (v) =>
          v.label.trim() ||
          v.size.trim() ||
          v.weight.trim() ||
          v.comboText.trim() ||
          v.mrp.trim() !== "" ||
          v.salePrice.trim() !== "" ||
          v.quantity.trim() !== ""
      );

      // 2️⃣ DEFINE HERE ONLY
      const hasVariants = hasAnyVariantDraft;


      // 3️⃣ VALIDATION
      if (!hasVariants && editBaseStock.trim() === "") {
        setEditError("Base stock is required when no variants exist");
        setSavingEdit(false);
        return;
      }
      const cleanColors = editColors
        .map((c, idx) => ({
          name: (c.name || "").trim(),
          hex: (c.hex || "").trim(),
          orderIndex: Number(c.orderIndex ?? idx),
          images: c.images || [], // remaining existing images after removals
        }))
        .filter((c) => c.name);

      // 4️⃣ FORM DATA
      const formData = new FormData();
      formData.append("title", editTitle);
      formData.append("description", editDescription);
      formData.append("features", editFeatures); // ✅ NEW
      formData.append("mrp", editMrp);
      formData.append("salePrice", editSalePrice);
      // feature image handling
      if (removeFeatureImage) {
        formData.append("removeFeatureImage", "true");
      }
      if (editFeatureNewFile) {
        formData.append("featureImage", editFeatureNewFile);
      }
      formData.append("isActive", editIsActive ? "true" : "false");
      formData.append("categoryId", editCategoryId);

      if (editSubCategoryId) {
        formData.append("subCategoryId", editSubCategoryId);
      } else {
        formData.append("subCategoryId", "");
      }
      if (cleanColors.length > 0) {
        formData.append("colors", JSON.stringify(cleanColors));
      } else {
        formData.append("colors", "[]");
      }
      editColors.forEach((c, idx) => {
        (c.newImages || []).forEach((file) => {
          formData.append(`colorImages[${idx}]`, file);
        });
      });


      // gallery
      if (editGalleryExisting.length > 0) {
        formData.append("galleryImages", editGalleryExisting.join(","));
      } else {
        formData.append("galleryImages", "");
      }

      editGalleryNewFiles.forEach((file) => {
        formData.append("galleryImages", file);
      });
      // variant images uploads
      Object.entries(editVariantNewFiles).forEach(([k, files]) => {
        const idx = Number(k);
        (files || []).forEach((file) => {
          formData.append(`variantImages[${idx}]`, file);
        });
      });

      // variant removed images info
      const removedVariantImagesPayload = Object.entries(editVariantRemovedImages).map(([k, imgs]) => ({
        variantId: editVariants[Number(k)]?._id, // ✅
        images: imgs || [],
      }));
      formData.append("removedVariantImages", JSON.stringify(removedVariantImagesPayload));

      // stock logic
      if (hasVariants) {
        formData.append("variants", JSON.stringify(cleanVariants));
      } else {
        formData.append("baseStock", editBaseStock);
      }

      if (editLowStockThreshold.trim() !== "") {
        formData.append("lowStockThreshold", editLowStockThreshold);
      }
      if (editShipLengthCm.trim() !== "") formData.append("shipLengthCm", editShipLengthCm);
      if (editShipBreadthCm.trim() !== "") formData.append("shipBreadthCm", editShipBreadthCm);
      if (editShipHeightCm.trim() !== "") formData.append("shipHeightCm", editShipHeightCm);
      if (editShipWeightKg.trim() !== "") formData.append("shipWeightKg", editShipWeightKg);


      // 5️⃣ API CALL
      const res = await fetch(
        `${API_BASE}/vendors/products/${editingProduct._id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to update product");
      }

      setProducts((prev) =>
        prev.map((p) => (p._id === data.data._id ? data.data : p))
      );

      setMessage("Product updated successfully.");
      setEditingProduct(null);
    } catch (err: any) {
      setEditError(err.message || "Error updating product");
    } finally {
      setSavingEdit(false);
    }
  };

  const getTotalStock = (p: Product) => {
    if (p.variants && p.variants.length > 0) {
      return p.variants.reduce((sum, v) => sum + (v.quantity || 0), 0);
    }
    return p.baseStock || 0;
  };

  const isLowStock = (p: Product) => {
    const total = getTotalStock(p);
    const limit = p.lowStockThreshold ?? 5;
    return total <= limit;
  };


  const filteredProducts = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
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
                  d="M3 3h18v4H3zM3 9h18v12H3z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Products
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Manage all products, edit details or delete items.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative">
              <input
                type="text"
                className="w-full sm:w-64 border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                placeholder="Search by product title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M10 17a7 7 0 100-14 7 7 0 000 14z"
                />
              </svg>
            </div>

            <Link
              href="/supplier/products/products-add"
              className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors"
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
              Add Product
            </Link>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
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
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
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

        {/* Table Card */}
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
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              Product List
            </h2>
            <span className="text-xs text-slate-500">
              Total:{" "}
              <span className="font-semibold text-slate-800">
                {products.length}
              </span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Product
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Category
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Price
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Variants
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Stock
                  </th>

                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Status
                  </th>


                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Created
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Approval
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Actions
                  </th>

                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-6 text-center text-slate-500 text-sm"
                    >
                      Loading products...
                    </td>
                  </tr>
                )}

                {!loading && filteredProducts.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-6 text-center text-slate-500 text-sm"
                    >
                      No products found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredProducts.map((p) => (
                    <tr
                      key={p._id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* Product + image + productId */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-md border border-gray-200 overflow-hidden bg-slate-100 shrink-0">
                            {p.featureImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={resolveImageUrl(p.featureImage)}
                                alt={p.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                                No Image
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900 line-clamp-2">
                              {p.title}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {p.slug}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              ID: <span className="font-medium">{p.productId}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-slate-800">
                          {p.category?.name || "-"}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {p.subCategory?.name
                            ? `Sub: ${p.subCategory.name}`
                            : ""}
                        </div>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-slate-900">
                          ₹{p.salePrice.toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-500 line-through">
                          ₹{p.mrp.toFixed(2)}
                        </div>
                      </td>

                      {/* Variants */}
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-slate-800">
                          {p.variants?.length || 0}{" "}
                          <span className="text-xs text-slate-500">
                            variants
                          </span>
                        </div>
                        {p.variants?.length > 0 && (
                          <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                            {p.variants
                              .slice(0, 2)
                              .map((v) => v.label || v.size || v.weight)
                              .filter(Boolean)
                              .join(", ")}
                            {p.variants.length > 2 && " …"}
                          </div>
                        )}
                      </td>

                      {/* stock */}
                      <td className="px-4 py-3 text-xs">
                        <span className="font-medium">{getTotalStock(p)}</span>
                        {isLowStock(p) && (
                          <span className="ml-2 text-[11px] text-red-600 font-semibold">
                            Low Stock
                          </span>
                        )}
                      </td>
                      {/* Approval Batch */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${p.approvalStatus === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : p.approvalStatus === "REJECTED"
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                        >
                          {p.approvalStatus || "PENDING"}
                        </span>

                        {p.approvalStatus === "REJECTED" && p.rejectReason ? (
                          <div className="text-[11px] text-red-600 mt-1 line-clamp-2">
                            {p.rejectReason}
                          </div>
                        ) : null}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${p.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${p.isActive ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                          />
                          {p.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Created date */}
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {new Date(p.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            className="inline-flex items-center px-2.5 py-1.5 text-xs border border-slate-300 rounded-md text-slate-800 hover:bg-slate-100 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p._id)}
                            disabled={deletingId === p._id}
                            className="inline-flex items-center px-2.5 py-1.5 text-xs border border-red-300 rounded-md text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {deletingId === p._id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {/* EDIT MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 z-40 bg-black/40">
          {/* Center wrapper with safe scroll */}
          <div className="flex min-h-dvh items-end sm:items-center justify-center p-2 sm:p-4">
            {/* Modal */}
            <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl">
              {/* Header (sticky) */}
              <div className="px-4 sm:px-5 py-3 border-b border-gray-200 flex items-start sm:items-center justify-between gap-3 sticky top-0 bg-white rounded-t-xl z-10">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">Edit Product</h3>
                  <p className="text-xs text-slate-500 mt-0.5 break-all">
                    ID: {editingProduct.productId} | Mongo: {editingProduct._id}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeEditModal}
                  className="shrink-0 p-2 rounded-full hover:bg-slate-100"
                  aria-label="Close"
                >
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Body scroll area */}
              <form
                onSubmit={handleEditSubmit}
                className="px-4 sm:px-5 py-4 space-y-4 max-h-[calc(100dvh-140px)] overflow-y-auto"
              >
                {editError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {editError}
                  </div>
                )}

                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Description</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 resize-none bg-white"
                  />
                </div>

                {/* Features */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    Features / Specifications
                  </label>
                  <textarea
                    value={editFeatures}
                    onChange={(e) => setEditFeatures(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 resize-none bg-white"
                    placeholder={`• Feature 1\n• Feature 2\n• Feature 3`}
                  />
                  <p className="text-[11px] text-slate-500">One feature per line</p>
                </div>

                {/* Pricing + Category (responsive grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* MRP */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">MRP</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                        ₹
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={editMrp}
                        onChange={(e) => setEditMrp(e.target.value)}
                        className="w-full border border-gray-300 rounded-md pl-7 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                      />
                    </div>
                  </div>
                  {/* Shipping management */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">Length (cm)</label>
                      <input type="number" min={0} value={editShipLengthCm}
                        onChange={(e) => setEditShipLengthCm(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">Breadth (cm)</label>
                      <input type="number" min={0} value={editShipBreadthCm}
                        onChange={(e) => setEditShipBreadthCm(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">Height (cm)</label>
                      <input type="number" min={0} value={editShipHeightCm}
                        onChange={(e) => setEditShipHeightCm(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">Weight (kg)</label>
                      <input type="number" min={0} step="0.01" value={editShipWeightKg}
                        onChange={(e) => setEditShipWeightKg(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                      />
                    </div>
                  </div>
                  {/* Sale Price */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Sale Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                        ₹
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={editSalePrice}
                        onChange={(e) => setEditSalePrice(e.target.value)}
                        className="w-full border border-gray-300 rounded-md pl-7 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                      />
                    </div>
                  </div>


                  {/* Category */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Category</label>
                    <select
                      value={editCategoryId}
                      onChange={(e) => {
                        setEditCategoryId(e.target.value);
                        setEditSubCategoryId("");
                      }}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                    >
                      <option value="">Select category</option>
                      {parentCategories.map((cat) => (
                        <option key={cat._id} value={cat._id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sub Category */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Sub Category</label>
                    <select
                      value={editSubCategoryId}
                      onChange={(e) => setEditSubCategoryId(e.target.value)}
                      disabled={!editCategoryId}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white disabled:bg-slate-100"
                    >
                      <option value="">None</option>
                      {subCategories.map((sub) => (
                        <option key={sub._id} value={sub._id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Stock section (responsive) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {!hasVariants && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">Base Stock</label>
                      <input
                        type="number"
                        min={0}
                        value={editBaseStock}
                        onChange={(e) => setEditBaseStock(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">
                      Low Stock Alert Limit
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editLowStockThreshold}
                      onChange={(e) => setEditLowStockThreshold(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                      placeholder="e.g. 5"
                    />
                  </div>
                </div>
                {/* color section */}
                {/* Colors (Product-level) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-700">
                      Product Colors
                    </label>

                    <button
                      type="button"
                      onClick={addEditColorRow}
                      className="text-[11px] px-2 py-1 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
                    >
                      + Add Color
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-md border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                            Name
                          </th>
                          <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                            Hex
                          </th>
                          <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                            Order
                          </th>
                          <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                            Images
                          </th>
                          <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody className="bg-white divide-y divide-gray-200">
                        {editColors.map((c, index) => (
                          <tr key={index} className="hover:bg-slate-50 transition-colors align-top">
                            {/* name */}
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={c.name}
                                onChange={(e) => handleEditColorChange(index, "name", e.target.value)}
                                className="w-full min-w-[140px] border border-gray-300 rounded-md px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                                placeholder="e.g. Black"
                              />
                            </td>

                            {/* hex */}
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={c.hex}
                                onChange={(e) => handleEditColorChange(index, "hex", e.target.value)}
                                className="w-full min-w-[110px] border border-gray-300 rounded-md px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                                placeholder="#000000"
                              />
                            </td>

                            {/* order */}
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                value={c.orderIndex}
                                onChange={(e) => handleEditColorChange(index, "orderIndex", e.target.value)}
                                className="w-full min-w-[70px] border border-gray-300 rounded-md px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                                placeholder="0"
                              />
                            </td>

                            {/* images */}
                            <td className="px-3 py-2">
                              <div className="space-y-2">
                                {/* upload */}
                                <label className="inline-flex items-center justify-center px-2 py-1.5 border border-dashed border-slate-300 rounded-md text-[11px] text-slate-700 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => handleEditColorImageUpload(index, e.target.files)}
                                  />
                                  Upload
                                </label>

                                {/* existing images */}
                                {(c.images || []).length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {(c.images || []).map((imgPath, imgIdx) => (
                                      <div
                                        key={`${imgPath}-${imgIdx}`}
                                        className="relative w-10 h-10 rounded border border-slate-200 overflow-hidden bg-slate-50"
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={resolveImageUrl(imgPath)}
                                          alt={`Color ${index + 1}-${imgIdx + 1}`}
                                          className="w-full h-full object-cover"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => removeExistingEditColorImage(index, imgPath)}
                                          className="absolute top-0 right-0 bg-white/90 text-red-600 rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow"
                                          title="Remove image"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* new uploaded previews */}
                                {(editColorNewPreviews[index] || []).length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {(editColorNewPreviews[index] || []).map((src, imgIdx) => (
                                      <div
                                        key={`${src}-${imgIdx}`}
                                        className="relative w-10 h-10 rounded border border-slate-200 overflow-hidden bg-slate-50"
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={src}
                                          alt={`New color ${index + 1}-${imgIdx + 1}`}
                                          className="w-full h-full object-cover"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => removeNewEditColorImage(index, imgIdx)}
                                          className="absolute top-0 right-0 bg-white/90 text-red-600 rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow"
                                          title="Remove new upload"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* action */}
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => removeEditColorRow(index)}
                                disabled={editColors.length === 1}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Remove color"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Note: Color images are used for PDP gallery switching. Keep default color orderIndex = 0.
                  </p>
                </div>
                {/* Feature Image */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700">Feature Image</label>

                  {/* existing */}
                  {editFeatureExisting && !removeFeatureImage && (
                    <div className="flex items-center gap-3">
                      <div className="relative w-20 h-20 rounded-md overflow-hidden border border-slate-200 bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolveImageUrl(editFeatureExisting)}
                          alt="Feature"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={removeExistingFeatureImage}
                          className="absolute top-1 right-1 bg-white/90 rounded-full w-5 h-5 text-[12px] flex items-center justify-center text-red-600 shadow"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Removing existing feature image will clear it (unless you upload a new one).
                      </p>
                    </div>
                  )}

                  {/* new preview */}
                  {editFeatureNewPreview && (
                    <div className="relative w-20 h-20 rounded-md overflow-hidden border border-slate-200 bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={editFeatureNewPreview} alt="New Feature" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={removeNewFeatureImage}
                        className="absolute top-1 right-1 bg-white/90 rounded-full w-5 h-5 text-[12px] flex items-center justify-center text-red-600 shadow"
                        title="Remove new"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {/* upload */}
                  <label className="inline-flex items-center justify-center px-3 py-1.5 border border-dashed border-slate-300 rounded-md text-[11px] text-slate-700 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleEditFeatureImageChange(e.target.files)}
                    />
                    Upload Feature Image
                  </label>
                </div>


                {/* Gallery edit */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700">
                    Gallery Images
                  </label>
                  {/* existing */}
                  {editGalleryExisting.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {editGalleryExisting.map((img, idx) => (
                        <div
                          key={idx}
                          className="relative w-16 h-16 rounded-md overflow-hidden border border-slate-200 bg-slate-50"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={resolveImageUrl(img)}
                            alt={`Gallery ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeExistingGalleryImage(idx)}
                            className="absolute top-1 right-1 bg-white/90 rounded-full w-4 h-4 text-[10px] flex items-center justify-center text-red-600 shadow"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* new uploads */}
                  <div className="space-y-2">
                    <label className="inline-flex items-center justify-center px-3 py-1.5 border border-dashed border-slate-300 rounded-md text-[11px] text-slate-700 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleEditGalleryAdd}
                      />
                      Add more images
                    </label>

                    {editGalleryNewPreviews.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {editGalleryNewPreviews.map((preview, idx) => (
                          <div
                            key={idx}
                            className="relative w-16 h-16 rounded-md overflow-hidden border border-slate-200 bg-slate-50"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={preview}
                              alt={`New ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeNewGalleryImage(idx)}
                              className="absolute top-1 right-1 bg-white/90 rounded-full w-4 h-4 text-[10px] flex items-center justify-center text-red-600 shadow"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Variants edit */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-700">
                      Variants
                    </label>
                    <button
                      type="button"
                      onClick={addEditVariantRow}
                      className="text-[11px] px-2 py-1 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
                    >
                      + Add Variant
                    </button>
                  </div>

                  {editVariants.length === 0 && (
                    <p className="text-[11px] text-slate-500">
                      No variants added yet.
                    </p>
                  )}

                  {editVariants.length > 0 && (
                    <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-md p-2 space-y-3">
                      {editVariants.map((v, index) => (
                        <div
                          key={index}
                          className="rounded-md border border-slate-200 p-2 space-y-2 bg-slate-50/50"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-700">
                              Variant {index + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeEditVariantRow(index)}
                              className="text-[11px] text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={v.label}
                              onChange={(e) =>
                                handleEditVariantChange(
                                  index,
                                  "label",
                                  e.target.value,
                                )
                              }
                              placeholder="Label"
                              className="border border-gray-300 rounded-md px-2 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                            />
                            <input
                              type="text"
                              value={v.size}
                              onChange={(e) =>
                                handleEditVariantChange(
                                  index,
                                  "size",
                                  e.target.value,
                                )
                              }
                              placeholder="Size"
                              className="border border-gray-300 rounded-md px-2 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                            />
                            <input
                              type="text"
                              value={v.weight}
                              onChange={(e) =>
                                handleEditVariantChange(
                                  index,
                                  "weight",
                                  e.target.value,
                                )
                              }
                              placeholder="Weight"
                              className="border border-gray-300 rounded-md px-2 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                            />

                            <input
                              type="text"
                              value={v.comboText}
                              onChange={(e) =>
                                handleEditVariantChange(
                                  index,
                                  "comboText",
                                  e.target.value,
                                )
                              }
                              placeholder="Combo text"
                              className="border border-gray-300 rounded-md px-2 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white col-span-2"
                            />
                            <input
                              type="number"
                              min={0}
                              value={v.mrp}
                              onChange={(e) =>
                                handleEditVariantChange(
                                  index,
                                  "mrp",
                                  e.target.value,
                                )
                              }
                              placeholder="MRP"
                              className="border border-gray-300 rounded-md px-2 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                            />
                            <input
                              type="number"
                              min={0}
                              value={v.salePrice}
                              onChange={(e) =>
                                handleEditVariantChange(
                                  index,
                                  "salePrice",
                                  e.target.value,
                                )
                              }
                              placeholder="Sale price"
                              className="border border-gray-300 rounded-md px-2 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                            />
                            <input
                              type="number"
                              min={0}
                              value={v.quantity}
                              onChange={(e) =>
                                handleEditVariantChange(
                                  index,
                                  "quantity",
                                  e.target.value,
                                )
                              }
                              placeholder="Qty"
                              className="border border-gray-300 rounded-md px-2 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                            />
                            {/* Variant Images */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] font-semibold text-slate-700">Variant Images</p>

                                <label className="inline-flex items-center justify-center px-2 py-1 border border-dashed border-slate-300 rounded-md text-[11px] text-slate-700 bg-white hover:bg-slate-50 cursor-pointer transition-colors">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => handleEditVariantImageUpload(index, e.target.files)}
                                  />
                                  Upload
                                </label>
                              </div>

                              {/* existing images */}
                              {(v.images || []).length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {(v.images || []).map((imgPath, imgIdx) => (
                                    <div
                                      key={`${imgPath}-${imgIdx}`}
                                      className="relative w-10 h-10 rounded border border-slate-200 overflow-hidden bg-slate-50"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={resolveImageUrl(imgPath)}
                                        alt={`Variant ${index + 1}-${imgIdx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeExistingVariantImage(index, imgPath)}
                                        className="absolute top-0 right-0 bg-white/90 text-red-600 rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow"
                                        title="Remove"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* new previews */}
                              {(editVariantNewPreviews[index] || []).length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {(editVariantNewPreviews[index] || []).map((src, imgIdx) => (
                                    <div
                                      key={`${src}-${imgIdx}`}
                                      className="relative w-10 h-10 rounded border border-slate-200 overflow-hidden bg-slate-50"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={src} alt={`New Variant ${index + 1}-${imgIdx + 1}`} className="w-full h-full object-cover" />
                                      <button
                                        type="button"
                                        onClick={() => removeNewVariantImage(index, imgIdx)}
                                        className="absolute top-0 right-0 bg-white/90 text-red-600 rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow"
                                        title="Remove new"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                          </div>

                          {v.images && v.images.length > 0 && (
                            <p className="text-[10px] text-slate-500">
                              This variant already has {v.images.length} image(s).
                              Images edit hum abhi modal se change nahi kar rahe,
                              sirf text/pricing update hoga.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      id="edit-is-active"
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="edit-is-active" className="text-xs font-medium text-slate-700">
                      Active product
                    </label>
                  </div>

                  <div className="text-[11px] text-slate-500 text-right">
                    Category:{" "}
                    <span className="font-medium">{editingProduct.category?.name || "-"}</span>
                    {editingProduct.subCategory?.name && (
                      <>
                        {" "}
                        | Sub:{" "}
                        <span className="font-medium">{editingProduct.subCategory.name}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Footer buttons (sticky) */}
                <div className="sticky bottom-0 bg-white pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    disabled={savingEdit}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded-md text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-4 py-1.5 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {savingEdit ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
