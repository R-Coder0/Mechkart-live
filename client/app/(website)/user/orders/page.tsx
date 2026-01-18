/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

function money(n: number) {
  return `₹${Math.round(Number(n || 0))}`;
}

function resolveImageUrl(path?: string) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const host = (API_BASE || "").replace(/\/api\/?$/, "");
  return path.startsWith("/") ? `${host}${path}` : `${host}/${path}`;
}

const norm = (v: any) => String(v ?? "").trim();
const normKey = (v: any) => norm(v).toLowerCase();

function getVariantText(product?: any, variantId?: string) {
  const v = (product?.variants || []).find((x: any) => String(x._id) === String(variantId));
  if (!v) return "";
  return String(v.label || v.comboText || v.size || v.weight || "").trim();
}

function resolveOrderItemImage(
  product?: any,
  variantId?: string,
  colorKey?: string | null,
  fallback?: string
) {
  // If product populated: Color > Variant > Gallery > Feature
  if (product) {
    const v = (product.variants || []).find((x: any) => String(x._id) === String(variantId));
    const c = (product.colors || []).find((x: any) => normKey(x.name) === normKey(colorKey));

    const cImg = (c?.images || []).find(Boolean);
    const vImg = (v?.images || []).find(Boolean);
    const gImg = (product.galleryImages || []).find(Boolean);
    const fImg = product.featureImage || "";

    return cImg || vImg || gImg || fImg || fallback || "";
  }

  return fallback || "";
}

function addDays(dateISO: string | Date, days: number) {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { month: "short", day: "2-digit", year: "numeric" });
}

function pickStatusDate(o: any) {
  const iso =
    o?.deliveredAt ||
    o?.cancelledAt ||
    o?.statusUpdatedAt ||
    o?.updatedAt ||
    o?.createdAt ||
    null;

  return iso ? new Date(iso) : null;
}

export default function WebsiteUserOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");

  const [orders, setOrders] = useState<any[]>([]);

  const load = async (query: string) => {
    try {
      setLoading(true);
      setError(null);

      const sp = new URLSearchParams();
      if (query.trim()) sp.set("q", query.trim());

      // ✅ GET /users/orders
      const res = await fetch(`${API_BASE}/users/orders?${sp.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Failed to load orders");

      const data = json?.data ?? json;

      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setOrders(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load("");
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const s = search.trim().toLowerCase();
    return (orders || []).filter((o: any) => {
      const code = String(o?.orderCode || "").toLowerCase();
      const id = String(o?._id || "").toLowerCase();
      const firstTitle = String(o?.items?.[0]?.title || o?.items?.[0]?.productId?.title || "").toLowerCase();
      return code.includes(s) || id.includes(s) || firstTitle.includes(s);
    });
  }, [orders, search]);

  const onSearch = () => {
    setSearch(q);
    // server side search optional:
    // load(q);
  };

  return (
    <div className="w-full">
      {/* Search bar */}
      <div className=" border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your orders here"
            className="h-12 flex-1  border px-4 text-sm outline-none focus:border-gray-400"
          />
          <button
            type="button"
            onClick={onSearch}
            className="h-12  bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Search Orders
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4  border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {/* List */}
      <div className="mt-5 space-y-4">
        {loading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className=" border bg-white p-5">
                <div className="h-5 w-64 rounded bg-gray-200 animate-pulse" />
                <div className="mt-4 h-20 rounded bg-gray-100 animate-pulse" />
              </div>
            ))}
          </>
        ) : filtered.length ? (
          filtered.map((o: any) => {
            const status = String(o?.status || "PLACED").toUpperCase();
            const createdAt = o?.createdAt ? new Date(o.createdAt) : new Date();

            const items = Array.isArray(o?.items) ? o.items : [];
            const previewItems = items.slice(0, 2);
            const moreCount = Math.max(0, items.length - previewItems.length);

            // ✅ Payable total (grandTotal preferred)
            const total = Number(
              o?.totals?.grandTotal ??
                o?.totals?.subtotal ??
                o?.totalAmount ??
                0
            );

            // right side text (expected/delivered/cancelled)
            const statusDate = pickStatusDate(o);
            const expected = addDays(createdAt, 7);

            let rightTitle = `Delivery expected by ${formatDate(expected)}`;
            let rightSub = "Your item will be delivered soon.";

            if (status === "SHIPPED") rightSub = "Your item has been shipped.";
            if (status === "DELIVERED") {
              const d = statusDate || createdAt;
              rightTitle = `Delivered on ${formatDate(d)}`;
              rightSub = "Your item has been delivered.";
            }
            if (status === "CANCELLED") {
              const d = statusDate || createdAt;
              rightTitle = `Cancelled on ${formatDate(d)}`;
              rightSub = "Your order was cancelled.";
            }

            const dotClass =
              status === "CANCELLED"
                ? "bg-red-500"
                : status === "DELIVERED"
                ? "bg-green-600"
                : "bg-green-600";

            return (
              <Link
                key={String(o?._id)}
                href={`/user/orders/${String(o._id)}`}
                className="block  border bg-white p-5 hover:bg-gray-50 transition"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  {/* Left: thumbnails + titles */}
                  <div className="flex gap-4">
                    {/* Thumbnails (up to 2) */}
                    <div className="flex gap-2">
                      {previewItems.map((it: any, idx: number) => {
                        const product = it?.productId || it?.product || null;
                        const imgPath = resolveOrderItemImage(
                          product,
                          it?.variantId,
                          it?.colorKey,
                          it?.image
                        );
                        const img = resolveImageUrl(imgPath);

                        return (
                          <div key={idx} className="h-20 w-20 shrink-0 overflow-hidden  bg-gray-100">
                            {img ? (
                              <img src={img} alt={it?.title || "Product"} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full bg-gray-200" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Titles */}
                    <div className="min-w-0">
                      {previewItems.map((it: any, idx: number) => {
                        const product = it?.productId || it?.product || null;
                        const title = String(product?.title || it?.title || "Product");
                        const color = it?.colorKey ? String(it.colorKey) : "";
                        const variantText = getVariantText(product, it?.variantId);
                        const qty = it?.qty ? Number(it.qty) : 1;

                        return (
                          <div key={idx} className={idx ? "mt-2" : ""}>
                            <div className="text-sm font-semibold text-gray-900 line-clamp-2">{title}</div>

                            {(color || variantText || qty) ? (
                              <div className="mt-1 text-xs text-gray-600">
                                Qty: {qty}
                                {color ? ` • Color: ${color}` : ""}
                                {variantText ? ` • Variant: ${variantText}` : ""}
                              </div>
                            ) : null}

                            {it?.productCode ? (
                              <div className="mt-1 text-[11px] text-gray-500">Code: {it.productCode}</div>
                            ) : null}
                          </div>
                        );
                      })}

                      {moreCount > 0 ? (
                        <div className="mt-2 text-[11px] text-gray-500">+{moreCount} more item(s)</div>
                      ) : null}

                      {o?.orderCode ? (
                        <div className="mt-2 text-[11px] text-gray-500">Order: {o.orderCode}</div>
                      ) : null}
                    </div>
                  </div>

                  {/* Middle: price */}
                  <div className="md:w-40 md:text-center">
                    <div className="text-sm font-bold text-gray-900">{money(total)}</div>
                  </div>

                  {/* Right: status block */}
                  <div className="md:w-[280px]">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
                      <div className="text-sm font-semibold text-gray-900">{rightTitle}</div>
                    </div>
                    <div className="mt-1 text-xs text-gray-600">{rightSub}</div>
                  </div>
                </div>
              </Link>
            );
          })
        ) : (
          <div className=" border bg-white p-8 text-sm text-gray-700">No orders found.</div>
        )}
      </div>
    </div>
  );
}
