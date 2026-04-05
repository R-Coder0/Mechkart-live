/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import ProductCard from "@/components/website/ProductCard";
import ProductFilters, {
  type ProductFilterState,
  type SortKey,
} from "@/components/website/ProductFilters";
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
  vendorId?: {
    company?: { name?: string };
  };
};

function calcTotalStock(p: ApiProduct) {
  if (p.variants && p.variants.length > 0) {
    return p.variants.reduce((sum, v) => sum + Number(v.quantity ?? 0), 0);
  }
  return Number(p.totalStock ?? p.baseStock ?? 0);
}

function getDisplayPrice(p: ApiProduct) {
  const baseMrp = Number(p.mrp ?? 0);
  const baseSale = Number(p.salePrice ?? 0);

  const vars = Array.isArray(p.variants) ? p.variants : [];
  if (vars.length > 0) {
    const prices = vars
      .map((v) => Number(v.salePrice ?? v.mrp ?? 0))
      .filter((x) => x > 0);

    const minVar = prices.length ? Math.min(...prices) : 0;
    return minVar || baseSale || baseMrp || 0;
  }

  return baseSale || baseMrp || 0;
}

function sortProducts(list: ApiProduct[], sort: SortKey) {
  const arr = [...list];

  switch (sort) {
    case "newest":
      return arr;
    case "price_asc":
      return arr.sort((a, b) => getDisplayPrice(a) - getDisplayPrice(b));
    case "price_desc":
      return arr.sort((a, b) => getDisplayPrice(b) - getDisplayPrice(a));
    case "title_asc":
      return arr.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    case "title_desc":
      return arr.sort((a, b) => String(b.title).localeCompare(String(a.title)));
    case "relevance":
    default:
      return arr;
  }
}

export default function AllProductsClient({
  products,
  minPrice,
  maxPrice,
}: {
  products: ApiProduct[];
  minPrice?: number;
  maxPrice?: number;
}) {
  const visibleProducts = useMemo(
    () =>
      products.filter(
        (p) => p.approvalStatus === "APPROVED" && p.isActive !== false
      ),
    [products]
  );

  const [filters, setFilters] = useState<ProductFilterState>({
    minPrice:
      typeof minPrice === "number" && !Number.isNaN(minPrice)
        ? minPrice
        : undefined,
    maxPrice:
      typeof maxPrice === "number" && !Number.isNaN(maxPrice)
        ? maxPrice
        : undefined,
    inStockOnly: false,
    sort: "relevance",
  });

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      minPrice:
        typeof minPrice === "number" && !Number.isNaN(minPrice)
          ? minPrice
          : undefined,
      maxPrice:
        typeof maxPrice === "number" && !Number.isNaN(maxPrice)
          ? maxPrice
          : undefined,
    }));
  }, [minPrice, maxPrice]);

  const filtered = useMemo(() => {
    let list = visibleProducts;

    if (filters.inStockOnly) {
      list = list.filter((p) => calcTotalStock(p) > 0);
    }

    const min =
      typeof filters.minPrice === "number" ? filters.minPrice : undefined;
    const max =
      typeof filters.maxPrice === "number" ? filters.maxPrice : undefined;

    if (min !== undefined) {
      list = list.filter((p) => getDisplayPrice(p) >= min);
    }

    if (max !== undefined) {
      list = list.filter((p) => getDisplayPrice(p) <= max);
    }

    const sortKey = (filters.sort ?? "relevance") as SortKey;
    return sortProducts(list, sortKey);
  }, [visibleProducts, filters]);

  return (
    <div className="max-w-[1500px] mx-auto px-4 py-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {typeof minPrice === "number" && typeof maxPrice === "number"
              ? `Products ₹${minPrice} - ₹${maxPrice}`
              : typeof minPrice === "number"
              ? `Products Above ₹${minPrice}`
              : "All Products"}
          </h1>

          <p className="mt-1 text-sm text-gray-600">
            Showing{" "}
            <span className="font-semibold text-gray-900">
              {filtered.length}
            </span>{" "}
            product{filtered.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="lg:sticky lg:top-4 h-fit">
          <ProductFilters
            title="Filters"
            value={filters}
            onChange={setFilters}
            showSort={true}
            priceMinLimit={0}
            priceMaxLimit={500000}
          />
        </div>

        <div>
          {filtered.length === 0 ? (
            <div className="rounded-2xl border bg-white p-6 text-sm text-gray-700">
              No products match your filters.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filtered.map((p) => {
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
                      ownerType: p.ownerType,
                      vendorId: p.vendorId || null,
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}