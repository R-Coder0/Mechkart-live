// app/website/products/page.tsx

export const dynamic = "force-dynamic"; // 🔥 VERY IMPORTANT

import ProductCard from "@/components/website/ProductCard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

type ApiVariant = {
  _id?: string;
  label?: string;
  size?: string;
  weight?: string;
  comboText?: string;
  mrp?: number;
  salePrice?: number;
  quantity?: number;
  images?: string[];
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

  // ✅ moderation fields
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

function calcTotalStock(p: ApiProduct) {
  if (p.variants && p.variants.length > 0) {
    return p.variants.reduce((sum, v) => sum + Number(v.quantity ?? 0), 0);
  }
  return Number(p.totalStock ?? p.baseStock ?? 0);
}

async function fetchAllProducts(): Promise<ApiProduct[]> {
  if (!API_BASE) return [];

  const res = await fetch(`${API_BASE}/admin/products`, {
    cache: "no-store",
    next: { revalidate: 0 }, // 🔥 force fresh data
  });

  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []) as ApiProduct[];
}

export default async function AllProductsPage() {
  const products = await fetchAllProducts();

  // ✅ frontend safety filter (public rules)
  const visibleProducts = products.filter(
    (p) => p.approvalStatus === "APPROVED" && p.isActive !== false
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold text-gray-900">All Products</h1>

      {visibleProducts.length === 0 ? (
        <p className="mt-5 text-sm text-gray-600">No products found.</p>
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

                  // ✅ THIS is why Sold By works
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
  