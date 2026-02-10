/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

// ✅ Vendor token helper (localStorage)
const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("vendor_token");
};

function money(n: number) {
  return `₹${Math.round(Number(n || 0))}`;
}

function moneyPaise(paise: any) {
  const p = Number(paise || 0);
  if (!Number.isFinite(p) || p <= 0) return "—";
  return money(p / 100);
}

function fmtDateTime(v?: any) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("en-IN");
  } catch {
    return "—";
  }
}

function resolveImageUrl(path?: string) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const host = (API_BASE || "").replace(/\/api\/?$/, "");
  return path.startsWith("/") ? `${host}${path}` : `${host}/${path}`;
}

function toNum(v: any, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function calcItemsTotal(items: any[]) {
  const arr = Array.isArray(items) ? items : [];
  return arr.reduce((sum, it) => {
    const qty = Math.max(1, Number(it?.qty || 1));

    // ✅ best: finalLineTotal (already base - discount)
    const finalLine = Number(it?.finalLineTotal);
    if (Number.isFinite(finalLine) && finalLine >= 0) return sum + finalLine;

    // ✅ next: baseLineTotal (baseSalePrice * qty)
    const baseLine = Number(it?.baseLineTotal);
    if (Number.isFinite(baseLine) && baseLine >= 0) return sum + baseLine;

    // ✅ next: compute baseSalePrice * qty from pricingMeta
    const baseSale = Number(it?.pricingMeta?.baseSalePrice);
    if (Number.isFinite(baseSale) && baseSale > 0) return sum + baseSale * qty;

    // ❌ do NOT fallback to it.salePrice because it might include shipping
    return sum;
  }, 0);
}


function pickSubOrderTotal(order: any, so: any) {
  // ✅ prefer vendorTotals (controller se aa raha hoga)
  const vt = order?.vendorTotals || null;
  if (vt && Number(vt.grandTotal) >= 0) return toNum(vt.grandTotal, 0);

  // ✅ compute from items (WITHOUT shipping)
  const computed = calcItemsTotal(so?.items || []);
  if (computed > 0) return computed;

  // fallback (very last)
  return 0;
}


function getVariantTextFromItem(it: any) {
  const vid = it?.variantId?._id || it?.variantId || it?.variant?._id || it?.variant || "";
  if (!vid) return "";

  const direct =
    it?.variantLabel ||
    it?.variantName ||
    it?.variantText ||
    it?.variantSnapshot?.label ||
    it?.variantSnapshot?.comboText ||
    it?.variantSnapshot?.size ||
    it?.variantSnapshot?.weight;
  if (direct) return String(direct).trim();

  const product =
    (it?.productId && typeof it.productId === "object" ? it.productId : null) ||
    (it?.product && typeof it.product === "object" ? it.product : null);

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const v = variants.find((x: any) => String(x?._id) === String(vid));
  return String(v?.label || v?.comboText || v?.size || v?.weight || "").trim();
}

function pickFirstImage(it: any) {
  const product =
    (it?.productId && typeof it.productId === "object" ? it.productId : null) ||
    (it?.product && typeof it.product === "object" ? it.product : null);

  const img =
    it?.image ||
    product?.featureImage ||
    (Array.isArray(product?.galleryImages) ? product.galleryImages[0] : "") ||
    "";
  return resolveImageUrl(img);
}

function pickVendorShipment(order: any) {
  const list = Array.isArray(order?.shipments) ? order.shipments : [];
  const sorted = [...list].sort((a: any, b: any) => {
    const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
  const sr = sorted.find((x: any) => x?.provider === "SHIPROCKET");
  return sr || sorted[0] || null;
}

// ✅ Vendor orders API (Bearer token)
async function vendorFetchOrders(params: {
  q?: string;
  status?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.status) qs.set("status", params.status);
  if (params.paymentMethod) qs.set("paymentMethod", params.paymentMethod);
  if (params.paymentStatus) qs.set("paymentStatus", params.paymentStatus);
  qs.set("page", String(params.page || 1));
  qs.set("limit", String(params.limit || 20));

  const token = getToken();
  if (!token) throw new Error("Vendor token missing. Please login again.");

  const res = await fetch(`${API_BASE}/vendors/orders?${qs.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Failed to load vendor orders");
  return json?.data ?? json;
}

/* ---------------- UI components (admin-style) ---------------- */

function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "green" | "red" | "blue" | "amber" | "indigo";
}) {
  const map: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
    amber: "bg-amber-100 text-amber-900",
    indigo: "bg-indigo-100 text-indigo-800",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[tone] || map.gray}`}>
      {children}
    </span>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  title,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  tone?: "default" | "primary" | "danger";
}) {
  const base =
    "inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-[12px] font-semibold disabled:opacity-60";
  const styles =
    tone === "primary"
      ? "bg-gray-900 text-white hover:bg-black border-gray-900"
      : tone === "danger"
        ? "bg-red-600 text-white hover:bg-red-700 border-red-600"
        : "bg-white text-gray-800 hover:bg-gray-50";
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-[980px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-gray-500">{subtitle || "Order Details"}</div>
            <div className="truncate text-lg font-extrabold text-gray-900">{title}</div>
          </div>
          <button onClick={onClose} className="h-10 rounded-xl border px-4 text-sm font-semibold hover:bg-gray-50">
            Close
          </button>
        </div>
        <div className="h-[calc(100%-73px)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function Tabs({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { key: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={
              "h-9 rounded-xl px-4 text-[12px] font-semibold " +
              (active ? "bg-gray-900 text-white" : "border bg-white text-gray-800 hover:bg-gray-50")
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function StatRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b py-2 text-sm">
      <div className="text-gray-600">{k}</div>
      <div className="text-right font-semibold text-gray-900">{v}</div>
    </div>
  );
}

function toneForPaymentStatus(ps: string) {
  const s = String(ps || "").toUpperCase();
  if (s === "PAID") return "green";
  if (s === "FAILED") return "red";
  return "amber";
}

function toneForOrderStatus(st: string) {
  const s = String(st || "").toUpperCase();
  if (s === "DELIVERED") return "green";
  if (s === "CANCELLED") return "red";
  if (s === "SHIPPED") return "blue";
  if (s === "CONFIRMED") return "indigo";
  return "gray";
}

/* -------- Return meta for alerts + row highlight -------- */
function getReturnMetaVendor(order: any) {
  const sub = Array.isArray(order?.subOrders) ? order.subOrders[0] : null;
  const ret = sub?.return || null;
  const refund = sub?.refund || null;

  const retStatus = String(ret?.status || "").toUpperCase();
  const refundStatus = String(refund?.status || "").toUpperCase();

  const requested = retStatus === "REQUESTED";
  const refundPending = ["APPROVED", "RECEIVED"].includes(retStatus) && refundStatus !== "PROCESSED";
  const anyReturn = Boolean(retStatus);

  const mostCritical = requested ? "REQUESTED" : refundPending ? "REFUND_PENDING" : anyReturn ? "RETURN_EXISTS" : "";

  return {
    anyReturn,
    requested,
    refundPending,
    ret,
    refund,
    retStatus,
    refundStatus,
    mostCritical,
  };
}

type DrawerState = { open: boolean; order: any | null; sub: any | null; tab: "items" | "shipments" | "returns" | "payment" | "customer" };

export default function VendorOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");

  const [attentionOnly, setAttentionOnly] = useState(false);

  const [page, setPage] = useState(1);
  const limit = 20;

  const [data, setData] = useState<any>({
    items: [],
    page: 1,
    limit,
    total: 0,
    totalPages: 1,
  });

  const rawItems = data?.items || [];
  const totalPages = Number(data?.totalPages || 1);

  const [drawer, setDrawer] = useState<DrawerState>({
    open: false,
    order: null,
    sub: null,
    tab: "items",
  });

  const load = async (nextPage = 1) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await vendorFetchOrders({
        q,
        status,
        paymentMethod,
        paymentStatus,
        page: nextPage,
        limit,
      });
      setData(resp);
      setPage(resp.page || nextPage);
    } catch (e: any) {
      setError(e?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, []);

  const items = useMemo(() => {
    if (!attentionOnly) return rawItems;
    return rawItems.filter((o: any) => {
      const rm = getReturnMetaVendor(o);
      return rm.mostCritical === "REQUESTED" || rm.mostCritical === "REFUND_PENDING";
    });
  }, [rawItems, attentionOnly]);

  const summaryText = useMemo(() => {
    const total = Number(data?.total || 0);
    const shown = items.length;
    return attentionOnly ? `Showing ${shown} of ${total} (Attention only)` : `${total} order(s)`;
  }, [data?.total, items.length, attentionOnly]);

  const openOrder = (order: any, tab: DrawerState["tab"] = "items") => {
    const sub = Array.isArray(order?.subOrders) ? order.subOrders[0] : null;
    setDrawer({ open: true, order, sub, tab });
  };
  const closeOrder = () => setDrawer({ open: false, order: null, sub: null, tab: "items" });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Vendor · Orders</h1>
          <p className="text-sm text-gray-600">{summaryText}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/vendors" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50">
            Vendor Home
          </Link>
          <button
            onClick={() => load(page)}
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 rounded-3xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search: order code / customer / phone / RZP id"
            className="h-11 rounded-2xl border px-4 text-sm outline-none focus:border-gray-400 sm:col-span-2"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-11 rounded-2xl border px-4 text-sm outline-none focus:border-gray-400 bg-white"
          >
            <option value="">All Status</option>
            {["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="h-11 rounded-2xl border px-4 text-sm outline-none focus:border-gray-400 bg-white"
          >
            <option value="">All Payments</option>
            <option value="COD">COD</option>
            <option value="ONLINE">ONLINE</option>
          </select>

          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="h-11 rounded-2xl border px-4 text-sm outline-none focus:border-gray-400 bg-white"
          >
            <option value="">All Pay Status</option>
            {["PENDING", "PAID", "FAILED"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <label className="flex h-11 items-center gap-2 rounded-2xl border bg-white px-3 text-sm">
            <input
              type="checkbox"
              checked={attentionOnly}
              onChange={(e) => setAttentionOnly(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="font-semibold text-gray-800">Attention only</span>
          </label>

          <button
            type="button"
            onClick={() => load(1)}
            className="h-11 rounded-2xl bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-black"
          >
            Apply
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-5 py-3 text-sm font-extrabold text-gray-900">Orders</div>

        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : items.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1350px] w-full text-sm">
              <thead className="bg-white sticky top-0 z-10">
                <tr className="border-b text-left text-xs font-bold text-gray-600">
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Summary</th>
                  <th className="px-5 py-3">Payable</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Shipment</th>
                  <th className="px-5 py-3">Alerts</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {items.map((o: any) => {
                  const orderId = String(o._id);
                  const orderCode = o?.orderCode || "—";

                  const customerName = o?.contact?.name || o?.address?.fullName || "—";
                  const phone = o?.contact?.phone || o?.address?.phone || "—";
                  const created = o?.createdAt ? fmtDateTime(o.createdAt) : "—";

                  const pm = String(o?.paymentMethod || "COD").toUpperCase();
                  const ps = String(o?.paymentStatus || "PENDING").toUpperCase();
                  const st = String(o?.status || "PLACED").toUpperCase();

                  const sub = Array.isArray(o?.subOrders) ? o.subOrders[0] : null;
                  const soItems = Array.isArray(sub?.items) ? sub.items : [];
                  const itemsCount = soItems.length;

                  const payable = money(pickSubOrderTotal(o, sub || {}));

                  const ship = pickVendorShipment(o);
                  const awb = ship?.shiprocket?.awb || "";
                  const shipmentId = ship?.shiprocket?.shipmentId ?? null;

                  const rm = getReturnMetaVendor(o);
                  const rowAttention = rm.mostCritical === "REQUESTED" || rm.mostCritical === "REFUND_PENDING";

                  const first = soItems[0] || null;
                  const img = first ? pickFirstImage(first) : "";

                  return (
                    <tr
                      key={orderId}
                      className={
                        "border-b last:border-b-0 hover:bg-gray-50/60 " + (rowAttention ? "bg-amber-50/50" : "")
                      }
                    >
                      {/* Order */}
                      <td className="px-5 py-3">
                        <div className={"relative " + (rowAttention ? "pl-3" : "")}>
                          {rowAttention ? (
                            <span className="absolute left-0 top-1 h-10 w-1 rounded-full bg-amber-500" />
                          ) : null}
                          <div className="font-bold text-gray-900">{orderCode}</div>
                          <div className="text-[11px] text-gray-500">ID: {orderId.slice(-8)}</div>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-3">
                        <div className="font-semibold text-gray-900">{customerName}</div>
                        <div className="text-[11px] text-gray-500">{phone}</div>
                      </td>

                      {/* Summary */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded-xl bg-gray-100 shrink-0">
                            {img ? <img src={img} alt="item" className="h-full w-full object-cover" /> : null}
                          </div>

                          <div className="min-w-0">
                            <div className="text-[12px] font-semibold text-gray-900 line-clamp-1">
                              {first?.title || first?.productId?.title || "Product"}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              <Badge tone="blue">{itemsCount} item(s)</Badge>
                              {ship ? <Badge tone="green">Shipment: Yes</Badge> : <Badge tone="gray">Shipment: No</Badge>}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 flex gap-3">
                          <button
                            type="button"
                            onClick={() => openOrder(o, "items")}
                            className="text-[12px] font-semibold text-blue-700 hover:underline"
                          >
                            View details
                          </button>

                          {rm.anyReturn ? (
                            <button
                              type="button"
                              onClick={() => openOrder(o, "returns")}
                              className={
                                "text-[12px] font-semibold hover:underline " +
                                (rm.requested || rm.refundPending ? "text-red-700" : "text-amber-700")
                              }
                            >
                              {rm.requested ? "Action return" : rm.refundPending ? "Refund pending" : "View returns"}
                            </button>
                          ) : null}
                        </div>
                      </td>

                      {/* Payable */}
                      <td className="px-5 py-3">
                        <div className="text-base font-bold text-gray-900">{payable}</div>
                        <div className="text-[11px] text-gray-500">Vendor share</div>
                      </td>

                      {/* Payment */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Badge tone="gray">{pm}</Badge>
                          <Badge tone={toneForPaymentStatus(ps) as any}>{ps}</Badge>
                        </div>

                        {pm === "ONLINE" ? (
                          <div className="mt-2 text-[11px] text-gray-600">
                            {o?.pg?.paymentId ? "RZP captured" : "RZP pending"}
                            {o?.pg?.amount ? ` • ${moneyPaise(o.pg.amount)} ${o?.pg?.currency || "INR"}` : ""}
                          </div>
                        ) : (
                          <div className="mt-2 text-[11px] text-gray-600">COD</div>
                        )}
                      </td>

                      {/* Shipment */}
                      <td className="px-5 py-3">
                        {ship ? (
                          <div className="text-[11px] text-gray-700 space-y-1">
                            <div>
                              <span className="font-semibold">Provider:</span> {ship?.provider || "—"}
                            </div>
                            <div>
                              <span className="font-semibold">Shipment:</span>{" "}
                              <span className="font-mono">{shipmentId ?? "—"}</span>
                            </div>
                            <div>
                              <span className="font-semibold">AWB:</span>{" "}
                              <span className="font-mono">{awb || "—"}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-gray-500">Not created</div>
                        )}
                      </td>

                      {/* Alerts */}
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-2">
                          {rm.requested ? <Badge tone="amber">Return Requested</Badge> : null}
                          {rm.refundPending ? <Badge tone="red">Refund Pending</Badge> : null}
                          {!rm.anyReturn && !rm.refundPending && !rm.requested ? (
                            <span className="text-[12px] text-gray-500">—</span>
                          ) : null}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3">
                        <Badge tone={toneForOrderStatus(st) as any}>{st}</Badge>
                      </td>

                      {/* Created */}
                      <td className="px-5 py-3 text-gray-700">{created}</td>

                      {/* Actions */}
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <IconButton onClick={() => openOrder(o, "items")}>View</IconButton>
                          {(rm.requested || rm.refundPending) ? (
                            <IconButton onClick={() => openOrder(o, "returns")} tone="danger">
                              Action Return
                            </IconButton>
                          ) : rm.anyReturn ? (
                            <IconButton onClick={() => openOrder(o, "returns")}>Returns</IconButton>
                          ) : null}
                          <IconButton onClick={() => openOrder(o, "shipments")}>Ship</IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-gray-600">No orders found.</div>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Page <span className="font-semibold text-gray-900">{page}</span> of{" "}
          <span className="font-semibold text-gray-900">{totalPages}</span>
        </div>

        <div className="flex gap-2">
          <button
            disabled={loading || page <= 1}
            onClick={() => load(page - 1)}
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            disabled={loading || page >= totalPages}
            onClick={() => load(page + 1)}
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Drawer */}
      <Drawer
        open={drawer.open}
        onClose={closeOrder}
        title={drawer.order?.orderCode || "—"}
        subtitle={drawer.order?._id ? `Internal: ${String(drawer.order._id).slice(-8)} • ${fmtDateTime(drawer.order?.createdAt)}` : undefined}
      >
        {drawer.order ? (
          <>
            <Tabs
              value={drawer.tab}
              onChange={(v) => setDrawer((p) => ({ ...p, tab: v as any }))}
              items={[
                { key: "items", label: "Items" },
                { key: "shipments", label: "Shipments" },
                { key: "returns", label: "Returns" },
                { key: "payment", label: "Payment" },
                { key: "customer", label: "Customer" },
              ]}
            />

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Left */}
              <div className="lg:col-span-2 space-y-4">
                {drawer.tab === "items" ? (
                  <div className="rounded-3xl border bg-white p-4">
                    <div className="mb-3 text-sm font-extrabold text-gray-900">Items</div>

                    <div className="space-y-3">
                      {(drawer.sub?.items || []).map((it: any, idx: number) => {
                        const vText = getVariantTextFromItem(it);
                        const colorText = it?.colorKey ? String(it.colorKey) : "";
                        const img = pickFirstImage(it);

                        const line =
                          toNum(it?.finalLineTotal, NaN) ||
                          toNum(it?.lineTotal, NaN) ||
                          (toNum(it?.finalPrice, NaN)
                            ? toNum(it?.finalPrice, 0) * Math.max(1, toNum(it?.qty, 1))
                            : 0);

                        return (
                          <div key={idx} className="flex gap-3 rounded-2xl border p-3">
                            <div className="h-14 w-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                              {img ? <img src={img} alt="it" className="h-full w-full object-cover" /> : null}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-extrabold text-gray-900 line-clamp-1">
                                {it?.title || it?.productId?.title || "Product"}
                              </div>
                              {it?.productCode ? (
                                <div className="text-[11px] text-gray-500 font-semibold">Code: {it.productCode}</div>
                              ) : null}

                              <div className="mt-1 text-[12px] text-gray-700">
                                Qty: {it?.qty || 1}
                                {colorText ? ` • Color: ${colorText}` : ""}
                                {vText ? ` • Variant: ${vText}` : ""}
                              </div>
                            </div>

                            <div className="text-sm font-extrabold text-gray-900">{money(line)}</div>
                          </div>
                        );
                      })}

                      {!(drawer.sub?.items || []).length ? (
                        <div className="text-sm text-gray-600">No items found.</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {drawer.tab === "shipments" ? (
                  <div className="rounded-3xl border bg-white p-4">
                    <div className="mb-3 text-sm font-extrabold text-gray-900">Shipment</div>

                    {(() => {
                      const sh = pickVendorShipment(drawer.order);
                      if (!sh) return <div className="text-sm text-gray-600">Shipment not created yet.</div>;
                      return (
                        <div className="rounded-2xl border p-4">
                          <div className="flex items-center justify-between">
                            <div className="font-extrabold text-gray-900">{sh?.provider || "SHIPROCKET"}</div>
                            <Badge tone="green">Created</Badge>
                          </div>

                          <div className="mt-3 space-y-2 text-sm">
                            <StatRow k="Shipment ID" v={<span className="font-mono">{sh?.shiprocket?.shipmentId ?? "—"}</span>} />
                            <StatRow k="AWB" v={<span className="font-mono">{sh?.shiprocket?.awb || "—"}</span>} />
                            <StatRow k="SR Order" v={<span className="font-mono">{sh?.shiprocket?.orderId || "—"}</span>} />
                            <StatRow k="Created" v={fmtDateTime(sh?.createdAt)} />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : null}

                {drawer.tab === "returns" ? (
                  <div className="rounded-3xl border bg-white p-4">
                    <div className="mb-3 text-sm font-extrabold text-gray-900">Return</div>

                    {(() => {
                      const rm = getReturnMetaVendor(drawer.order);
                      if (!rm.anyReturn) return <div className="text-sm text-gray-600">No return request.</div>;

                      const ret = rm.ret;
                      const refund = rm.refund;

                      const imgs = Array.isArray(ret?.images) ? ret.images : [];
                      const bank = ret?.bankDetails || null;

                      return (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Badge tone={rm.retStatus === "REQUESTED" ? "amber" : rm.retStatus === "REJECTED" ? "red" : "indigo"}>
                              {rm.retStatus || "—"}
                            </Badge>
                            {ret?.requestedAt ? <span className="text-[12px] text-gray-600">Requested: {fmtDateTime(ret.requestedAt)}</span> : null}
                          </div>

                          {ret?.reason ? (
                            <div className="text-sm text-gray-700">
                              Reason: <span className="font-semibold text-gray-900">{String(ret.reason)}</span>
                            </div>
                          ) : null}

                          {ret?.note ? (
                            <div className="text-sm text-gray-700">
                              Note: <span className="font-semibold text-gray-900">{String(ret.note)}</span>
                            </div>
                          ) : null}

                          {rm.retStatus === "REJECTED" && ret?.rejectReason ? (
                            <div className="text-sm text-red-700">Reject: {String(ret.rejectReason)}</div>
                          ) : null}

                          {bank ? (
                            <div className="rounded-2xl border bg-gray-50 p-4 text-sm text-gray-700">
                              <div className="font-extrabold text-gray-900 mb-2">Bank details (COD)</div>
                              <div><span className="font-semibold">Holder:</span> {bank?.accountHolderName || "—"}</div>
                              <div><span className="font-semibold">A/C:</span> {bank?.accountNumber || "—"}</div>
                              <div><span className="font-semibold">IFSC:</span> {bank?.ifsc || "—"}</div>
                              {bank?.bankName ? <div><span className="font-semibold">Bank:</span> {bank.bankName}</div> : null}
                              {bank?.upiId ? <div><span className="font-semibold">UPI:</span> {bank.upiId}</div> : null}
                            </div>
                          ) : null}

                          {imgs.length ? (
                            <div>
                              <div className="text-[12px] font-semibold text-gray-700 mb-2">Images</div>
                              <div className="flex flex-wrap gap-2">
                                {imgs.slice(0, 12).map((p: string, i: number) => {
                                  const src = resolveImageUrl(p);
                                  return (
                                    <a key={i} href={src || "#"} target="_blank" rel="noreferrer" className="h-14 w-14 overflow-hidden rounded-xl border bg-white">
                                      {src ? <img src={src} alt={`ret-${i}`} className="h-full w-full object-cover" /> : null}
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}

                          {refund ? (
                            <div className="rounded-2xl border p-4 text-sm">
                              <div className="font-extrabold text-gray-900 mb-2">Refund</div>
                              <StatRow k="Status" v={<Badge tone={rm.refundStatus === "PROCESSED" ? "green" : "amber"}>{rm.refundStatus || "—"}</Badge>} />
                              <StatRow k="Amount" v={refund?.amount ? money(refund.amount) : "—"} />
                              <StatRow k="Processed" v={refund?.processedAt ? fmtDateTime(refund.processedAt) : "—"} />
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>
                ) : null}

                {drawer.tab === "payment" ? (
                  <div className="rounded-3xl border bg-white p-4">
                    <div className="mb-3 text-sm font-extrabold text-gray-900">Payment</div>
                    {(() => {
                      const pm = String(drawer.order?.paymentMethod || "COD").toUpperCase();
                      const ps = String(drawer.order?.paymentStatus || "PENDING").toUpperCase();
                      const pg = drawer.order?.pg || {};
                      return (
                        <div className="space-y-2 text-sm">
                          <StatRow k="Method" v={pm} />
                          <StatRow k="Status" v={<Badge tone={toneForPaymentStatus(ps) as any}>{ps}</Badge>} />
                          <StatRow k="Payable" v={money(pickSubOrderTotal(drawer.order, drawer.sub || {}))} />

                          {pm === "ONLINE" ? (
                            <>
                              <StatRow k="RZP Order" v={<span className="font-mono">{pg?.orderId || "—"}</span>} />
                              <StatRow k="RZP Payment" v={<span className="font-mono">{pg?.paymentId || "—"}</span>} />
                              <StatRow k="Amount" v={pg?.amount ? `${moneyPaise(pg.amount)} ${pg?.currency || "INR"}` : "—"} />
                              <StatRow k="Verified" v={pg?.verifiedAt ? fmtDateTime(pg.verifiedAt) : "—"} />
                            </>
                          ) : (
                            <StatRow k="COD" v="Cash on Delivery" />
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : null}

                {drawer.tab === "customer" ? (
                  <div className="rounded-3xl border bg-white p-4">
                    <div className="mb-3 text-sm font-extrabold text-gray-900">Customer</div>
                    <div className="space-y-2 text-sm">
                      <StatRow k="Name" v={drawer.order?.contact?.name || drawer.order?.address?.fullName || "—"} />
                      <StatRow k="Phone" v={drawer.order?.contact?.phone || drawer.order?.address?.phone || "—"} />
                      <StatRow k="Email" v={drawer.order?.contact?.email || "—"} />
                      <StatRow k="Address" v={drawer.order?.address?.fullAddress || drawer.order?.address?.address || "—"} />
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Right */}
              <div className="space-y-4">
                <div className="rounded-3xl border bg-white p-4">
                  <div className="mb-2 text-sm font-extrabold text-gray-900">Quick Summary</div>
                  <div className="space-y-2 text-sm">
                    <StatRow k="Order" v={drawer.order?.orderCode || "—"} />
                    <StatRow k="Status" v={<Badge tone={toneForOrderStatus(drawer.order?.status) as any}>{String(drawer.order?.status || "—").toUpperCase()}</Badge>} />
                    <StatRow k="Created" v={fmtDateTime(drawer.order?.createdAt)} />
                    <StatRow k="Payable" v={money(pickSubOrderTotal(drawer.order, drawer.sub || {}))} />
                  </div>
                </div>

                <div className="rounded-3xl border bg-white p-4">
                  <div className="mb-2 text-sm font-extrabold text-gray-900">Alerts</div>
                  {(() => {
                    const rm = getReturnMetaVendor(drawer.order);
                    const sh = pickVendorShipment(drawer.order);
                    const pm = String(drawer.order?.paymentMethod || "COD").toUpperCase();
                    const ps = String(drawer.order?.paymentStatus || "PENDING").toUpperCase();
                    return (
                      <div className="flex flex-wrap gap-2">
                        {rm.requested ? <Badge tone="amber">Return Requested</Badge> : null}
                        {rm.refundPending ? <Badge tone="red">Refund Pending</Badge> : null}
                        {sh ? <Badge tone="green">Shipment Created</Badge> : <Badge tone="gray">No Shipment</Badge>}
                        <Badge tone={toneForPaymentStatus(ps) as any}>{pm} · {ps}</Badge>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </Drawer>
    </div>
  );
}
