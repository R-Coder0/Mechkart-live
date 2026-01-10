/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

const resolveImageUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const apiBase = API_BASE || "";
  const host = apiBase.replace(/\/api\/?$/, "");
  if (path.startsWith("/")) return `${host}${path}`;
  return `${host}/${path}`;
};

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
  [key: string]: any;
};

type ApiCategory = { _id: string; name: string; slug: string };

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

  features?: string | string[] | Record<string, any>;

  featureImage?: string;
  galleryImages?: string[];

  mrp?: number;
  salePrice?: number;

  baseStock?: number;
  lowStockThreshold?: number;

  category?: ApiCategory;
  subCategory?: ApiCategory;

  variants?: ApiVariant[];

  // ✅ NEW: product-level colors (from backend)
  colors?: ApiColor[];
};

function calcDiscountPercent(mrp?: number, sale?: number) {
  const M = Number(mrp ?? 0);
  const S = Number(sale ?? 0);
  if (!M || !S || M <= S) return 0;
  return Math.round(((M - S) / M) * 100);
}

function formatINR(n: number) {
  try {
    return new Intl.NumberFormat("en-IN").format(Math.round(n));
  } catch {
    return String(Math.round(n));
  }
}

// TODO: replace with your real cart system
async function addToCartApi(args: {
  productId: string;
  qty: number;
  variantId?: string;
  colorKey?: string | null;
  // ✅ NEW (for buy-now selection flow)
  selectOnAdd?: boolean;
  clearOthers?: boolean;
}) {
  const { productId, qty, variantId, colorKey } = args;

  if (!productId) throw new Error("Missing productId");

  // if product has variants, variantId must be there
  // (we’ll validate again before calling)
  const res = await fetch(`${API_BASE}/common/cart/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // ✅ important for guest cart cookie
    body: JSON.stringify({
      productId,
      variantId,
      colorKey: colorKey || null,
      qty,
       // ✅ new flags
  selectOnAdd: Boolean(args.selectOnAdd),
  clearOthers: Boolean(args.clearOthers),
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || "Add to cart failed");
  }

  // optional: for header cart badge refresh
  if (typeof window !== "undefined") window.dispatchEvent(new Event("cart:updated"));

  return data?.data ?? data;
}


function AccordionItem({
  title,
  subtitle = "Overview and product details",
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-200">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between py-4 text-left"
      >
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-gray-900">{title}</div>
          <div className="mt-0.5 text-[12px] text-gray-500">{subtitle}</div>
        </div>

        <ChevronDown
          size={18}
          className={`shrink-0 text-gray-600 transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"
            }`}
        />
      </button>

      <div
        className={`grid transition-all duration-200 ease-in-out ${open ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr] pb-0"
          }`}
      >
        <div className="overflow-hidden">
          <div className="text-[13px] text-gray-700 leading-relaxed wrap-break-word">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturesBlock({ features }: { features?: ApiProduct["features"] }) {
  if (!features) return <div className="text-gray-600">No specifications available.</div>;

  if (Array.isArray(features)) {
    return (
      <ul className="list-disc pl-5 space-y-2 text-[13px] leading-6">
        {features.map((f, i) => (
          <li key={i} className="wrap-break-word">
            {String(f)}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof features === "object") {
    const entries = Object.entries(features);
    return (
      <div className="border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <tbody>
            {entries.map(([k, v], idx) => (
              <tr key={k} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="w-[40%] px-4 py-3 font-semibold text-gray-800 text-[13px] wrap-break-word">
                  {k}
                </td>
                <td className="px-4 py-3 text-gray-700 text-[13px] wrap-break-word">
                  {typeof v === "string" || typeof v === "number" ? String(v) : JSON.stringify(v)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const text = String(features).trim();
  const maybeLines = text.split("\n").map((x) => x.trim()).filter(Boolean);

  if (maybeLines.length >= 3) {
    return (
      <ul className="list-disc pl-5 space-y-2 text-[13px] leading-6">
        {maybeLines.map((l, i) => (
          <li key={i} className="wrap-break-word">
            {l.replace(/^[-•]\s*/, "")}
          </li>
        ))}
      </ul>
    );
  }

  return <div className="text-gray-700 whitespace-pre-line text-[13px] leading-6 wrap-break-word">{text}</div>;
}

/** -------- Variant helpers -------- **/

const META_KEYS = new Set([
  "_id",
  "mrp",
  "salePrice",
  "quantity",
  "images",
  "__v",
  "createdAt",
  "updatedAt",
]);

function norm(v: any) {
  return String(v ?? "").trim();
}
function normKey(v: any) {
  return norm(v).toLowerCase();
}
function firstTruthy(...vals: Array<string | undefined | null>) {
  return vals.find((v) => typeof v === "string" && v.trim().length > 0)?.trim();
}

function uniqueValues(variants: ApiVariant[], key: string) {
  const set = new Set<string>();
  for (const v of variants) {
    const val = norm(v?.[key]);
    if (val) set.add(val);
  }
  return Array.from(set);
}

/**
 * ✅ UPDATED: optionKeys now excludes "color"
 * - color ka UI separate rahega (product.colors / variants.color)
 */
function getOptionKeys(variants: ApiVariant[]) {
  const keys = new Set<string>();

  for (const v of variants) {
    Object.keys(v || {}).forEach((k) => {
      if (META_KEYS.has(k)) return;
      if (k === "label") return;
      if (k === "color") return; // ✅ separate color selector
      const val = v[k];
      if (val === null || val === undefined) return;
      if (Array.isArray(val)) return;
      if (typeof val === "object") return;
      if (!norm(val)) return;
      keys.add(k);
    });
  }

  const filtered = Array.from(keys).filter((k) => uniqueValues(variants, k).length >= 2);

  const preferred = ["comboText", "size", "weight"]; // color removed
  filtered.sort((a, b) => {
    const ai = preferred.indexOf(a);
    const bi = preferred.indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.localeCompare(b);
  });

  return filtered;
}

function findMatchingVariant(variants: ApiVariant[], selections: Record<string, string>) {
  const directId = selections.__variantId?.trim();
  if (directId) {
    const byId = variants.find((v) => String(v._id || "") === directId);
    return byId || variants[0] || null;
  }

  const keys = Object.keys(selections).filter((k) => k !== "__variantId" && selections[k]);
  if (!keys.length) return variants[0] || null;

  const exact = variants.find((v) =>
    keys.every((k) => {
      const selVal = selections[k];
      if (!selVal) return true;
      const vVal = norm(v?.[k]);
      if (!vVal) return true;
      return normKey(vVal) === normKey(selVal);
    })
  );

  return exact || variants[0] || null;
}

function variantDisplayText(v: ApiVariant) {
  return (
    firstTruthy(
      v.label,
      v.comboText,
      v.size && v.color ? `${v.size} / ${v.color}` : undefined,
      v.size,
      v.color,
      v.weight
    ) || "Variant"
  );
}

/** Stock status helpers (no numbers in UI) */
function getStockStatus(qty: number, threshold: number) {
  if (qty <= 0) return "OUT" as const;
  if (qty <= threshold) return "LOW" as const;
  return "IN" as const;
}
function statusBadge(status: "IN" | "LOW" | "OUT") {
  if (status === "OUT") {
    return { text: "Out of stock", cls: "bg-red-50 text-red-700 border border-red-200" };
  }
  if (status === "LOW") {
    return { text: "Low stock", cls: "bg-amber-50 text-amber-800 border border-amber-200" };
  }
  return { text: "In stock", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
}

export default function ProductDetailsClient({ product }: { product: ApiProduct }) {
  const variants = product.variants || [];
  const hasVariants = variants.length > 0;

  const threshold = Number(product.lowStockThreshold ?? 5);

  /** ✅ COLORS (product.colors preferred, else derive from variants.color) */
  const colors: ApiColor[] = useMemo(() => {
    const fromProduct = (product.colors || [])
      .filter((c) => (c?.name || "").trim())
      .slice()
      .sort((a, b) => Number(a.orderIndex ?? 0) - Number(b.orderIndex ?? 0));

    if (fromProduct.length) return fromProduct;

    // fallback: derive from variants.color
    const set = new Set<string>();
    for (const v of variants) {
      const c = norm(v.color);
      if (c) set.add(c);
    }
    return Array.from(set).map((name, idx) => ({ name, orderIndex: idx, images: [] }));
  }, [product.colors, variants]);

  const hasColors = colors.length > 0;

  const optionKeys = useMemo(() => (hasVariants ? getOptionKeys(variants) : []), [hasVariants, variants]);

  const initialSelections = useMemo(() => {
    const init: Record<string, string> = {};
    if (!hasVariants) return init;

    const v0 = variants[0] || {};

    // set non-color keys (comboText/size/weight...)
    for (const k of optionKeys) {
      const val = norm(v0[k]);
      if (val) init[k] = val;
    }

    // set color selection (if exists)
    const vColor = norm(v0.color);
    if (vColor) init.color = vColor;
    else if (hasColors) init.color = norm(colors[0]?.name);

    return init;
  }, [hasVariants, optionKeys, variants, hasColors, colors]);

  const [selections, setSelections] = useState<Record<string, string>>(initialSelections);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addedOnce, setAddedOnce] = useState(false);


  useEffect(() => {
    setSelections(initialSelections);
  }, [product._id, initialSelections]);

  const selectedVariant = useMemo(() => {
    if (!hasVariants) return null;
    return findMatchingVariant(variants, selections);
  }, [hasVariants, variants, selections]);

  const [qty, setQty] = useState(1);

  // Stock (status only)
  const baseStock = Number(product.baseStock ?? 0);
  const currentQty = hasVariants ? Number(selectedVariant?.quantity ?? 0) : baseStock;

  const stockStatus = getStockStatus(currentQty, threshold);
  const badge = statusBadge(stockStatus);
  const isOut = stockStatus === "OUT";

  // Price
  const baseMrp = Number(product.mrp ?? 0);
  const baseSale = Number(product.salePrice ?? 0);

  const displayMrp = hasVariants ? Number(selectedVariant?.mrp ?? 0) || baseMrp : baseMrp;
  const displaySaleRaw = hasVariants ? Number(selectedVariant?.salePrice ?? 0) : baseSale;
  const displaySale = displaySaleRaw > 0 ? displaySaleRaw : displayMrp;

  const off = calcDiscountPercent(displayMrp, displaySale);

  /** ✅ Selected Color (used to switch gallery) */
  const selectedColorName = useMemo(() => {
    const sel = norm(selections.color);
    if (sel) return sel;
    return norm(selectedVariant?.color) || norm(colors[0]?.name) || "";
  }, [selections.color, selectedVariant?.color, colors]);

  const selectedColor = useMemo(() => {
    if (!selectedColorName) return null;
    const byName = colors.find((c) => normKey(c.name) === normKey(selectedColorName));
    return byName || null;
  }, [colors, selectedColorName]);

  /** ✅ Images merge order (THIS is the gallery switching you asked):
   * 1) selected color images (top priority)
   * 2) selected variant images
   * 3) product gallery images
   * 4) feature image
   */
  const images = useMemo(() => {
    const colorImgs = (selectedColor?.images || []).filter(Boolean);
    const varImgs = (selectedVariant?.images || []).filter(Boolean);
    const gallery = (product.galleryImages || []).filter(Boolean);
    const feature = product.featureImage ? [product.featureImage] : [];

    // ✅ RULE:
    // 1) color images exist -> only color images
    // 2) else variant images exist -> only variant images
    // 3) else fallback -> base gallery + feature
    let chosen: string[] = [];

    if (colorImgs.length > 0) chosen = colorImgs;
    else if (varImgs.length > 0) chosen = varImgs;
    else chosen = [...gallery, ...feature];

    // unique while preserving order
    const seen = new Set<string>();
    const out: string[] = [];
    for (const x of chosen) {
      if (!x) continue;
      if (seen.has(x)) continue;
      seen.add(x);
      out.push(x);
    }
    return out;
  }, [
    selectedColor?.images,
    selectedVariant?.images,
    product.galleryImages,
    product.featureImage,
  ]);

  const [activeImg, setActiveImg] = useState<string>("");

  useEffect(() => {
    if (!images.length) {
      setActiveImg("");
      return;
    }
    setActiveImg((prev) => (prev && images.includes(prev) ? prev : images[0] || ""));
  }, [images]);

  // Accordion
  const [openKey, setOpenKey] = useState<"desc" | "feat" | "refund" | "ship" | null>(null);
  const toggleKey = (k: "desc" | "feat" | "refund" | "ship") => setOpenKey((prev) => (prev === k ? null : k));

  const handleAddToCart = async () => {
    if (isOut) return;

    // ✅ variantId required if variants exist
    if (hasVariants && !selectedVariant?._id) {
      setAddError("Please select a variant");
      return;
    }

    setAdding(true);
    setAddError(null);

    try {
      await addToCartApi({
        productId: product._id,
        qty,
        variantId: hasVariants ? String(selectedVariant?._id) : undefined,
        colorKey: selectedColorName ? selectedColorName.trim().toLowerCase() : null,
          // ✅ Add-to-cart does not disturb other selections
  selectOnAdd: false,
  clearOthers: false,
      });
      setAddedOnce(true);
      setTimeout(() => setAddedOnce(false), 1500);

    } catch (e: any) {
      setAddError(e?.message || "Add to cart failed");
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (isOut) return;

    if (hasVariants && !selectedVariant?._id) {
      setAddError("Please select a variant");
      return;
    }

    setAdding(true);
    setAddError(null);

    try {
      await addToCartApi({
        productId: product._id,
        qty,
        variantId: hasVariants ? String(selectedVariant?._id) : undefined,
        colorKey: selectedColorName ? selectedColorName.trim().toLowerCase() : null,
        // ✅ Buy-now: only this item selected
  selectOnAdd: true,
  clearOthers: true,
      });

      // ✅ redirect to cart/checkout as per your flow
      window.location.href = "/website/cart";
    } catch (e: any) {
      setAddError(e?.message || "Buy now failed");
    } finally {
      setAdding(false);
    }
  };



  // Sort variants: in-stock first, then name
  const sortedVariants = useMemo(() => {
    const list = [...variants];

    // ✅ if color selected, show that color first (still keep all)
    const selColor = normKey(selectedColorName);

    list.sort((a, b) => {
      const aq = Number(a.quantity ?? 0);
      const bq = Number(b.quantity ?? 0);

      // color preference
      const aIsSel = selColor ? normKey(a.color) === selColor : false;
      const bIsSel = selColor ? normKey(b.color) === selColor : false;
      if (aIsSel !== bIsSel) return aIsSel ? -1 : 1;

      // stock preference
      if ((aq > 0) !== (bq > 0)) return aq > 0 ? -1 : 1;

      return variantDisplayText(a).localeCompare(variantDisplayText(b));
    });

    return list;
  }, [variants, selectedColorName]);

  const [variantSearch, setVariantSearch] = useState("");

  // ✅ Dropdown label = name + price + status (NO stock numbers)
  const variantSelectLabel = (v: ApiVariant) => {
    const name = variantDisplayText(v);
    const q = Number(v.quantity ?? 0);
    const st = getStockStatus(q, threshold);

    const mrp = Number(v.mrp ?? 0);
    const sale = Number(v.salePrice ?? 0);
    const price = sale > 0 ? sale : mrp;
    const priceText = price > 0 ? `₹${formatINR(price)}` : "";

    const statusText = st === "OUT" ? "Out of stock" : st === "LOW" ? "Low stock" : "In stock";

    return `${name}${priceText ? ` • ${priceText}` : ""} • ${statusText}`;
  };

  return (
    <div className="mt-6 overflow-x-hidden">
      <div className="bg-white py-6 px-4 overflow-x-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* LEFT: Gallery */}
          <div className="w-full min-w-0">
            <div className="bg-white">
              <div className="p-2">
                <div className="flex flex-col lg:flex-row gap-4 min-w-0">
                  {/* MAIN IMAGE */}
                  <div className="order-1 lg:order-2 flex-1 min-w-0">
                    <div className="bg-white">
                      <div className="aspect-square bg-white border border-gray-200 relative overflow-hidden">
                        {activeImg ? (
                          <>
                            <img
                              key={activeImg}
                              src={resolveImageUrl(activeImg)}
                              alt={product.title}
                              className={`h-full w-full object-contain max-w-full ${isOut ? "opacity-70" : ""}`}
                            />
                            {isOut && (
                              <div className="absolute left-3 top-3">
                                <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-red-600 text-white">
                                  Out of stock
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-sm text-gray-400">
                            No Image
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={isOut || adding}
                        className={`h-12 font-semibold text-sm border transition w-full
    ${isOut
                            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                            : adding
                              ? "bg-gray-100 text-gray-700 cursor-wait"
                              : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
                          }`}
                      >
                        {adding
                          ? "ADDING…"
                          : addedOnce
                            ? "ADDED ✓"
                            : "ADD TO CART"}

                      </button>


                      <button
                        type="button"
                        onClick={handleBuyNow}
                        disabled={isOut}
                        className={`h-12 font-semibold text-sm transition w-full cursor-pointer ${isOut ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-orange-600 text-white hover:bg-orange-700"
                          }`}
                      >
                        BUY NOW
                      </button>
                    </div>
                  </div>

                  {/* THUMBNAILS */}
                  <div className="order-2 lg:order-1 lg:w-20 w-full lg:shrink-0 min-w-0">
                    <div
                      className="
                        flex flex-row lg:flex-col gap-3
                        overflow-x-auto lg:overflow-y-auto
                        overflow-y-hidden lg:overflow-x-hidden
                        pb-1 lg:pb-0
                        pr-0 lg:pr-1
                        snap-x snap-mandatory
                        max-w-full
                      "
                    >
                      {images.map((img) => {
                        const active = img === activeImg;
                        return (
                          <button
                            key={img}
                            type="button"
                            onClick={() => setActiveImg(img)}
                            className={`h-16 w-16 shrink-0 border bg-white overflow-hidden transition snap-start relative ${active ? "border-blue-600" : "border-gray-200 hover:border-gray-300"
                              }`}
                            aria-label="Select image"
                          >
                            <img
                              src={resolveImageUrl(img)}
                              alt="thumb"
                              className={`h-full w-full object-cover ${isOut ? "opacity-60" : ""}`}
                              loading="lazy"
                            />
                            {isOut && (
                              <span className="absolute left-1 top-1 px-1.5 py-0.5 text-[10px] font-semibold bg-red-600 text-white">
                                Out
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {images.length > 4 && (
                      <div className="mt-2 text-[11px] text-gray-500 lg:hidden">Swipe to view more images</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Details */}
          <div className="w-full min-w-0">
            <div className="bg-white min-w-0">
              <h1 className="text-[20px] font-semibold text-gray-900 leading-snug wrap-break-word max-w-full">
                {product.title}
              </h1>

              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                <span className="inline-flex items-center bg-green-600 px-2 py-0.5 text-white text-xs font-semibold">
                  4.6★
                </span>
                <span>Ratings & Reviews</span>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div className="text-3xl font-bold text-gray-900">₹{formatINR(displaySale)}</div>

                {displayMrp > displaySale && (
                  <>
                    <div className="text-sm text-gray-500 line-through">₹{formatINR(displayMrp)}</div>
                    <div className="text-sm font-semibold text-green-700">{off}% off</div>
                  </>
                )}
              </div>

              {/* Stock label only */}
              <div className="mt-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>
                  {badge.text}
                </span>
              </div>

              {/* ✅ COLOR OPTIONS (product.colors / variants.color) */}
              {hasColors && (
                <div className="mt-6">
                  <div className="border border-gray-200 p-4 overflow-hidden">
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900">Select Color</div>
                        <div className="mt-1 text-[12px] text-gray-500">This will switch the gallery images</div>
                      </div>
                      <span className="text-[12px] text-gray-700 font-semibold truncate max-w-[45%]">
                        {selectedColorName || "-"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {colors.map((c) => {
                        const active = normKey(c.name) === normKey(selectedColorName);
                        const hasHex = !!(c.hex || "").trim();
                        return (
                          <button
                            key={c._id || c.name}
                            type="button"
                            onClick={() => {
                              // ✅ set color in selections (and clear direct variantId)
                              setSelections((prev) => {
                                const next = { ...prev, color: c.name };
                                delete (next as any).__variantId;
                                return next;
                              });
                              setQty(1);
                            }}
                            className={`inline-flex items-center gap-2 px-3 py-2 border text-xs font-semibold transition ${active ? "border-blue-600" : "border-gray-200 hover:border-gray-300"
                              }`}
                          >
                            <span
                              className="h-4 w-4 border border-gray-300"
                              style={hasHex ? { backgroundColor: c.hex } : undefined}
                              aria-hidden
                            />
                            <span className="truncate max-w-[120px]">{c.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Variant dropdown */}
              {hasVariants && (
                <div className="mt-6">
                  <div className="border border-gray-200 p-4 overflow-hidden">
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900">Select Variant</div>
                        <div className="mt-1 text-[12px] text-gray-500">Choose the best option for you</div>
                      </div>

                      <span className="text-[12px] text-gray-700 font-semibold truncate max-w-[45%]">
                        {selectedVariant ? variantDisplayText(selectedVariant) : "-"}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                      <input
                        value={variantSearch}
                        onChange={(e) => setVariantSearch(e.target.value)}
                        placeholder="Search variant (size, combo, weight)..."
                        className="h-11 w-full border border-gray-200 px-3 text-sm outline-none focus:border-gray-400 min-w-0"
                      />

                      <select
                        className="h-11 w-full border border-gray-200 px-3 text-sm outline-none focus:border-gray-400 bg-white min-w-0"
                        value={String(selectedVariant?._id || "")}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSelections((prev) => ({
                            // ✅ keep color selection; set direct variant
                            color: prev.color || selectedColorName || "",
                            __variantId: id,
                          }));
                          setQty(1);
                        }}
                      >
                        {sortedVariants
                          .filter((v) => {
                            const q = variantSearch.trim().toLowerCase();
                            if (!q) return true;

                            const hay = (
                              `${variantDisplayText(v)} ${v.size || ""} ${v.weight || ""} ${v.comboText || ""} ${v.color || ""}`
                            )
                              .toLowerCase()
                              .replace(/\s+/g, " ");
                            return hay.includes(q);
                          })
                          .map((v) => {
                            const q = Number(v.quantity ?? 0);
                            const st = getStockStatus(q, threshold);
                            return (
                              <option key={String(v._id)} value={String(v._id)} disabled={st === "OUT"}>
                                {variantSelectLabel(v)}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="mt-6 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900">Quantity</div>

                <div className="inline-flex items-center border border-gray-200 bg-white">
                  <button
                    type="button"
                    className="h-10 w-11 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <div className="h-10 min-w-14 grid place-items-center text-sm font-semibold text-gray-900">
                    {qty}
                  </div>
                  <button
                    type="button"
                    className="h-10 w-11 text-gray-700 hover:bg-gray-50"
                    onClick={() => setQty((q) => q + 1)}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* ACCORDIONS */}
            <div className="mt-6 bg-white border border-gray-200 px-5 overflow-hidden">
              <AccordionItem title="Description" open={openKey === "desc"} onToggle={() => toggleKey("desc")}>
                {product.description?.trim() ? (
                  <div className="whitespace-pre-line wrap-break-word">{product.description}</div>
                ) : (
                  <div className="text-gray-600">No description available.</div>
                )}
              </AccordionItem>

              <AccordionItem title="Specifications" open={openKey === "feat"} onToggle={() => toggleKey("feat")}>
                <FeaturesBlock features={product.features} />
              </AccordionItem>

              <AccordionItem title="Refund Policy" open={openKey === "refund"} onToggle={() => toggleKey("refund")}>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Returns accepted within 7 days of delivery (if applicable).</li>
                  <li>Item must be unused, with original packaging and tags.</li>
                  <li>Damaged/incorrect items should be reported within 24 hours of delivery.</li>
                  <li>Refunds are processed after quality check and approval.</li>
                </ul>
              </AccordionItem>

              <AccordionItem title="Shipping Policy" open={openKey === "ship"} onToggle={() => toggleKey("ship")}>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Orders are processed within 24–48 business hours.</li>
                  <li>Delivery timeline depends on your location and courier partner.</li>
                  <li>Tracking details will be shared once the order is shipped.</li>
                  <li>Shipping delays may occur during high-demand or sale periods.</li>
                </ul>
              </AccordionItem>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
