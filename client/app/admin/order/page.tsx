/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  adminFetchOrders,
  adminUpdateOrderStatus,
  adminConfirmCod,
  adminCreateShiprocketShipment,
  adminApproveReturn,
  adminRejectReturn,
  adminProcessRefund,
} from "@/lib/adminOrdersApi";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

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

const STATUS_OPTIONS = ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
const PAYMENT_STATUS_OPTIONS = ["PENDING", "PAID", "FAILED"] as const;

function toNum(v: any, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function calcItemsTotal(items: any[]) {
  const arr = Array.isArray(items) ? items : [];
  return arr.reduce((sum, it) => {
    const qty = Math.max(1, Number(it?.qty || 1));

    const line =
      Number(it?.finalLineTotal ?? NaN) ||
      Number(it?.lineTotal ?? NaN) ||
      Number(it?.total ?? NaN) ||
      Number(it?.amount ?? NaN);

    if (Number.isFinite(line) && line > 0) return sum + line;

    const unit =
      Number(it?.finalPrice ?? NaN) ||
      Number(it?.salePrice ?? NaN) ||
      Number(it?.price ?? NaN) ||
      Number(it?.unitPrice ?? NaN);

    if (Number.isFinite(unit) && unit > 0) return sum + unit * qty;

    return sum;
  }, 0);
}

function pickSubOrderTotal(order: any, so: any) {
  const direct =
    toNum(so?.total, NaN) ||
    toNum(so?.grandTotal, NaN) ||
    (toNum(so?.subtotal, NaN) + toNum(so?.shipping, 0));

  if (Number.isFinite(direct) && direct > 0) return direct;

  const computed = calcItemsTotal(so?.items || []);
  if (computed > 0) return computed;

  const totals = order?.totals || {};
  return (
    toNum(totals?.grandTotal, NaN) ||
    toNum(totals?.total, NaN) ||
    toNum(totals?.subtotal, NaN) ||
    toNum(order?.totalAmount, 0)
  );
}

function normalizeSubOrders(order: any) {
  const subs = Array.isArray(order?.subOrders) ? order.subOrders : [];
  if (subs.length) {
    return subs.map((so: any) => ({
      _id: String(so?._id || ""),
      ownerType: so?.ownerType || (so?.vendorId ? "VENDOR" : "ADMIN"),
      vendorId: so?.vendorId ? String(so.vendorId) : "",
      soldBy:
        String(so?.soldBy || "").trim() ||
        String(so?.vendorName || "").trim() ||
        (so?.vendorId ? "Vendor" : "Mechkart"),
      vendorName: String(so?.vendorName || "").trim(),
      status: String(so?.status || order?.status || "PLACED").toUpperCase(),
      items: Array.isArray(so?.items) ? so.items : [],
      shipment: so?.shipment || null,
      subtotal: so?.subtotal,
      shipping: so?.shipping,
      total: so?.total,
      return: so?.return || null,
      refund: so?.refund || null,
    }));
  }

  const legacyItems = Array.isArray(order?.items) ? order.items : [];
  return [
    {
      _id: "LEGACY",
      ownerType: "ADMIN",
      vendorId: "",
      soldBy: "Mechkart",
      vendorName: "",
      status: String(order?.status || "PLACED").toUpperCase(),
      items: legacyItems,
      shipment: null,
      subtotal: order?.totals?.subtotal,
      shipping: order?.totals?.shipping,
      total: order?.totals?.grandTotal ?? order?.totals?.total ?? order?.totalAmount,
      return: order?.return || null,
      refund: order?.refund || null,
    },
  ];
}

function pickVariantId(it: any) {
  return it?.variantId?._id || it?.variantId || it?.variant?._id || it?.variant || null;
}

function getVariantTextFromItem(it: any) {
  const vid = pickVariantId(it);
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

  const text = v?.label || v?.comboText || v?.size || v?.weight || "";
  return String(text || "").trim();
}

/* ---------------- UI helpers ---------------- */

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

function hasShiprocketShipment(o: any) {
  return Array.isArray(o?.shipments) && o.shipments.some((s: any) => s?.provider === "SHIPROCKET");
}

function shiprocketShipments(o: any) {
  const list = Array.isArray(o?.shipments) ? o.shipments.filter((s: any) => s?.provider === "SHIPROCKET") : [];
  return [...list].sort((a: any, b: any) => {
    const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

/* --------- Return meta for table Alerts (critical UX) --------- */

function getReturnMeta(order: any) {
  const subs = normalizeSubOrders(order);

  if (subs.length === 1) {
    subs[0].return = subs[0].return || order?.return || null;
    subs[0].refund = subs[0].refund || order?.refund || null;
  }

  const returns = subs
    .map((so: any) => ({
      soldBy: so?.soldBy,
      status: String(so?.return?.status || "").toUpperCase(),
      refundStatus: String(so?.refund?.status || "").toUpperCase(),
    }))
    .filter((x: any) => x.status);

  const hasAnyReturn = returns.length > 0;
  const requestedCount = returns.filter((r: any) => r.status === "REQUESTED").length;
  const approvedCount = returns.filter((r: any) => r.status === "APPROVED").length;
  const receivedCount = returns.filter((r: any) => r.status === "RECEIVED").length;
  const refundedCount = returns.filter((r: any) => r.status === "REFUNDED").length;

  const refundPendingCount = returns.filter(
    (r: any) => ["APPROVED", "RECEIVED"].includes(r.status) && r.refundStatus !== "PROCESSED"
  ).length;

  const mostCritical =
    requestedCount > 0
      ? "REQUESTED"
      : refundPendingCount > 0
        ? "REFUND_PENDING"
        : hasAnyReturn
          ? "RETURN_EXISTS"
          : "";

  return {
    hasAnyReturn,
    requestedCount,
    approvedCount,
    receivedCount,
    refundedCount,
    refundPendingCount,
    mostCritical,
    returns,
  };
}

/* ------------------ Page ------------------ */

export default function AdminOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<string>("");

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

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"items" | "shipments" | "returns" | "payment" | "customer">("items");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const openOrder = (o: any, tab: typeof activeTab = "items") => {
    setSelectedOrder(o);
    setActiveTab(tab);
    setDrawerOpen(true);
  };
  const closeOrder = () => {
    setDrawerOpen(false);
    setSelectedOrder(null);
  };

  const load = async (nextPage = 1) => {
    try {
      setLoading(true);
      setError(null);

      const resp = await adminFetchOrders({
        q,
        status,
        paymentMethod: paymentMethod as "COD" | "ONLINE" | undefined,
        paymentStatus: paymentStatus as "PENDING" | "PAID" | "FAILED" | undefined,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onApplyFilters = async () => load(1);

  const patchLocalOrder = (orderId: string, patch: any) => {
    setData((prev: any) => ({
      ...prev,
      items: (prev.items || []).map((o: any) => (String(o._id) === String(orderId) ? { ...o, ...patch } : o)),
    }));
  };

  const replaceLocalOrder = (orderId: string, next: any) => {
    setData((prev: any) => ({
      ...prev,
      items: (prev.items || []).map((o: any) => (String(o._id) === String(orderId) ? next : o)),
    }));
    setSelectedOrder((prev: any) => (prev && String(prev._id) === String(orderId) ? next : prev));
  };

  const onChangeStatus = async (orderId: string, nextStatus: string) => {
    try {
      setBusyId(orderId);
      setError(null);

      patchLocalOrder(orderId, { status: nextStatus });
      const updated = await adminUpdateOrderStatus(orderId, nextStatus as any);
      replaceLocalOrder(orderId, updated);
    } catch (e: any) {
      setError(e?.message || "Status update failed");
      await load(page);
    } finally {
      setBusyId(null);
    }
  };

  const onConfirmCod = async (orderId: string) => {
    try {
      setBusyId(orderId);
      setError(null);

      patchLocalOrder(orderId, {
        status: "CONFIRMED",
        cod: { confirmedAt: new Date().toISOString() },
      });

      const updated = await adminConfirmCod(orderId);
      replaceLocalOrder(orderId, updated);
    } catch (e: any) {
      setError(e?.message || "Confirm COD failed");
      await load(page);
    } finally {
      setBusyId(null);
    }
  };

  const onCreateShipment = async (orderId: string) => {
    try {
      setBusyId(orderId);
      setError(null);

      patchLocalOrder(orderId, { status: "SHIPPED" });

      const updated = await adminCreateShiprocketShipment(orderId);
      replaceLocalOrder(orderId, updated);
    } catch (e: any) {
      setError(e?.message || "Create shipment failed");
      await load(page);
    } finally {
      setBusyId(null);
    }
  };

  const onApproveReturn = async (orderId: string) => {
    try {
      setBusyId(orderId);
      setError(null);

      const updated = await adminApproveReturn(orderId);
      replaceLocalOrder(orderId, updated);
    } catch (e: any) {
      setError(e?.message || "Approve return failed");
      await load(page);
    } finally {
      setBusyId(null);
    }
  };

  const onRejectReturn = async (orderId: string) => {
    try {
      const reason = prompt("Reject reason?") || "";
      if (!reason.trim()) return;

      setBusyId(orderId);
      setError(null);

      const updated = await adminRejectReturn(orderId, reason.trim());
      replaceLocalOrder(orderId, updated);
    } catch (e: any) {
      setError(e?.message || "Reject return failed");
      await load(page);
    } finally {
      setBusyId(null);
    }
  };

  const onProcessRefund = async (orderId: string) => {
    try {
      const ok = confirm("Process refund now?");
      if (!ok) return;

      const raw = prompt("Refund amount in RUPEES? (Leave blank for full refund)") || "";
      const amt = raw.trim() ? Number(raw.trim()) : undefined;
      const amount = Number.isFinite(amt as any) && (amt as number) > 0 ? (amt as number) : undefined;

      setBusyId(orderId);
      setError(null);

      const updated = await adminProcessRefund(orderId, amount);
      replaceLocalOrder(orderId, updated);
    } catch (e: any) {
      setError(e?.message || "Refund failed");
      await load(page);
    } finally {
      setBusyId(null);
    }
  };

  const items = useMemo(() => {
    if (!attentionOnly) return rawItems;

    return rawItems.filter((o: any) => {
      const pm = String(o?.paymentMethod || "COD").toUpperCase();
      const st = String(o?.status || "PLACED").toUpperCase();
      const cod = o?.cod || null;
      const codConfirmedAt = cod?.confirmedAt || null;
      const codIsConfirmed =
        pm === "COD" && (Boolean(codConfirmedAt) || ["CONFIRMED", "SHIPPED", "DELIVERED"].includes(st));

      const rm = getReturnMeta(o);
      const needsAttention = rm.mostCritical === "REQUESTED" || rm.mostCritical === "REFUND_PENDING";
      const codAttention = pm === "COD" && !codIsConfirmed;

      return needsAttention || codAttention;
    });
  }, [rawItems, attentionOnly]);

  const summaryText = useMemo(() => {
    const total = Number(data?.total || 0);
    const shown = items.length;
    return attentionOnly ? `Showing ${shown} of ${total} (Attention only)` : `${total} order(s)`;
  }, [data?.total, items.length, attentionOnly]);

  // ✅ Return block (drawer only)
  const ReturnBlock = ({ orderId, sub, isBusy }: { orderId: string; sub: any; isBusy: boolean }) => {
    const ret = sub?.return || null;
    const retStatus = String(ret?.status || "").toUpperCase();
    const refund = sub?.refund || null;
    const refundStatus = String(refund?.status || "").toUpperCase();

    const canApproveReject = retStatus === "REQUESTED";
    const canRefund = ["APPROVED", "RECEIVED"].includes(retStatus);
    const refundProcessed = refundStatus === "PROCESSED" || retStatus === "REFUNDED";
    const refundButtonDisabled = !canRefund || refundProcessed || isBusy;

    const bank = ret?.bankDetails || null;
    const imgs = Array.isArray(ret?.images) ? ret.images : [];

    if (!retStatus) return <div className="text-[12px] text-gray-500">No return request.</div>;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge tone={retStatus === "REQUESTED" ? "amber" : retStatus === "REJECTED" ? "red" : "indigo"}>
            {retStatus}
          </Badge>
          {ret?.requestedAt ? (
            <span className="text-[12px] text-gray-600">Requested: {fmtDateTime(ret.requestedAt)}</span>
          ) : null}
        </div>

        {ret?.reason ? (
          <div className="text-[12px] text-gray-700">
            Reason: <span className="font-semibold text-gray-900">{String(ret.reason)}</span>
          </div>
        ) : null}

        {ret?.note ? (
          <div className="text-[12px] text-gray-700">
            Note: <span className="font-semibold text-gray-900">{String(ret.note)}</span>
          </div>
        ) : null}

        {retStatus === "REJECTED" && ret?.rejectReason ? (
          <div className="text-[12px] text-red-700">Reject: {String(ret.rejectReason)}</div>
        ) : null}

        {bank ? (
          <div className="rounded-2xl border bg-gray-50 p-3 text-[12px] text-gray-700">
            <div className="font-extrabold text-gray-900 mb-2">Bank details (COD)</div>
            <div>
              <span className="font-semibold">Holder:</span> {bank?.accountHolderName || "—"}
            </div>
            <div>
              <span className="font-semibold">A/C:</span> {bank?.accountNumber || "—"}
            </div>
            <div>
              <span className="font-semibold">IFSC:</span> {bank?.ifsc || "—"}
            </div>
            {bank?.bankName ? (
              <div>
                <span className="font-semibold">Bank:</span> {bank.bankName}
              </div>
            ) : null}
            {bank?.upiId ? (
              <div>
                <span className="font-semibold">UPI:</span> {bank.upiId}
              </div>
            ) : null}
          </div>
        ) : null}

        {imgs.length ? (
          <div>
            <div className="text-[12px] font-semibold text-gray-700 mb-2">Images</div>
            <div className="flex flex-wrap gap-2">
              {imgs.slice(0, 10).map((p: string, i: number) => {
                const src = resolveImageUrl(p);
                return (
                  <a
                    key={i}
                    href={src || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="h-14 w-14 overflow-hidden rounded-xl border bg-white"
                    title="Open"
                  >
                    {src ? <img src={src} alt={`ret-${i}`} className="h-full w-full object-cover" /> : null}
                  </a>
                );
              })}
            </div>
          </div>
        ) : null}

        {canApproveReject ? (
          <div className="flex gap-2">
            <IconButton disabled={isBusy} onClick={() => onApproveReturn(orderId)} tone="primary">
              {isBusy ? "..." : "Approve"}
            </IconButton>
            <IconButton disabled={isBusy} onClick={() => onRejectReturn(orderId)} tone="danger">
              {isBusy ? "..." : "Reject"}
            </IconButton>
          </div>
        ) : null}

        {refund ? (
          <div className="text-[12px] text-gray-700">
            Refund: <span className="font-semibold">{refundStatus || "—"}</span>
            {refund?.amount ? <span className="text-gray-500"> • {money(refund.amount)}</span> : null}
            {refund?.processedAt ? <span className="text-gray-500"> • {fmtDateTime(refund.processedAt)}</span> : null}
          </div>
        ) : null}

        {canRefund ? (
          <IconButton disabled={refundButtonDisabled} onClick={() => onProcessRefund(orderId)} tone="primary">
            {isBusy ? "Processing…" : refundProcessed ? "Refund Done" : "Process Refund"}
          </IconButton>
        ) : null}

        {retStatus === "REFUNDED" ? (
          <div className="text-[12px] font-semibold text-emerald-700">Refund Completed</div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Admin · Orders</h1>
          <p className="text-sm text-gray-600">{summaryText}</p>
        </div>

        <div className="flex gap-2">
          <Link href="/admin" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50">
            Admin Home
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
            placeholder="Search: order code / name / phone / RZP id"
            className="h-11 rounded-2xl border px-4 text-sm outline-none focus:border-gray-400 sm:col-span-2"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-11 rounded-2xl border px-4 text-sm outline-none focus:border-gray-400 bg-white"
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map((s) => (
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
            {PAYMENT_STATUS_OPTIONS.map((s) => (
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
            onClick={onApplyFilters}
            className="h-11 rounded-2xl bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-black"
          >
            Apply
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
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
            <table className="min-w-[1450px] w-full text-sm">
              <thead className="bg-white sticky top-0 z-10">
                <tr className="border-b text-left text-xs font-bold text-gray-600">
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Summary</th>
                  <th className="px-5 py-3">Payable</th>
                  <th className="px-5 py-3">Payment</th>
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
                  const customerName = o?.contact?.name || "—";
                  const phone = o?.contact?.phone || "—";
                  const created = o?.createdAt ? new Date(o.createdAt).toLocaleString("en-IN") : "—";

                  const payable = o?.totals?.grandTotal ?? o?.totals?.subtotal ?? o?.totalAmount ?? 0;

                  const pm = String(o?.paymentMethod || "COD").toUpperCase();
                  const ps = String(o?.paymentStatus || "PENDING").toUpperCase();
                  const st = String(o?.status || "PLACED").toUpperCase();

                  const pg = o?.pg || {};
                  const rzpPaymentId = pg?.paymentId || "";
                  const rzpAmountPaise = pg?.amount;
                  const rzpCurrency = pg?.currency || "INR";

                  const cod = o?.cod || null;
                  const codConfirmedAt = cod?.confirmedAt || null;

                  const codIsConfirmed =
                    pm === "COD" && (Boolean(codConfirmedAt) || ["CONFIRMED", "SHIPPED", "DELIVERED"].includes(st));

                  const isBusy = busyId === orderId;
                  const lockedDelivered = st === "DELIVERED";
                  const lockedCancelled = st === "CANCELLED";

                  const isCodPlaced = pm === "COD" && st === "PLACED";
                  const blockShipUntilConfirm = pm === "COD" && !codIsConfirmed;

                  const subOrders = normalizeSubOrders(o);
                  const vendorsCount = subOrders.length;
                  const itemsCount = subOrders.reduce(
                    (sum: number, so: any) => sum + (Array.isArray(so?.items) ? so.items.length : 0),
                    0
                  );

                  // returns + row attention
                  const returnMeta = getReturnMeta(o);
                  const rowAttention =
                    returnMeta.mostCritical === "REQUESTED" ||
                    returnMeta.mostCritical === "REFUND_PENDING" ||
                    (pm === "COD" && !codIsConfirmed);

                  // shipments
                  const shipmentExists = hasShiprocketShipment(o);
                  const canCreateShipment =
                    st === "CONFIRMED" &&
                    !shipmentExists &&
                    !(pm === "COD" && !codIsConfirmed) &&
                    !(pm === "ONLINE" && ps !== "PAID");

                  return (
                    <tr
                      key={orderId}
                      className={
                        "border-b last:border-b-0 hover:bg-gray-50/60 " +
                        (rowAttention ? "bg-amber-50/50" : "")
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
                          {vendorsCount > 1 ? (
                            <div className="mt-2">
                              <Badge tone="indigo">Split: {vendorsCount} vendors</Badge>
                            </div>
                          ) : null}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-3">
                        <div className="font-semibold text-gray-900">{customerName}</div>
                        <div className="text-[11px] text-gray-500">{phone}</div>
                      </td>

                      {/* Summary */}
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="blue">{itemsCount} item(s)</Badge>
                          <Badge tone={shipmentExists ? "green" : "gray"}>
                            {shipmentExists ? "Shipment: Yes" : "Shipment: No"}
                          </Badge>
                          {vendorsCount > 1 ? <Badge tone="indigo">{vendorsCount} vendors</Badge> : <Badge tone="gray">Single vendor</Badge>}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => openOrder(o, "items")}
                            className="text-[12px] font-semibold text-blue-700 hover:underline"
                          >
                            View details
                          </button>

                          {returnMeta.hasAnyReturn ? (
                            <button
                              type="button"
                              onClick={() => openOrder(o, "returns")}
                              className={
                                "text-[12px] font-semibold hover:underline " +
                                (returnMeta.mostCritical === "REQUESTED" || returnMeta.mostCritical === "REFUND_PENDING"
                                  ? "text-red-700"
                                  : "text-amber-700")
                              }
                            >
                              {returnMeta.mostCritical === "REQUESTED"
                                ? "Action return"
                                : returnMeta.mostCritical === "REFUND_PENDING"
                                  ? "Refund pending"
                                  : "View returns"}
                            </button>
                          ) : null}
                        </div>
                      </td>

                      {/* Payable */}
                      <td className="px-5 py-3">
                        <div className="text-base font-bold text-gray-900">{money(payable)}</div>
                        {o?.totals?.discount ? (
                          <div className="mt-1 text-[11px] font-semibold text-emerald-700">
                            Discount: -{money(o.totals.discount)}
                          </div>
                        ) : null}
                      </td>

                      {/* Payment */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Badge tone="gray">{pm}</Badge>
                          <Badge tone={toneForPaymentStatus(ps) as any}>{ps}</Badge>
                        </div>
                        <div className="mt-2 text-[11px] text-gray-600">
                          {pm === "ONLINE" ? (
                            <>
                              {rzpPaymentId ? "RZP captured" : "RZP pending"}{" "}
                              {rzpAmountPaise ? `• ${moneyPaise(rzpAmountPaise)} ${rzpCurrency}` : ""}
                            </>
                          ) : (
                            <>
                              {codIsConfirmed ? "COD confirmed" : "COD not confirmed"}
                              {codConfirmedAt ? ` • ${fmtDateTime(codConfirmedAt)}` : ""}
                            </>
                          )}
                        </div>

                        {isCodPlaced ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onConfirmCod(orderId)}
                            className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-emerald-600 px-3 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {isBusy ? "Confirming…" : "Confirm COD"}
                          </button>
                        ) : null}
                      </td>

                      {/* Alerts (THIS FIXES YOUR PROBLEM) */}
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-2">
                          {returnMeta.requestedCount > 0 ? (
                            <Badge tone="amber">Return Requested ({returnMeta.requestedCount})</Badge>
                          ) : null}

                          {returnMeta.refundPendingCount > 0 ? (
                            <Badge tone="red">Refund Pending ({returnMeta.refundPendingCount})</Badge>
                          ) : null}

                          {pm === "COD" && !codIsConfirmed ? <Badge tone="amber">COD Not Confirmed</Badge> : null}

                          {returnMeta.requestedCount === 0 &&
                          returnMeta.refundPendingCount === 0 &&
                          !(pm === "COD" && !codIsConfirmed) ? (
                            <span className="text-[12px] text-gray-500">—</span>
                          ) : null}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3">
                        <div className="mb-2">
                          <Badge tone={toneForOrderStatus(st) as any}>{st}</Badge>
                        </div>

                        <select
                          value={st}
                          disabled={isBusy || lockedDelivered || lockedCancelled}
                          onChange={(e) => onChangeStatus(orderId, e.target.value)}
                          className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-gray-400 bg-white disabled:opacity-60"
                        >
                          {STATUS_OPTIONS.map((s) => {
                            const disableConfirmed = pm === "COD" && st === "PLACED" && s === "CONFIRMED";
                            const disableShipDeliver = blockShipUntilConfirm && (s === "SHIPPED" || s === "DELIVERED");
                            return (
                              <option key={s} value={s} disabled={disableConfirmed || disableShipDeliver}>
                                {s}
                              </option>
                            );
                          })}
                        </select>

                        {pm === "COD" && !codIsConfirmed ? (
                          <div className="mt-1 text-[11px] text-gray-500">Confirm COD before shipping.</div>
                        ) : null}

                        {isBusy ? <div className="mt-1 text-[11px] text-gray-500">Updating…</div> : null}
                      </td>

                      {/* Created */}
                      <td className="px-5 py-3 text-gray-700">{created}</td>

                      {/* Actions */}
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <IconButton onClick={() => openOrder(o, "items")}>View</IconButton>

                          {(returnMeta.mostCritical === "REQUESTED" || returnMeta.mostCritical === "REFUND_PENDING") ? (
                            <IconButton onClick={() => openOrder(o, "returns")} tone="danger">
                              Action Return
                            </IconButton>
                          ) : returnMeta.hasAnyReturn ? (
                            <IconButton onClick={() => openOrder(o, "returns")}>Returns</IconButton>
                          ) : null}

                          {!shipmentExists ? (
                            <IconButton
                              disabled={!canCreateShipment || isBusy}
                              onClick={() => onCreateShipment(orderId)}
                              tone="primary"
                            >
                              {isBusy ? "…" : "Create SR"}
                            </IconButton>
                          ) : (
                            <IconButton onClick={() => openOrder(o, "shipments")}>Shipments</IconButton>
                          )}
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
        open={drawerOpen}
        onClose={closeOrder}
        title={selectedOrder?.orderCode || "—"}
        subtitle={selectedOrder?._id ? `Internal: ${String(selectedOrder._id).slice(-8)}` : undefined}
      >
        {selectedOrder ? (
          <>
            <Tabs
              value={activeTab}
              onChange={(v) => setActiveTab(v as any)}
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
                {activeTab === "items" ? (
                  <div className="rounded-3xl border bg-white p-4">
                    <div className="mb-3 text-sm font-extrabold text-gray-900">Items (Vendor-wise)</div>

                    {normalizeSubOrders(selectedOrder).map((so: any, idx: number) => {
                      const itemsArr = Array.isArray(so?.items) ? so.items : [];
                      return (
                        <div key={so._id || idx} className="mb-3 rounded-2xl border p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-extrabold text-gray-900">{so.soldBy}</div>
                              {so.vendorName ? <div className="text-[12px] text-gray-500">{so.vendorName}</div> : null}
                            </div>
                            <div className="text-sm font-semibold text-gray-800">
                              {money(pickSubOrderTotal(selectedOrder, so))}
                            </div>
                          </div>

                          <div className="mt-3 space-y-3">
                            {itemsArr.map((it: any, i: number) => {
                              const vText = getVariantTextFromItem(it);
                              const colorText = it?.colorKey ? String(it.colorKey) : "";
                              return (
                                <div key={i} className="rounded-2xl bg-gray-50 p-3">
                                  <div className="font-semibold text-gray-900">{it.title}</div>
                                  <div className="mt-1 text-[12px] text-gray-600">
                                    {vText ? `Variant: ${vText}` : null}
                                    {colorText ? ` • Color: ${colorText}` : null}
                                    {" • "}Qty: {it.qty}
                                  </div>
                                  {it.productCode ? (
                                    <div className="mt-1 text-[12px] text-gray-500">Code: {it.productCode}</div>
                                  ) : null}
                                </div>
                              );
                            })}
                            {!itemsArr.length ? <div className="text-sm text-gray-600">No items for this vendor.</div> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {activeTab === "shipments" ? (
                  <div className="rounded-3xl border bg-white p-4">
                    <div className="mb-3 text-sm font-extrabold text-gray-900">Shipments</div>

                    {hasShiprocketShipment(selectedOrder) ? (
                      <div className="space-y-3">
                        {shiprocketShipments(selectedOrder).map((sr: any, idx: number) => {
                          const awb = sr?.shiprocket?.awb || "—";
                          const shipmentId = sr?.shiprocket?.shipmentId ?? "—";
                          const srOrder = sr?.shiprocket?.orderId || "—";
                          return (
                            <div key={idx} className="rounded-2xl border p-4">
                              <div className="flex items-center justify-between">
                                <div className="font-extrabold text-gray-900">SHIPROCKET</div>
                                <Badge tone="green">Created</Badge>
                              </div>
                              <div className="mt-3 space-y-2 text-sm">
                                <StatRow k="Shipment ID" v={<span className="font-mono">{shipmentId}</span>} />
                                <StatRow k="AWB" v={<span className="font-mono">{awb}</span>} />
                                <StatRow k="SR Order" v={<span className="font-mono">{srOrder}</span>} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-gray-50 p-4">
                        <div className="text-sm text-gray-700">No shipment created.</div>
                      </div>
                    )}
                  </div>
                ) : null}

                {activeTab === "returns" ? (
                  <div className="rounded-3xl border bg-white p-4">
                    <div className="mb-3 text-sm font-extrabold text-gray-900">Returns (Vendor-wise)</div>

                    {(() => {
                      const subs = normalizeSubOrders(selectedOrder);
                      if (subs.length === 1) {
                        subs[0].return = subs[0].return || selectedOrder?.return || null;
                        subs[0].refund = subs[0].refund || selectedOrder?.refund || null;
                      }

                      const any = subs.some((s: any) => s?.return);
                      if (!any) return <div className="text-sm text-gray-600">No return requests.</div>;

                      const isBusy = busyId === String(selectedOrder._id);

                      return (
                        <div className="space-y-3">
                          {subs.map((so: any, idx: number) => (
                            <div key={so._id || idx} className="rounded-2xl border p-4">
                              <div className="mb-2 flex items-center justify-between">
                                <div className="font-extrabold text-gray-900">{so.soldBy}</div>
                                <Badge tone="amber">{String(so?.return?.status || "—").toUpperCase()}</Badge>
                              </div>
                              <ReturnBlock orderId={String(selectedOrder._id)} sub={so} isBusy={isBusy} />
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                ) : null}

                {activeTab === "payment" ? (
                  <div className="rounded-3xl border bg-white p-4">
                    <div className="mb-3 text-sm font-extrabold text-gray-900">Payment</div>

                    {(() => {
                      const pm = String(selectedOrder?.paymentMethod || "COD").toUpperCase();
                      const ps = String(selectedOrder?.paymentStatus || "PENDING").toUpperCase();
                      const pg = selectedOrder?.pg || {};
                      const rzpOrderId = pg?.orderId || "";
                      const rzpPaymentId = pg?.paymentId || "";
                      const rzpAmountPaise = pg?.amount;
                      const rzpCurrency = pg?.currency || "INR";
                      const verifiedAt = pg?.verifiedAt || null;

                      const cod = selectedOrder?.cod || null;
                      const codConfirmedAt = cod?.confirmedAt || null;

                      return (
                        <div className="space-y-2 text-sm">
                          <StatRow k="Method" v={pm} />
                          <StatRow k="Status" v={<Badge tone={toneForPaymentStatus(ps) as any}>{ps}</Badge>} />
                          <StatRow
                            k="Payable"
                            v={money(selectedOrder?.totals?.grandTotal ?? selectedOrder?.totalAmount ?? 0)}
                          />

                          {pm === "ONLINE" ? (
                            <>
                              <StatRow k="RZP Order" v={<span className="font-mono">{rzpOrderId || "—"}</span>} />
                              <StatRow k="RZP Payment" v={<span className="font-mono">{rzpPaymentId || "—"}</span>} />
                              <StatRow
                                k="Amount"
                                v={rzpAmountPaise ? `${moneyPaise(rzpAmountPaise)} ${rzpCurrency}` : "—"}
                              />
                              <StatRow k="Verified" v={verifiedAt ? fmtDateTime(verifiedAt) : "—"} />
                            </>
                          ) : (
                            <StatRow
                              k="COD"
                              v={codConfirmedAt ? `Confirmed (${fmtDateTime(codConfirmedAt)})` : "Not confirmed"}
                            />
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : null}

                {activeTab === "customer" ? (
                  <div className="rounded-3xl border bg-white p-4">
                    <div className="mb-3 text-sm font-extrabold text-gray-900">Customer</div>
                    <div className="space-y-2 text-sm">
                      <StatRow k="Name" v={selectedOrder?.contact?.name || "—"} />
                      <StatRow k="Phone" v={selectedOrder?.contact?.phone || "—"} />
                      <StatRow k="Email" v={selectedOrder?.contact?.email || "—"} />
                      <StatRow
                        k="Address"
                        v={selectedOrder?.address?.fullAddress || selectedOrder?.address?.address || "—"}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Right */}
              <div className="space-y-4">
                <div className="rounded-3xl border bg-white p-4">
                  <div className="mb-2 text-sm font-extrabold text-gray-900">Quick Summary</div>
                  <div className="space-y-2 text-sm">
                    <StatRow k="Order" v={selectedOrder?.orderCode || "—"} />
                    <StatRow
                      k="Status"
                      v={
                        <Badge tone={toneForOrderStatus(selectedOrder?.status) as any}>
                          {String(selectedOrder?.status || "—").toUpperCase()}
                        </Badge>
                      }
                    />
                    <StatRow k="Created" v={fmtDateTime(selectedOrder?.createdAt)} />
                    <StatRow k="Payable" v={money(selectedOrder?.totals?.grandTotal ?? selectedOrder?.totalAmount ?? 0)} />
                  </div>
                </div>

                <div className="rounded-3xl border bg-white p-4">
                  <div className="mb-2 text-sm font-extrabold text-gray-900">Actions</div>

                  {(() => {
                    const orderId = String(selectedOrder._id);
                    const pm = String(selectedOrder?.paymentMethod || "COD").toUpperCase();
                    const st = String(selectedOrder?.status || "PLACED").toUpperCase();
                    const isBusy = busyId === orderId;
                    const shipmentExists = hasShiprocketShipment(selectedOrder);

                    const cod = selectedOrder?.cod || null;
                    const codConfirmedAt = cod?.confirmedAt || null;
                    const codIsConfirmed =
                      pm === "COD" && (Boolean(codConfirmedAt) || ["CONFIRMED", "SHIPPED", "DELIVERED"].includes(st));

                    const ps = String(selectedOrder?.paymentStatus || "PENDING").toUpperCase();
                    const canCreateShipment =
                      st === "CONFIRMED" &&
                      !shipmentExists &&
                      !(pm === "COD" && !codIsConfirmed) &&
                      !(pm === "ONLINE" && ps !== "PAID");

                    const isCodPlaced = pm === "COD" && st === "PLACED";

                    return (
                      <div className="flex flex-wrap gap-2">
                        <IconButton onClick={() => setActiveTab("items")}>Items</IconButton>
                        <IconButton onClick={() => setActiveTab("shipments")}>Shipments</IconButton>
                        <IconButton onClick={() => setActiveTab("returns")}>Returns</IconButton>

                        {isCodPlaced ? (
                          <IconButton disabled={isBusy} onClick={() => onConfirmCod(orderId)} tone="primary">
                            {isBusy ? "…" : "Confirm COD"}
                          </IconButton>
                        ) : null}

                        {!shipmentExists ? (
                          <IconButton disabled={!canCreateShipment || isBusy} onClick={() => onCreateShipment(orderId)} tone="primary">
                            {isBusy ? "…" : "Create Shipment"}
                          </IconButton>
                        ) : null}
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
