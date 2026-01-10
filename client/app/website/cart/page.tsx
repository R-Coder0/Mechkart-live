/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  clearCart,
  fetchCart,
  removeItem,
  resolveImageUrl,
  updateQty,
  updateItemOptions,
  resolveCartItemImage,
  getVariantText,
  type CartData,
  // ✅ correct names from updated cartApi.ts
  setCartItemSelected,
  setCartSelectAll,
} from "@/lib/cartApi";

export const dynamic = "force-dynamic";

function money(n: number) {
  return `₹${Number(n || 0).toFixed(0)}`;
}

export default function CartPage() {
  const [cart, setCart] = useState<CartData>({ items: [] });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = cart.items || [];

  // ✅ Selected items (default false if missing)
  const selectedItems = useMemo(() => {
    return items.filter((it: any) => Boolean((it as any).isSelected));
  }, [items]);

  const allSelected = useMemo(() => {
    if (!items.length) return false;
    return items.every((it: any) => Boolean((it as any).isSelected));
  }, [items]);

  const someSelected = useMemo(() => {
    return selectedItems.length > 0 && selectedItems.length < items.length;
  }, [selectedItems.length, items.length]);

  // ✅ Totals should be based on selected items only
  const subtotal = useMemo(() => {
    return selectedItems.reduce(
      (sum, it: any) => sum + Number(it.salePrice || 0) * Number(it.qty || 0),
      0
    );
  }, [selectedItems]);

  const mrpTotal = useMemo(() => {
    return selectedItems.reduce(
      (sum, it: any) => sum + Number(it.mrp || 0) * Number(it.qty || 0),
      0
    );
  }, [selectedItems]);

  const savings = Math.max(0, mrpTotal - subtotal);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await fetchCart();
        setCart(data);
      } catch (e: any) {
        setError(e?.message || "Failed to load cart");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onChangeQty = async (itemId: string, nextQty: number) => {
    if (nextQty < 1) return;
    try {
      setBusyId(itemId);
      setError(null);
      const updated = await updateQty(itemId, nextQty);
      setCart(updated);
    } catch (e: any) {
      setError(e?.message || "Qty update failed");
    } finally {
      setBusyId(null);
    }
  };

  const onRemove = async (itemId: string) => {
    try {
      setBusyId(itemId);
      setError(null);
      const updated = await removeItem(itemId);
      setCart(updated);
    } catch (e: any) {
      setError(e?.message || "Remove failed");
    } finally {
      setBusyId(null);
    }
  };

  const onClear = async () => {
    try {
      setBusyId("CLEAR_ALL");
      setError(null);
      const updated = await clearCart();
      setCart(updated);
    } catch (e: any) {
      setError(e?.message || "Clear failed");
    } finally {
      setBusyId(null);
    }
  };

  // ✅ Toggle single item selection
  const onToggleItem = async (itemId: string, next: boolean) => {
    try {
      setBusyId(itemId);
      setError(null);
      const updated = await setCartItemSelected(itemId, next);
      setCart(updated);
    } catch (e: any) {
      setError(e?.message || "Selection update failed");
    } finally {
      setBusyId(null);
    }
  };

  // ✅ Select all
  const onToggleAll = async (next: boolean) => {
    try {
      setBusyId("SELECT_ALL");
      setError(null);
      const updated = await setCartSelectAll(next);
      setCart(updated);
    } catch (e: any) {
      setError(e?.message || "Select all failed");
    } finally {
      setBusyId(null);
    }
  };

  // ✅ Proceed
  const onProceed = () => {
    if (!selectedItems.length) {
      setError("Please select at least 1 item to checkout.");
      return;
    }
    // You already have GET /api/user/checkout/summary (server will re-validate selected)
    window.location.href = "/website/checkout";
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="h-6 w-40 bg-gray-200 animate-pulse rounded" />
        <div className="mt-6 grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl border bg-gray-50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="rounded-3xl border bg-white p-10 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Your cart is empty</h1>
          <p className="mt-2 text-gray-600">Add products to proceed to checkout.</p>
          <Link
            href="/website/products"
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-black"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shopping Cart</h1>
          <p className="text-gray-600">
            {items.length} item(s) • {selectedItems.length} selected
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* ✅ Select All */}
          <button
            type="button"
            onClick={() => onToggleAll(!allSelected)}
            disabled={busyId === "SELECT_ALL"}
            className="rounded-xl border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            {busyId === "SELECT_ALL"
              ? "Updating..."
              : allSelected
              ? "Unselect all"
              : "Select all"}
          </button>

          <button
            onClick={onClear}
            disabled={busyId === "CLEAR_ALL"}
            className="rounded-xl border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            {busyId === "CLEAR_ALL" ? "Clearing..." : "Clear cart"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((it: any) => {
            const product = it.product || null;

            const imgPath = resolveCartItemImage(product, it.variantId, it.colorKey);
            const img = resolveImageUrl(imgPath);

            const variantText = getVariantText(product, it.variantId);

            const colors = (product?.colors || [])
              .filter((c: any) => (c?.name || "").trim())
              .slice()
              .sort((a: any, b: any) => Number(a.orderIndex ?? 0) - Number(b.orderIndex ?? 0));

            const variants = product?.variants || [];

            const lineTotal = Number(it.salePrice || 0) * Number(it.qty || 0);
            const lineMrp = Number(it.mrp || 0) * Number(it.qty || 0);

            const selected = Boolean(it.isSelected);

            return (
              <div key={it._id} className="rounded-3xl border bg-white p-4 sm:p-5">
                <div className="flex gap-4">
                  {/* ✅ Checkbox */}
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={busyId === it._id}
                      onChange={(e) => onToggleItem(it._id, e.target.checked)}
                      className="h-5 w-5 accent-gray-900"
                    />
                  </div>

                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt={product?.title || "Product"}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {product?.title || it.title}
                        </div>

                        {/* Product Code */}
                        {it.productCode || product?.productId ? (
                          <div className="mt-0.5 text-[11px] font-semibold text-gray-500">
                            Code: {it.productCode || product?.productId}
                          </div>
                        ) : null}

                        <div className="mt-1 text-xs text-gray-500">
                          Variant: {variantText}
                          {it.colorKey ? ` • Color: ${it.colorKey}` : ""}
                        </div>
                      </div>

                      <button
                        onClick={() => onRemove(it._id)}
                        disabled={busyId === it._id}
                        className="rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {busyId === it._id ? "Removing..." : "Remove"}
                      </button>
                    </div>

                    {/* Variant / Color change */}
{/* Variant / Color change */}
{(variants.length > 0 || colors.length > 0) && (
  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
    {/* Variant (only if variants exist) */}
    {variants.length > 0 ? (
      <div>
        <div className="text-[11px] font-semibold text-gray-600 mb-1">
          Change Variant
        </div>
        <select
          value={String(it.variantId || "")}
          disabled={busyId === it._id}
          onChange={async (e) => {
            try {
              setBusyId(it._id);
              setError(null);

              const nextVariantId = e.target.value; // always exists here
              const updated = await updateItemOptions(
                it._id,
                nextVariantId,
                it.colorKey || null
              );
              setCart(updated);
            } catch (err: any) {
              setError(err?.message || "Variant update failed");
            } finally {
              setBusyId(null);
            }
          }}
          className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-gray-400 bg-white disabled:opacity-60"
        >
          {variants.map((v: any) => {
            const name = v.label || v.comboText || v.size || v.weight || "Variant";
            const out = Number(v.quantity ?? 0) <= 0;
            return (
              <option key={String(v._id)} value={String(v._id)} disabled={out}>
                {name}
                {out ? " (Out)" : ""}
              </option>
            );
          })}
        </select>
      </div>
    ) : (
      // keep grid alignment when only colors exist
      <div className="hidden sm:block" />
    )}

    {/* Color (show if colors exist, even if no variants) */}
    {colors.length ? (
      <div>
        <div className="text-[11px] font-semibold text-gray-600 mb-1">
          Change Color
        </div>

        <div className="flex flex-wrap gap-2">
          {colors.map((c: any) => {
            const active =
              String(it.colorKey || "").toLowerCase() ===
              String(c.name || "").toLowerCase();
            const hasHex = !!(c.hex || "").trim();

            return (
              <button
                key={c._id || c.name}
                type="button"
                disabled={busyId === it._id}
                onClick={async () => {
                  try {
                    setBusyId(it._id);
                    setError(null);

                    // ✅ if no variants, pass null
                    const nextVariantId = variants.length > 0 ? String(it.variantId) : null;

                    const updated = await updateItemOptions(
                      it._id,
                      nextVariantId,
                      c.name
                    );
                    setCart(updated);
                  } catch (err: any) {
                    setError(err?.message || "Color update failed");
                  } finally {
                    setBusyId(null);
                  }
                }}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                  active ? "border-blue-600" : "border-gray-200 hover:border-gray-300"
                }`}
                title={c.name}
              >
                <span
                  className="h-4 w-4 border border-gray-300"
                  style={hasHex ? { backgroundColor: c.hex } : undefined}
                />
                <span className="max-w-[90px] truncate">{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    ) : (
      <div className="text-xs text-gray-500">No colors</div>
    )}
  </div>
)}

                    {/* Price + Qty */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-end gap-2">
                        <div className="text-base font-bold text-gray-900">{money(it.salePrice)}</div>
                        {Number(it.mrp) > Number(it.salePrice) && (
                          <div className="text-sm text-gray-500 line-through">{money(it.mrp)}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onChangeQty(it._id, it.qty - 1)}
                          disabled={busyId === it._id || it.qty <= 1}
                          className="h-10 w-10 rounded-xl border text-lg font-semibold hover:bg-gray-50 disabled:opacity-40"
                        >
                          –
                        </button>
                        <div className="min-w-10 text-center text-sm font-semibold">{it.qty}</div>
                        <button
                          onClick={() => onChangeQty(it._id, it.qty + 1)}
                          disabled={busyId === it._id}
                          className="h-10 w-10 rounded-xl border text-lg font-semibold hover:bg-gray-50 disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Line total */}
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <div className="text-gray-500">Line total</div>
                      <div className="font-semibold text-gray-900">
                        {money(lineTotal)}{" "}
                        {lineMrp > lineTotal ? (
                          <span className="ml-2 text-xs font-semibold text-emerald-700">
                            Save {money(lineMrp - lineTotal)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 rounded-3xl border bg-white p-5">
            <div className="text-lg font-bold text-gray-900">Order Summary</div>

            <div className="mt-2 text-sm text-gray-600">
              Selected items: <span className="font-semibold">{selectedItems.length}</span>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">{money(subtotal)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">MRP Total</span>
                <span className="font-semibold">{money(mrpTotal)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">You save</span>
                <span className="font-semibold text-emerald-700">{money(savings)}</span>
              </div>

              <div className="h-px bg-gray-200" />

              <div className="flex justify-between text-base">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-gray-900">{money(subtotal)}</span>
              </div>
            </div>

            <button
              onClick={onProceed}
              className="mt-6 w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black"
            >
              Proceed to checkout
            </button>

            <Link
              href="/website/products"
              className="mt-3 block text-center text-sm font-semibold text-gray-700 hover:underline"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
