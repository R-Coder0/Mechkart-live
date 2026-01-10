/* eslint-disable @typescript-eslint/no-explicit-any */
// app/website/product/[slug]/page.tsx
import RelatedProducts from "@/components/website/RelatedProducts";
import ProductDetailsClient from "./product-details-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

type ApiCategory = { _id: string; name: string; slug: string };

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

type ApiColor = {
  _id?: string;
  name: string;
  hex?: string;
  orderIndex?: number;
  images?: string[];
};

type ApiProduct = {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  features?: any; // ✅ allow string | array | object (as in ProductDetailsClient)

  featureImage?: string;
  galleryImages?: string[];

  mrp?: number;
  salePrice?: number;

  baseStock?: number;
  lowStockThreshold?: number;

  category?: ApiCategory;
  subCategory?: ApiCategory;

  variants?: ApiVariant[];

  // ✅ NEW: for color option + gallery switching
  colors?: ApiColor[];
};

async function fetchProductBySlug(slug: string): Promise<ApiProduct | null> {
  if (!API_BASE) return null;

  const res = await fetch(`${API_BASE}/admin/products/slug/${slug}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;
  const data = await res.json();
  return (data.data || null) as ApiProduct | null;
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await fetchProductBySlug(slug);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10 overflow-x-hidden">
        <h1 className="text-xl font-semibold text-gray-900">Product not found</h1>
        <p className="mt-2 text-sm text-gray-600">
          The product you are looking for does not exist or is not available.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 overflow-x-hidden">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-600 flex flex-wrap items-center gap-2">
        <a className="hover:underline" href="/website">
          Home
        </a>
        <span>/</span>

        {product.category?.slug ? (
          <>
            <a className="hover:underline" href={`/website/category/${product.category.slug}`}>
              {product.category.name}
            </a>
            <span>/</span>
          </>
        ) : null}

        {product.subCategory?.slug && product.category?.slug ? (
          <>
            <a
              className="hover:underline"
              href={`/website/category/${product.category.slug}/${product.subCategory.slug}`}
            >
              {product.subCategory.name}
            </a>
            <span>/</span>
          </>
        ) : null}

        <span className="text-gray-900 font-medium">{product.title}</span>
      </div>

      {/* ✅ ProductDetailsClient now expects colors + flexible features */}
      <ProductDetailsClient product={product} />

      <RelatedProducts
        currentProductId={product._id}
        categoryId={product.category?._id || null}
        subCategoryId={product.subCategory?._id || null}
        limit={8}
      />
    </div>
  );
}
