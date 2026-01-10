// components/website/RelatedProducts.tsx
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

async function fetchRelatedProducts(opts: {
  categoryId?: string | null;
  subCategoryId?: string | null;
}): Promise<ApiProduct[]> {
  if (!API_BASE) return [];

  // priority: subCategory first
  let url = "";
  if (opts.subCategoryId) {
    url = `${API_BASE}/admin/products?subCategoryId=${opts.subCategoryId}&active=true`;
  } else if (opts.categoryId) {
    url = `${API_BASE}/admin/products?categoryId=${opts.categoryId}&active=true`;
  } else {
    return [];
  }

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []) as ApiProduct[];
}

export default async function RelatedProducts({
  currentProductId,
  categoryId,
  subCategoryId,
  limit = 8,
  title = "Related Products",
}: {
  currentProductId: string;
  categoryId?: string | null;
  subCategoryId?: string | null;
  limit?: number;
  title?: string;
}) {
  const all = await fetchRelatedProducts({ categoryId, subCategoryId });

  // remove current product + limit
  const related = all.filter((p) => p._id !== currentProductId).slice(0, limit);

  if (related.length === 0) return null;

  return (
    <section className="bg-white px-4 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {related.map((p) => {
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
    </section>
  );
}
