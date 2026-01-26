/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

const resolveImageUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const apiBase = API_BASE || "";
  const host = apiBase.replace(/\/api\/?$/, "");
  if (path.startsWith("/")) return `${host}${path}`;
  return `${host}/${path}`;
};

function truncateText(text: string, limit: number) {
  if (!text) return "";
  return text.length > limit ? text.slice(0, limit) + "..." : text;
}

export type ProductCardVariant = {
  _id?: string;
  label?: string;
  size?: string;
  weight?: string;
  comboText?: string;
  mrp?: number;
  salePrice?: number;
  quantity?: number;
  images?: string[];
  image?: string;
  featureImage?: string;
};

type PopulatedVendor = {
  _id?: string;
  company?: { name?: string };
};

export type ProductCardProduct = {
  _id: string;
  title: string;
  slug: string;

  featureImage?: string;
  mrp?: number;
  salePrice?: number;

  totalStock?: number;
  inStock?: boolean;

  variants?: ProductCardVariant[];

  ownerType?: "ADMIN" | "VENDOR";

  // ✅ IMPORTANT: Product model field is vendorId
  vendorId?: string | PopulatedVendor | null;
  // ✅ keep vendor object that UI uses
  vendor?: {
    company?: {
      name?: string;
    };
  };
  // optional if you later add
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
};

function calcDiscountPercent(mrp?: number, sale?: number) {
  const M = Number(mrp ?? 0);
  const S = Number(sale ?? 0);
  if (!M || !S || M <= S) return 0;
  return Math.round(((M - S) / M) * 100);
}

function firstTruthy(...vals: Array<string | undefined | null>) {
  return vals.find((v) => typeof v === "string" && v.trim().length > 0)?.trim();
}

function cleanImgPath(p?: any) {
  if (p === undefined || p === null) return "";
  const s = String(p).trim();
  if (!s) return "";
  const low = s.toLowerCase();
  if (low === "undefined" || low === "null") return "";
  return s;
}

function getVariantFirstImage(v?: ProductCardVariant | null) {
  if (!v) return "";
  return (
    cleanImgPath(v.images?.[0]) ||
    cleanImgPath(v.featureImage) ||
    cleanImgPath(v.image) ||
    ""
  );
}

export default function ProductCard({ product }: { product: ProductCardProduct }) {
  const variants = product.variants || [];
  const hasVariants = variants.length > 0;

  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    variants[0]?._id
  );

  const selectedVariant = useMemo(() => {
    if (!hasVariants) return null;
    return variants.find((v) => v._id === selectedVariantId) || variants[0] || null;
  }, [hasVariants, variants, selectedVariantId]);

  // ✅ sold by: supports populated vendorId object
  const soldBy = useMemo(() => {
    if (product.ownerType === "ADMIN") return "Mechkart";

    const v = product.vendorId;
    const name =
      typeof v === "object" && v
        ? v.company?.name?.trim()
        : "";

    return name || "Mechkart";
  }, [product.ownerType, product.vendorId]);

  // stock
  const baseOut =
    product.inStock === false ||
    (typeof product.totalStock === "number" && product.totalStock <= 0);

  const variantOut =
    hasVariants && selectedVariant ? Number(selectedVariant.quantity ?? 0) <= 0 : false;

  const isOut = baseOut || variantOut;

  // price (variant first, fallback product)
  const baseMrp = Number(product.mrp ?? 0);
  const baseSale = Number(product.salePrice ?? 0);

  const displayMrp = hasVariants ? Number(selectedVariant?.mrp ?? 0) || baseMrp : baseMrp;
  const displaySaleRaw = hasVariants ? Number(selectedVariant?.salePrice ?? 0) : baseSale;
  const displaySale = displaySaleRaw > 0 ? displaySaleRaw : displayMrp;

  const off = calcDiscountPercent(displayMrp, displaySale);

  // image (variant image -> product feature image)
  const rawVariantImg = hasVariants ? getVariantFirstImage(selectedVariant) : "";
  const rawProductImg = cleanImgPath(product.featureImage);
  const img = resolveImageUrl(rawVariantImg || rawProductImg);

  const variantChips = useMemo(() => {
    return variants
      .map((v) => ({
        id: v._id,
        text: firstTruthy(v.label, v.comboText, v.size, v.weight),
        qty: Number(v.quantity ?? 0),
      }))
      .filter((x) => !!x.text);
  }, [variants]);

  const TITLE_LIMIT = 35;
  const titleShort = truncateText(product.title, TITLE_LIMIT);

  return (
    <div className="group">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative overflow-hidden transition hover:shadow-xl p-4 border border-gray-200">
          <div className="relative aspect-square bg-gray-50">
            {img ? (
              <img
                key={img}
                src={img}
                alt={product.title}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">
                No Image
              </div>
            )}

            <div className="absolute left-3 top-3 flex flex-col gap-2">
              {off > 0 && (
                <span className="inline-flex w-fit items-center rounded-full bg-black/80 px-2.5 py-1 text-[11px] font-semibold text-white">
                  {off}% OFF
                </span>
              )}

              {isOut && (
                <span className="inline-flex w-fit items-center rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-gray-900 ring-1 ring-gray-200">
                  Out of stock
                </span>
              )}
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-[14px] font-semibold leading-snug text-gray-900" title={product.title}>
              {titleShort}
            </h3>

            <div className="mt-1 text-[12px] text-gray-600">
              <span className="text-gray-500">Sold by:</span>{" "}
              <span className="font-semibold text-gray-800">{soldBy}</span>
            </div>

            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="flex items-end gap-2">
                <div className="text-[16px] font-bold text-gray-900">
                  ₹{Number(displaySale ?? 0).toFixed(0)}
                </div>

                {displayMrp > 0 && displaySale > 0 && displayMrp > displaySale && (
                  <div className="text-[12px] text-gray-500 line-through">
                    ₹{Number(displayMrp).toFixed(0)}
                  </div>
                )}
              </div>

              {displayMrp > 0 && displaySale > 0 && displayMrp > displaySale && (
                <div className="text-[12px] font-semibold text-emerald-700">
                  Save ₹{Number(displayMrp - displaySale).toFixed(0)}
                </div>
              )}
            </div>

            <div className="min-h-[42px]">
              {hasVariants && variantChips.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {variantChips.slice(0, 2).map((v) => {
                    const active = v.id && v.id === selectedVariantId;
                    const disabled = v.qty <= 0;

                    return (
                      <button
                        key={v.id || v.text}
                        type="button"
                        disabled={disabled}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (v.id) setSelectedVariantId(v.id);
                        }}
                        className={`mt-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition
                          ${active ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-700 ring-gray-200 hover:ring-gray-300"}
                          ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                        title={disabled ? "Out of stock" : v.text}
                      >
                        {v.text}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="invisible text-[11px]">placeholder</div>
              )}
            </div>

            {hasVariants && selectedVariant && (
              <div className="mt-2 text-[12px] text-gray-500">
                {Number(selectedVariant.quantity ?? 0) > 0 ? "In stock" : "Currently unavailable"}
              </div>
            )}

            {!hasVariants && typeof product.totalStock === "number" && (
              <div className="mt-2 text-[12px] text-gray-500">
                {product.totalStock > 0 ? "In stock" : "Currently unavailable"}
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
