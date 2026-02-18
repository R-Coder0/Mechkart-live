/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";

export type SortKey =
  | "relevance"
  | "newest"
  | "price_asc"
  | "price_desc"
  | "title_asc"
  | "title_desc";

export type ProductFilterState = {
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  sort?: SortKey;
};

type Props = {
  value: ProductFilterState;
  onChange: (next: ProductFilterState) => void;

  showSort?: boolean;
  title?: string;
  className?: string;

  priceMinLimit?: number;
  priceMaxLimit?: number;

  // Optional: mobile button label
  mobileButtonLabel?: string;
};

function toNum(v: any) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : undefined;
}

function countActive(value: ProductFilterState, showSort: boolean) {
  let c = 0;
  if (value.inStockOnly) c++;
  if (value.minPrice !== undefined) c++;
  if (value.maxPrice !== undefined) c++;
  if (showSort && value.sort && value.sort !== "relevance") c++;
  return c;
}

export default function ProductFilters({
  value,
  onChange,
  showSort = true,
  title = "Filters",
  className = "",
  priceMinLimit = 0,
  priceMaxLimit = 500000,
  mobileButtonLabel = "Filters",
}: Props) {
  const [draftMin, setDraftMin] = useState<string>("");
  const [draftMax, setDraftMax] = useState<string>("");

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setDraftMin(value.minPrice !== undefined ? String(value.minPrice) : "");
    setDraftMax(value.maxPrice !== undefined ? String(value.maxPrice) : "");
  }, [value.minPrice, value.maxPrice]);

  const activeCount = useMemo(() => countActive(value, showSort), [value, showSort]);

  const hasActive = activeCount > 0;

  const apply = () => {
    let minPrice = toNum(draftMin);
    let maxPrice = toNum(draftMax);

    if (minPrice !== undefined && minPrice < priceMinLimit) minPrice = priceMinLimit;
    if (maxPrice !== undefined && maxPrice > priceMaxLimit) maxPrice = priceMaxLimit;

    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      const t = minPrice;
      minPrice = maxPrice;
      maxPrice = t;
    }

    onChange({ ...value, minPrice, maxPrice });
  };

  const clearAll = () => {
    onChange({
      minPrice: undefined,
      maxPrice: undefined,
      inStockOnly: false,
      sort: "relevance",
    });
  };

  // shared inner UI (used in desktop + mobile drawer)
  const FiltersBody = (
    <div className="mt-4 space-y-4">
      {/* Price */}
      <div>
        <div className="text-xs font-semibold text-gray-900">Price range</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="border border-gray-200 bg-white px-3 py-2">
            <div className="text-[11px] text-gray-500">Min</div>
            <input
              inputMode="numeric"
              value={draftMin}
              onChange={(e) => setDraftMin(e.target.value.replace(/[^\d]/g, ""))}
              placeholder={`${priceMinLimit}`}
              className="mt-1 w-full text-sm outline-none"
            />
          </div>

          <div className="border border-gray-200 bg-white px-3 py-2">
            <div className="text-[11px] text-gray-500">Max</div>
            <input
              inputMode="numeric"
              value={draftMax}
              onChange={(e) => setDraftMax(e.target.value.replace(/[^\d]/g, ""))}
              placeholder={`${priceMaxLimit}`}
              className="mt-1 w-full text-sm outline-none"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={apply}
          className="mt-2 w-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Apply price
        </button>
      </div>

      {/* Stock */}
      <div className="border border-gray-100 bg-gray-50 p-3">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">In stock only</div>
            <div className="text-xs text-gray-500">Hide unavailable items</div>
          </div>
          <input
            type="checkbox"
            checked={Boolean(value.inStockOnly)}
            onChange={(e) => onChange({ ...value, inStockOnly: e.target.checked })}
            className="h-5 w-5"
          />
        </label>
      </div>

      {/* Sort */}
      {showSort ? (
        <div>
          <div className="text-xs font-semibold text-gray-900">Sort</div>
          <select
            value={value.sort ?? "relevance"}
            onChange={(e) => onChange({ ...value, sort: e.target.value as SortKey })}
            className="mt-2 w-full border border-gray-200 bg-white px-3 py-2 text-sm outline-none"
          >
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="title_asc">Title: A to Z</option>
            <option value="title_desc">Title: Z to A</option>
          </select>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {/* ✅ MOBILE: Top bar button (filters hidden by default) */}
      <div className={`lg:hidden ${className}`}>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex items-center gap-2 border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
          >
            {mobileButtonLabel}
            {activeCount > 0 ? (
              <span className="ml-1 inline-flex min-w-[22px] items-center justify-center rounded-full bg-gray-900 px-2 py-0.5 text-[11px] font-bold text-white">
                {activeCount}
              </span>
            ) : null}
          </button>

          {hasActive ? (
            <button
              type="button"
              onClick={clearAll}
              className="text-sm font-semibold text-gray-700 hover:underline"
            >
              Clear
            </button>
          ) : (
            <div className="text-xs text-gray-500"> </div>
          )}
        </div>
      </div>

      {/* ✅ DESKTOP: Sidebar */}
      <aside className={`hidden lg:block w-full ${className}`}>
        <div className="border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">{title}</div>
              <div className="text-xs text-gray-500">Refine results</div>
            </div>

            {hasActive ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-semibold text-gray-700 hover:underline"
              >
                Clear all
              </button>
            ) : null}
          </div>

          {FiltersBody}
        </div>
      </aside>

      {/* ✅ MOBILE DRAWER */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          {/* overlay */}
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/40"
          />

          {/* sheet */}
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-auto bg-white shadow-2xl">
            <div className="border-b border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-gray-900">{title}</div>
                  <div className="text-xs text-gray-500">Refine results</div>
                </div>

                <div className="flex items-center gap-3">
                  {hasActive ? (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-sm font-semibold text-gray-700 hover:underline"
                    >
                      Clear
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="text-sm font-semibold text-gray-900"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* quick apply button */}
              <button
                type="button"
                onClick={() => {
                  apply();
                  setMobileOpen(false);
                }}
                className="mt-3 w-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Apply filters
              </button>
            </div>

            <div className="p-4">{FiltersBody}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
