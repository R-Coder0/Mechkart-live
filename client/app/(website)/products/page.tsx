export const dynamic = "force-dynamic";

import AllProductsClient from "@/components/website/AllProductsClient";

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
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  isActive?: boolean;
  ownerType?: "ADMIN" | "VENDOR";
  vendorId?: { company?: { name?: string } };
};

async function fetchAllProducts(minPrice?: number, maxPrice?: number): Promise<ApiProduct[]> {
  if (!API_BASE) return [];

  const url = new URL(`${API_BASE}/admin/products`);

  if (typeof minPrice === "number" && !Number.isNaN(minPrice)) {
    url.searchParams.set("minPrice", String(minPrice));
  }

  if (typeof maxPrice === "number" && !Number.isNaN(maxPrice)) {
    url.searchParams.set("maxPrice", String(maxPrice));
  }

  const res = await fetch(url.toString(), {
    cache: "no-store",
    next: { revalidate: 0 },
  });

  if (!res.ok) return [];

  const data = await res.json();
  return (data.data || []) as ApiProduct[];
}

export default async function AllProductsPage({
  searchParams,
}: {
  searchParams?: Promise<{ minPrice?: string; maxPrice?: string }>;
}) {
  const params = await searchParams;

  const minPrice = params?.minPrice ? Number(params.minPrice) : undefined;
  const maxPrice = params?.maxPrice ? Number(params.maxPrice) : undefined;

  const products = await fetchAllProducts(minPrice, maxPrice);

  return (
    <AllProductsClient
      key={`${minPrice ?? "all"}-${maxPrice ?? "all"}`}
      products={products}
      minPrice={minPrice}
      maxPrice={maxPrice}
    />
  );
}