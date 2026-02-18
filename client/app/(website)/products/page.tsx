// app/website/products/page.tsx
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

async function fetchAllProducts(): Promise<ApiProduct[]> {
  if (!API_BASE) return [];
  const res = await fetch(`${API_BASE}/admin/products`, {
    cache: "no-store",
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []) as ApiProduct[];
}

export default async function AllProductsPage() {
  const products = await fetchAllProducts();
  return <AllProductsClient products={products} />;
}
