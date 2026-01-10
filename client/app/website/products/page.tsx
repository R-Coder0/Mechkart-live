// app/website/products/page.tsx
import ProductCard from "@/components/website/ProductCard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

type ApiVariant = {
  _id?: string;
  label?: string;
  size?: string;
  weight?: string;
  color?: string;
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
  variants?: ApiVariant[];
};

function calcTotalStock(p: ApiProduct) {
  if (p.variants && p.variants.length > 0) {
    return p.variants.reduce((sum, v) => sum + Number(v.quantity ?? 0), 0);
  }
  return Number(p.baseStock ?? 0);
}

async function fetchAllProducts(): Promise<ApiProduct[]> {
  if (!API_BASE) return [];
  const res = await fetch(`${API_BASE}/admin/products?active=true`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []) as ApiProduct[];
}

export default async function AllProductsPage() {
  const products = await fetchAllProducts();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold text-gray-900">All Products</h1>

      {products.length === 0 ? (
        <p className="mt-5 text-sm text-gray-600">No products found.</p>
      ) : (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {products.map((p) => {
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
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
