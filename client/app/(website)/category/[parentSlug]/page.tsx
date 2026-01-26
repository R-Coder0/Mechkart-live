// app/website/category/[parentSlug]/page.tsx

export const dynamic = "force-dynamic"; // 🔥 IMPORTANT

import ProductCard from "@/components/website/ProductCard";

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

function calcTotalStock(p: ApiProduct) {
  if (p.variants && p.variants.length > 0) {
    return p.variants.reduce((sum, v) => sum + Number(v.quantity ?? 0), 0);
  }
  return Number(p.totalStock ?? p.baseStock ?? 0);
}

async function fetchProductsByCategory(categoryId: string): Promise<ApiProduct[]> {
  if (!API_BASE) return [];

  const url = `${API_BASE}/admin/products?categoryId=${categoryId}`;

  const res = await fetch(url, {
    cache: "no-store",
    next: { revalidate: 0 }, // 🔥 fresh data
  });

  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []) as ApiProduct[];
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ parentSlug: string }>;
}) {
  const { parentSlug } = await params;

  const categories = await fetchCategories();

  const parent = categories.find(
    (c) => !c.parentCategory && c.slug === parentSlug
  );

  if (!parent) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-900">
          Category not found
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Invalid category slug:{" "}
          <span className="font-medium">{parentSlug}</span>
        </p>
      </div>
    );
  }

  // subcategories
  const subCategories = categories.filter((c) => {
    if (!c.parentCategory) return false;
    const pid =
      typeof c.parentCategory === "string"
        ? c.parentCategory
        : c.parentCategory?._id;
    return pid === parent._id;
  });

  const allProducts = await fetchProductsByCategory(parent._id);

  // ✅ PUBLIC FILTER (MOST IMPORTANT)
  const visibleProducts = allProducts.filter(
    (p) => p.approvalStatus === "APPROVED" && p.isActive !== false
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold text-gray-900 capitalize">
        {parent.name}
      </h1>

      {/* Subcategory chips */}
      {subCategories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {subCategories.map((sub) => (
            <a
              key={sub._id}
              href={`/category/${parent.slug}/${sub.slug}`}
              className="px-3 py-1.5 rounded-full border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
            >
              {sub.name}
            </a>
          ))}
        </div>
      )}

      {/* Products */}
      {visibleProducts.length === 0 ? (
        <p className="mt-5 text-sm text-gray-600">
          No products found in this category.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {visibleProducts.map((p) => {
            const totalStock = calcTotalStock(p);

            return (
              <ProductCard
                key={p._id}
                product={{
                  _id: p._id,
                  title: p.title,
                  slug: p.slug,
                  featureImage: p.featureImage,
                  mrp: p.mrp,
                  salePrice: p.salePrice,

                  variants: p.variants || [],
                  totalStock,
                  inStock: totalStock > 0,

                  // ✅ SOLD BY SUPPORT
                  ownerType: p.ownerType,
                  vendorId: p.vendorId || null,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
