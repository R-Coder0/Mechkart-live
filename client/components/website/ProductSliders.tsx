/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import ProductCard from "./ProductCard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;
const PRODUCTS_ENDPOINT = `${API_BASE}/admin/products`;

const ROW_SIZE = 6;
const INITIAL_MAX = 18;
const LOAD_MORE_STEP = 6;

function getInitialVisibleCount(total: number) {
  const capped = Math.min(total, INITIAL_MAX);
  return Math.floor(capped / ROW_SIZE) * ROW_SIZE;
}

export default function ProductSliders() {
  const [latestProducts, setLatestProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const isApprovedForPublic = (p: any) => {
    const status = String(p?.approvalStatus || "").toUpperCase();
    const activeOk = p?.isActive !== false;
    return status === "APPROVED" && activeOk;
  };

  useEffect(() => {
    const run = async () => {
      try {
        if (!API_BASE) {
          setLatestProducts([]);
          setVisibleCount(0);
          return;
        }

        setLoading(true);

        const res = await fetch(PRODUCTS_ENDPOINT, { cache: "no-store" });
        if (!res.ok) {
          setLatestProducts([]);
          setVisibleCount(0);
          return;
        }

        const data = await res.json();
        const list: any[] = data?.data || data?.products || [];

        const approvedOnly = Array.isArray(list) ? list.filter(isApprovedForPublic) : [];

        if (!approvedOnly.length) {
          setLatestProducts([]);
          setVisibleCount(0);
          return;
        }

        const sorted = [...approvedOnly].sort((a, b) => {
          const A = new Date(a?.createdAt || a?.created_at || 0).getTime();
          const B = new Date(b?.createdAt || b?.created_at || 0).getTime();
          return B - A;
        });

        setLatestProducts(sorted);
        setVisibleCount(getInitialVisibleCount(sorted.length));
      } catch {
        setLatestProducts([]);
        setVisibleCount(0);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const visibleProducts = useMemo(() => {
    return latestProducts.slice(0, visibleCount);
  }, [latestProducts, visibleCount]);

  const canLoadMore = useMemo(() => {
    return latestProducts.length > visibleCount;
  }, [latestProducts.length, visibleCount]);

  const handleLoadMore = () => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + LOAD_MORE_STEP, latestProducts.length));
      setIsLoadingMore(false);
    }, 400); // thoda lazy feeling ke liye delay
  };

  if (loading && latestProducts.length === 0) {
    return (
      <>
        <section className="w-full bg-[#E6F7FA] py-8">
          <div className="max-w-[1700px] mx-auto px-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[22px] font-bold text-[#003366]">
                Latest Products
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white border border-[#dcecf0] p-4 animate-pulse"
                >
                  <div className="aspect-square bg-gray-100 mb-4" />
                  <div className="h-4 bg-gray-100 rounded mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-2/3 mb-3" />
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="h-px bg-[#e4edf1] mx-auto max-w-[1700px]" />
      </>
    );
  }

  if (visibleProducts.length === 0) {
    return null;
  }

  return (
    <>
      <section className="w-full bg-[#E6F7FA] py-8">
        <div className="max-w-[1700px] mx-auto px-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[22px] font-bold text-[#003366]">
              Latest Products
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-5">
            {visibleProducts.map((p, i) => (
              <div
                key={p?._id || i}
                className="bg-white transition-opacity duration-300"
              >
                <ProductCard product={p} />
              </div>
            ))}
          </div>

          {canLoadMore && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="inline-flex items-center justify-center bg-[#003366] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#004a80] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="h-px bg-[#e4edf1] mx-auto max-w-[1700px]" />
    </>
  );
}