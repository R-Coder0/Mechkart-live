/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import ProductCard, { type ProductCardProduct } from "@/components/website/ProductCard";

export const dynamic = "force-dynamic";

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const API_BASE = RAW_BASE.endsWith("/api") ? RAW_BASE : `${RAW_BASE}/api`;

function norm(v: any) {
  return String(v ?? "").trim();
}

function useDebouncedValue<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

type ApiResp = {
  success?: boolean;
  message?: string;
  data?: {
    items?: any[];
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
};

export default function SearchPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const q = useMemo(() => norm(sp.get("q")), [sp]);
  const pageFromUrl = useMemo(() => {
    const p = parseInt(String(sp.get("page") ?? "1"), 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  }, [sp]);

  const dq = useDebouncedValue(q, 350);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ProductCardProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(pageFromUrl);
  const [limit] = useState(24);

  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // keep internal page synced with URL page
  useEffect(() => setPage(pageFromUrl), [pageFromUrl]);

  // reset page if query changes
  const prevQ = useRef<string>("");
  useEffect(() => {
    if (prevQ.current !== q) {
      prevQ.current = q;
      if (pageFromUrl !== 1) {
        router.replace(`/search?q=${encodeURIComponent(q)}&page=1`);
      }
    }
  }, [q, pageFromUrl, router]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        setError(null);

        if (!dq) {
          setItems([]);
          setTotal(0);
          setTotalPages(0);
          setLoading(false);
          return;
        }

        if (!API_BASE) throw new Error("NEXT_PUBLIC_API_URL is not set");

        setLoading(true);

        const url =
          `${API_BASE}/common/products/search` +
          `?q=${encodeURIComponent(dq)}` +
          `&page=${page}` +
          `&limit=${limit}`;

        const res = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });

        const json: ApiResp = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(json?.message || "Search failed");

        const data = json?.data ?? (json as any);
        const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];

        const mapped: ProductCardProduct[] = list.map((p: any) => ({
          _id: String(p?._id || ""),
          title: String(p?.title || ""),
          slug: String(p?.slug || ""),
          featureImage: p?.featureImage,
          mrp: Number(p?.mrp || 0),
          salePrice: Number(p?.salePrice || 0),
          totalStock:
            typeof p?.totalStock === "number"
              ? p.totalStock
              : typeof p?.baseStock === "number"
              ? p.baseStock
              : undefined,
          inStock:
            typeof p?.inStock === "boolean"
              ? p.inStock
              : (typeof p?.totalStock === "number" ? p.totalStock : p?.baseStock ?? 0) > 0,
          variants: Array.isArray(p?.variants) ? p.variants : [],
          ownerType: p?.ownerType,
          vendorId: p?.vendorId ?? null,
        }));

        if (!cancelled) {
          setItems(mapped.filter((x) => x._id && x.slug));
          setTotal(Number(data?.total ?? 0));
          setTotalPages(Number(data?.totalPages ?? 0));
        }
      } catch (e: any) {
        if (!cancelled && e?.name !== "AbortError") {
          setError(e?.message || "Failed");
          setItems([]);
          setTotal(0);
          setTotalPages(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [dq, page, limit]);

  const canPrev = page > 1;
  const canNext = totalPages ? page < totalPages : items.length === limit; // fallback if totalPages missing

  const goToPage = (p: number) => {
    const safe = Math.max(1, p);
    const qs = dq ? `q=${encodeURIComponent(dq)}&page=${safe}` : `page=${safe}`;
    router.push(`/search?${qs}`);
  };

  return (
    <div className="mx-auto max-w-[1400px] px-2 sm:px-2 py-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Search</h1>
          <p className="text-sm text-gray-600">
            {q ? (
              <>
                Results for: <span className="font-semibold text-gray-900">{q}</span>
                {total > 0 ? (
                  <span className="ml-2 text-gray-500">
                    • {total} result{total === 1 ? "" : "s"}
                  </span>
                ) : null}
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
            <div key={i} className="border border-gray-200 p-4 rounded-xl">
              <div className="aspect-square bg-gray-100 animate-pulse rounded-lg" />
              <div className="mt-3 h-4 bg-gray-100 animate-pulse rounded" />
              <div className="mt-2 h-4 w-24 bg-gray-100 animate-pulse rounded" />
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

          {q && items.length > 0 ? (
            <div className="mt-8 flex items-center justify-between gap-3">
              <div className="text-sm text-gray-600">
                Page <span className="font-semibold text-gray-900">{page}</span>
                {totalPages ? (
                  <>
                    {" "}
                    of <span className="font-semibold text-gray-900">{totalPages}</span>
                  </>
                ) : null}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!canPrev}
                  onClick={() => goToPage(page - 1)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition ${
                    canPrev
                      ? "bg-white text-gray-900 ring-gray-200 hover:ring-gray-300"
                      : "bg-gray-50 text-gray-400 ring-gray-100 cursor-not-allowed"
                  }`}
                >
                  Prev
                </button>

                <button
                  type="button"
                  disabled={!canNext}
                  onClick={() => goToPage(page + 1)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition ${
                    canNext
                      ? "bg-gray-900 text-white ring-gray-900 hover:opacity-90"
                      : "bg-gray-50 text-gray-400 ring-gray-100 cursor-not-allowed"
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
