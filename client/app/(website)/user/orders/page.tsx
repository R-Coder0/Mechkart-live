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

function calcItemsTotal(items: any[]) {
  const arr = Array.isArray(items) ? items : [];
  return arr.reduce((sum, it) => {
    const qty = Math.max(1, Number(it?.qty || 1));

    // try best known line totals first
    const line =
      Number(it?.finalLineTotal ?? NaN) ||
      Number(it?.lineTotal ?? NaN) ||
      Number(it?.total ?? NaN) ||
      Number(it?.amount ?? NaN);

    if (Number.isFinite(line) && line > 0) return sum + line;

    // else compute from unit price
    const unit =
      Number(it?.finalPrice ?? NaN) ||
      Number(it?.salePrice ?? NaN) ||
      Number(it?.price ?? NaN) ||
      Number(it?.unitPrice ?? NaN);

    if (Number.isFinite(unit) && unit > 0) return sum + unit * qty;

    return sum;
  }, 0);
}

function pickOrderTotal(order: any, subOrder?: any, mode?: "SINGLE" | "SPLIT") {
  // ✅ SPLIT: prefer subOrder.total, else compute from subOrder.items
  if (mode === "SPLIT") {
    const direct =
      Number(subOrder?.total ?? NaN) ||
      Number(subOrder?.grandTotal ?? NaN) ||
      Number(subOrder?.subtotal ?? NaN);

    if (Number.isFinite(direct) && direct > 0) return direct;

    const computed = calcItemsTotal(subOrder?.items || []);
    if (computed > 0) return computed;

    // last fallback (still show something, not 0)
    return 0;
  }

  // ✅ SINGLE: whole order total
  return (
    Number(order?.totals?.grandTotal ?? NaN) ||
    Number(order?.totals?.total ?? NaN) ||
    Number(order?.totals?.subtotal ?? NaN) ||
    Number(order?.totalAmount ?? 0) ||
    calcItemsTotal(order?.items || [])
  );
}


function normalizeSubOrdersForList(order: any) {
  const subs = Array.isArray(order?.subOrders) ? order.subOrders : [];

  if (subs.length > 0) {
    return subs.map((so: any) => ({
      _id: String(so?._id || ""),
      soldBy:
        String(so?.soldBy || "").trim() ||
        String(so?.vendorName || "").trim() ||
        (so?.vendorId ? "Vendor" : "Mechkart"),
      vendorName: String(so?.vendorName || "").trim(),
      ownerType: so?.ownerType || (so?.vendorId ? "VENDOR" : "ADMIN"),
      vendorId: so?.vendorId ? String(so.vendorId) : "",
      status: String(so?.status || order?.status || "PLACED").toUpperCase(),
      items: Array.isArray(so?.items) ? so.items : [],
      shipment: so?.shipment || null,
    }));
  }

  // Fallback: legacy items[] treated as single seller (Mechkart)
  const legacyItems = Array.isArray(order?.items) ? order.items : [];
  return [
    {
      _id: "LEGACY",
      soldBy: "Mechkart",
      vendorName: "",
      ownerType: "ADMIN",
      vendorId: "",
      status: String(order?.status || "PLACED").toUpperCase(),
      items: legacyItems,
      shipment: null,
    },
  ];
}

function buildOrderRows(orders: any[]) {
  // If only 1 seller => one card
  // If multiple sellers => separate cards per subOrder
  const rows: any[] = [];

  (orders || []).forEach((o) => {
    const subs = normalizeSubOrdersForList(o);

    if (subs.length <= 1) {
      rows.push({
        rowId: `${String(o?._id)}::single`,
        orderId: String(o?._id),
        order: o,
        subOrder: subs[0] || null,
        mode: "SINGLE",
      });
      return;
    }

    subs.forEach((so: any) => {
      rows.push({
        rowId: `${String(o?._id)}::${String(so?._id)}`,
        orderId: String(o?._id),
        order: o,
        subOrder: so,
        mode: "SPLIT",
      });
    });
  });

  return rows;
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

  const rows = useMemo(() => buildOrderRows(orders), [orders]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;

    const s = search.trim().toLowerCase();

    return (rows || []).filter((r: any) => {
      const o = r.order;
      const so = r.subOrder;

      const code = String(o?.orderCode || "").toLowerCase();
      const id = String(o?._id || "").toLowerCase();

      const firstItem = so?.items?.[0] || o?.items?.[0] || null;
      const firstTitle = String(
        firstItem?.title || firstItem?.productId?.title || firstItem?.product?.title || ""
      ).toLowerCase();

      const soldBy = String(so?.soldBy || "").toLowerCase();

      return code.includes(s) || id.includes(s) || firstTitle.includes(s) || soldBy.includes(s);
    });
  }, [rows, search]);

  const onSearch = () => {
    setSearch(q);
    // server side search optional:
    // load(q);
  };

  return (
    <div className="w-full">
      {/* Search bar */}
      <div className="border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your orders here"
            className="h-12 flex-1 border px-4 text-sm outline-none focus:border-gray-400"
          />
          <button
            type="button"
            onClick={onSearch}
            className="h-12 bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Search Orders
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {/* List */}
      <div className="mt-5 space-y-4">
        {loading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border bg-white p-5">
                <div className="h-5 w-64 rounded bg-gray-200 animate-pulse" />
                <div className="mt-4 h-20 rounded bg-gray-100 animate-pulse" />
              </div>
            ))}
          </>
        ) : filtered.length ? (
          filtered.map((r: any) => {
            const o = r.order;
            const so = r.subOrder;

            // if split card -> use subOrder status; else order status
            const status = String(so?.status || o?.status || "PLACED").toUpperCase();
            const createdAt = o?.createdAt ? new Date(o.createdAt) : new Date();

            const items = Array.isArray(so?.items) && so.items.length ? so.items : Array.isArray(o?.items) ? o.items : [];
            const previewItems = items.slice(0, 2);
            const moreCount = Math.max(0, items.length - previewItems.length);

            const total = pickOrderTotal(o, so, r.mode);

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

            const sellerLabel =
              r.mode === "SPLIT" ? `Sold by: ${String(so?.soldBy || "Mechkart")}` : "";

            return (
              <Link
                key={r.rowId}
                href={`/user/orders/${String(o._id)}${r.mode === "SPLIT" ? `?subOrderId=${encodeURIComponent(String(so?._id || ""))}` : ""}`}
                className="block border bg-white p-5 hover:bg-gray-50 transition"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  {/* Left: thumbnails + titles */}
                  <div className="flex gap-4">
                    {/* Thumbnails (up to 2) */}
                    <div className="flex gap-2">
                      {previewItems.map((it: any, idx: number) => {
                        const product = it?.productId || it?.product || null;
                        const imgPath = resolveOrderItemImage(product, it?.variantId, it?.colorKey, it?.image);
                        const img = resolveImageUrl(imgPath);

                        return (
                          <div key={idx} className="h-20 w-20 shrink-0 overflow-hidden bg-gray-100">
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
                      {sellerLabel ? (
                        <div className="text-xs font-bold text-gray-800">{sellerLabel}</div>
                      ) : null}

                      {previewItems.map((it: any, idx: number) => {
                        const product = it?.productId || it?.product || null;
                        const title = String(product?.title || it?.title || "Product");
                        const color = it?.colorKey ? String(it.colorKey) : "";
                        const variantText = getVariantText(product, it?.variantId);
                        const qty = it?.qty ? Number(it.qty) : 1;

                        return (
                          <div key={idx} className={idx ? "mt-2" : "mt-1"}>
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
          <div className="border bg-white p-8 text-sm text-gray-700">No orders found.</div>
        )}
      </div>
    </div>
  );
}
