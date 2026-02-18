// app/website/category/[parentSlug]/[subSlug]/page.tsx

export const dynamic = "force-dynamic"; // 🔥 IMPORTANT

import CategoryProductsClient from "@/components/website/CategoryProductsClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

type ApiCategory = {
  _id: string;
  name: string;
  slug: string;
  parentCategory?: ApiCategory | string | null;
};

type ApiVariant = {
  _id?: string;
  label?: string;
  size?: string;
  weight?: string;
  comboText?: string;
  mrp?: number;
  salePrice?: number;
  quantity?: number;
};

type ApiProduct = {
  _id: string;
  title: string;
  slug: string;
  featureImage?: string;
  mrp?: number;
  salePrice?: number;

  baseStock?: number;
  totalStock?: number;
  variants?: ApiVariant[];

  // ✅ moderation
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  isActive?: boolean;
  ownerType?: "ADMIN" | "VENDOR";

  // ✅ populated vendor
  vendorId?: {
    company?: {
      name?: string;
    };
  };
};

async function fetchCategories(): Promise<ApiCategory[]> {
  if (!API_BASE) return [];

  const res = await fetch(`${API_BASE}/admin/categories`, {
    cache: "no-store",
    next: { revalidate: 0 },
  });

  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || data.categories || []) as ApiCategory[];
}

async function fetchProductsBySubCategory(subCategoryId: string): Promise<ApiProduct[]> {
  if (!API_BASE) return [];

  const url = `${API_BASE}/admin/products?subCategoryId=${subCategoryId}`;
  const res = await fetch(url, {
    cache: "no-store",
    next: { revalidate: 0 },
  });

  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []) as ApiProduct[];
}

export default async function SubCategoryPage({
  params,
}: {
  params: Promise<{ parentSlug: string; subSlug: string }>;
}) {
  const { parentSlug, subSlug } = await params;

  const categories = await fetchCategories();

  const parent = categories.find((c) => !c.parentCategory && c.slug === parentSlug);

  if (!parent) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-900">Category not found</h1>
      </div>
    );
  }

  const sub = categories.find((c) => {
    if (!c.parentCategory) return false;

    const pid =
      typeof c.parentCategory === "string"
        ? c.parentCategory
        : c.parentCategory?._id;

    return pid === parent._id && c.slug === subSlug;
  });

  if (!sub) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-900">Subcategory not found</h1>
        <p className="mt-2 text-sm text-gray-600">
          Invalid subcategory slug: <span className="font-medium">{subSlug}</span>
        </p>
      </div>
    );
  }

  const allProducts = await fetchProductsBySubCategory(sub._id);

  return (
    <div className="max-w-[1500px] mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <a className="hover:underline" href={`/category/${parent.slug}`}>
          {parent.name}
        </a>
        <span>/</span>
        <span className="text-gray-900 font-medium">{sub.name}</span>
      </div>

      <h1 className="mt-2 text-xl font-semibold text-gray-900 capitalize">{sub.name}</h1>

      {/* ✅ Filters + Products grid */}
      <CategoryProductsClient products={allProducts} />
    </div>
  );
}
