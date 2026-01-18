/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ProductCard, { type ProductCardProduct } from "@/components/website/ProductCard";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

function norm(v: any) {
  return String(v ?? "").trim();
}

export default function SearchPage() {
  const sp = useSearchParams();
  const q = useMemo(() => norm(sp.get("q")), [sp]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProductCardProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        if (!q) {
          setItems([]);
          return;
        }

        const res = await fetch(
          `${API_BASE}/common/products/search?q=${encodeURIComponent(q)}&page=1&limit=24`,
          { credentials: "include", cache: "no-store" }
        );

        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || "Search failed");

        const data = json?.data ?? json;
        const list = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);

        // map to ProductCardProduct shape (fallback safe)
        const mapped: ProductCardProduct[] = list.map((p: any) => ({
          _id: String(p?._id),
          title: String(p?.title || ""),
          slug: String(p?.slug || ""),
          featureImage: p?.featureImage,
          mrp: Number(p?.mrp || 0),
          salePrice: Number(p?.salePrice || 0),
          totalStock: typeof p?.totalStock === "number" ? p.totalStock : (typeof p?.baseStock === "number" ? p.baseStock : undefined),
          inStock: p?.inStock,
          variants: Array.isArray(p?.variants) ? p.variants : [],
        }));

        setItems(mapped.filter((x) => x._id && x.slug));
      } catch (e: any) {
        setError(e?.message || "Failed");
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [q]);

  return (
    <div className="mx-auto max-w-[1400px] px-2 sm:px-2 py-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Search</h1>
          <p className="text-sm text-gray-600">
            {q ? (
              <>
                Results for: <span className="font-semibold text-gray-900">{q}</span>
              </>
            ) : (
              "Type something in the search box"
            )}
          </p>
        </div>

        <Link href="/" className="text-sm font-semibold text-gray-700 hover:underline">
          Back to home
        </Link>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="border border-gray-200 p-4">
              <div className="aspect-square bg-gray-100 animate-pulse" />
              <div className="mt-3 h-4 bg-gray-100 animate-pulse" />
              <div className="mt-2 h-4 w-24 bg-gray-100 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {q && !items.length ? (
            <div className="mt-6 rounded-2xl border bg-white p-6 text-sm text-gray-700">
              No products found for <span className="font-semibold">{q}</span>.
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
