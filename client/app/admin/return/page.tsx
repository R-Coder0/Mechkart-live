/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  adminApproveReturn,
  adminFetchReturns,
  adminRejectReturn,
  type AdminReturnRow,
  type ReturnStatus,
} from "@/lib/adminReturnsApi";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

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

function money(n: any) {
  const x = Number(n || 0);
  return `₹${Math.round(x)}`;
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
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[tone] || map.gray}`}
    >
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
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles}`}
    >
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
            <div className="text-[12px] font-semibold text-gray-500">
              {subtitle || "Return Details"}
            </div>
            <div className="truncate text-lg font-extrabold text-gray-900">
              {title}
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border px-4 text-sm font-semibold hover:bg-gray-50"
          >
            Close
          </button>
        </div>
        <div className="h-[calc(100%-73px)] overflow-y-auto p-5">
          {children}
        </div>
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
              (active
                ? "bg-gray-900 text-white"
                : "border bg-white text-gray-800 hover:bg-gray-50")
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

function toneForReturnStatus(st: string) {
  const s = String(st || "").toUpperCase();
  if (s === "REQUESTED") return "amber";
  if (s === "REJECTED") return "red";
  if (s === "REFUNDED") return "green";
  if (["APPROVED", "PICKUP_CREATED", "RECEIVED"].includes(s)) return "indigo";
  return "gray";
}

function isAttentionRow(r: AdminReturnRow) {
  const rs = String(r?.returnStatus || "").toUpperCase();
  const refundStatus = String(r?.refund?.status || "").toUpperCase();
  const refundPending =
    ["APPROVED", "RECEIVED"].includes(rs) && refundStatus !== "PROCESSED";
  return rs === "REQUESTED" || refundPending;
}

const STATUS_OPTIONS: Array<ReturnStatus | ""> = [
  "",
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "PICKUP_CREATED",
  "RECEIVED",
  "REFUNDED",
];
const OWNER_OPTIONS: Array<"" | "ADMIN" | "VENDOR"> = ["", "ADMIN", "VENDOR"];

/* =========================
 * Refund call
 * ========================= */
async function adminProcessRefund(
  orderId: string,
  subOrderId: string,
  returnId: string
) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  if (!token) throw new Error("Admin token missing. Please login again.");

  const res = await fetch(
    `${API_BASE}/admin/orders/${orderId}/suborders/${subOrderId}/returns/${returnId}/refund`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Refund failed");
  return json;
}

/* =========================
 * Item helpers
 * ========================= */

function safeStr(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeId(v: any) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return String(v?._id || v?.id || "");
  return String(v);
}

function getVariantText(it: any) {
  return (
    safeStr(it?.variantLabel) ||
    safeStr(it?.variantName) ||
    safeStr(it?.variantText) ||
    safeStr(it?.variantSnapshot?.label) ||
    safeStr(it?.variantSnapshot?.comboText) ||
    safeStr(it?.variantSnapshot?.size) ||
    safeStr(it?.variantSnapshot?.weight) ||
    ""
  );
}

function getItemTitle(it: any) {
  return (
    safeStr(it?.title) ||
    safeStr(it?.name) ||
    safeStr(it?.productTitle) ||
    safeStr(it?.productName) ||
    safeStr(it?.productId?.title) ||
    safeStr(it?.productId?.name) ||
    safeStr(it?.product?.title) ||
    safeStr(it?.product?.name) ||
    ""
  );
}

function getItemSku(it: any) {
  return (
    safeStr(it?.productCode) ||
    safeStr(it?.sku) ||
    safeStr(it?.productId?.productCode) ||
    safeStr(it?.productId?.sku) ||
    safeStr(it?.product?.productCode) ||
    safeStr(it?.product?.sku) ||
    ""
  );
}

function getItemImage(it: any) {
  const raw =
    safeStr(it?.image) ||
    safeStr(it?.featureImage) ||
    safeStr(it?.productId?.featureImage) ||
    safeStr(it?.product?.featureImage) ||
    (Array.isArray(it?.productId?.galleryImages) && it?.productId?.galleryImages[0]) ||
    (Array.isArray(it?.product?.galleryImages) && it?.product?.galleryImages[0]) ||
    "";
  return resolveImageUrl(raw);
}

function matchOrderItem(subOrderItems: any[], it: any) {
  const pid = normalizeId(it?.productId);
  const vid = normalizeId(it?.variantId);
  const ck = safeStr(it?.colorKey).toLowerCase();

  return subOrderItems.find((x: any) => {
    const xpid = normalizeId(x?.productId);
    const xvid = normalizeId(x?.variantId);
    const xck = safeStr(x?.colorKey).toLowerCase();

    const productMatch = pid && xpid && xpid === pid;
    const variantMatch = (!vid && !xvid) || (vid && xvid && xvid === vid);
    const colorMatch = (!ck && !xck) || (ck && xck && xck === ck);

    return productMatch && variantMatch && colorMatch;
  });
}

function getResolvedReturnItem(it: any, selected: any) {
  const subOrderItems =
    selected?.subOrderItems ||
    selected?.subOrder?.items ||
    selected?.order?.subOrder?.items ||
    selected?.order?.subOrders?.[0]?.items ||
    [];

  const matched = Array.isArray(subOrderItems)
    ? matchOrderItem(subOrderItems, it)
    : null;

  const title =
    getItemTitle(it) ||
    getItemTitle(matched) ||
    "";

  const sku =
    getItemSku(it) ||
    getItemSku(matched) ||
    "";

  const image =
    getItemImage(it) ||
    getItemImage(matched) ||
    "";

  const variantText =
    getVariantText(it) ||
    getVariantText(matched) ||
    "";

  const colorKey =
    safeStr(it?.colorKey) ||
    safeStr(matched?.colorKey) ||
    "";

  const qty =
    Number(it?.qty || matched?.qty || 1) || 1;

  const finalLineTotal =
    typeof it?.finalLineTotal === "number"
      ? it.finalLineTotal
      : typeof matched?.finalLineTotal === "number"
      ? matched.finalLineTotal
      : typeof matched?.lineTotal === "number"
      ? matched.lineTotal
      : undefined;

  return {
    title,
    sku,
    image,
    variantText,
    colorKey,
    qty,
    finalLineTotal,
    matched,
  };
}

export default function AdminReturnsPage() {
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ReturnStatus | "">("");
  const [ownerType, setOwnerType] = useState<"" | "ADMIN" | "VENDOR">("");
  const [attentionOnly, setAttentionOnly] = useState(false);

  const [page, setPage] = useState(1);
  const limit = 20;

  const [data, setData] = useState<{
    items: AdminReturnRow[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }>({
    items: [],
    page: 1,
    limit,
    total: 0,
    totalPages: 1,
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "items" | "bank" | "images" | "refund"
  >("overview");
  const [selected, setSelected] = useState<AdminReturnRow | null>(null);

  const openRow = (r: AdminReturnRow, tab: typeof activeTab = "overview") => {
    setSelected(r);
    setActiveTab(tab);
    setDrawerOpen(true);
  };

  const closeRow = () => {
    setDrawerOpen(false);
    setSelected(null);
  };

  const load = async (nextPage = 1) => {
    try {
      setLoading(true);
      setError(null);

      const resp = await adminFetchReturns({
        q: q.trim() || undefined,
        status: status || undefined,
        ownerType: ownerType || undefined,
        page: nextPage,
        limit,
      });

      setData(resp);
      setPage(resp.page || nextPage);
    } catch (e: any) {
      setError(e?.message || "Failed to load returns");
      setData((p) => ({ ...p, items: [] }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo(() => {
    const list = Array.isArray(data?.items) ? data.items : [];
    if (!attentionOnly) return list;
    return list.filter((r) => isAttentionRow(r));
  }, [data?.items, attentionOnly]);

  const summaryText = useMemo(() => {
    const total = Number(data?.total || 0);
    const shown = items.length;
    return attentionOnly
      ? `Showing ${shown} of ${total} (Attention only)`
      : `${total} return(s)`;
  }, [data?.total, items.length, attentionOnly]);

  const onApprove = async (r: AdminReturnRow) => {
    const key = `${r.orderId}::${r.subOrderId}::${r.returnId}::approve`;
    try {
      setBusyKey(key);
      setError(null);
      await adminApproveReturn(r.orderId, r.subOrderId, r.returnId);
      await load(page);
      setSelected((prev) =>
        prev && prev.returnId === r.returnId
          ? ({ ...prev, returnStatus: "APPROVED" } as any)
          : prev
      );
    } catch (e: any) {
      setError(e?.message || "Approve failed");
    } finally {
      setBusyKey(null);
    }
  };

  const onReject = async (r: AdminReturnRow) => {
    const reason = prompt("Reject reason?") || "";
    if (!reason.trim()) return;

    const key = `${r.orderId}::${r.subOrderId}::${r.returnId}::reject`;
    try {
      setBusyKey(key);
      setError(null);
      await adminRejectReturn(
        r.orderId,
        r.subOrderId,
        r.returnId,
        reason.trim()
      );
      await load(page);
      setSelected((prev) =>
        prev && prev.returnId === r.returnId
          ? ({
              ...prev,
              returnStatus: "REJECTED",
              rejectReason: reason.trim(),
            } as any)
          : prev
      );
    } catch (e: any) {
      setError(e?.message || "Reject failed");
    } finally {
      setBusyKey(null);
    }
  };

  const onRefund = async (r: AdminReturnRow) => {
    const key = `${r.orderId}::${r.subOrderId}::${r.returnId}::refund`;
    try {
      setBusyKey(key);
      setError(null);

      const resp = await adminProcessRefund(r.orderId, r.subOrderId, r.returnId);

      await load(page);

      setSelected((prev) =>
        prev && prev.returnId === r.returnId
          ? ({
              ...prev,
              returnStatus: "REFUNDED",
              refund: {
                ...(prev.refund || {}),
                status: "PROCESSED",
                amount: resp?.amount ?? prev?.refund?.amount,
                method:
                  String(prev?.paymentMethod || "").toUpperCase() === "COD"
                    ? "COD"
                    : "ONLINE",
                processedAt: new Date().toISOString(),
              },
            } as any)
          : prev
      );
    } catch (e: any) {
      setError(e?.message || "Refund failed");
    } finally {
      setBusyKey(null);
    }
  };

  const totalPages = Number(data?.totalPages || 1);

  return (
    <div className="mx-auto max-w-[1700px] px-4 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            Admin · Returns
          </h1>
          <p className="text-sm text-gray-600">{summaryText}</p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/admin"
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
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

      <div className="mt-6 rounded-3xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search: order code / name / phone"
            className="h-11 rounded-2xl border px-4 text-sm outline-none focus:border-gray-400 sm:col-span-3"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="h-11 rounded-2xl border px-4 text-sm outline-none focus:border-gray-400 bg-white"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s || "ALL"} value={s}>
                {s ? s : "All Status"}
              </option>
            ))}
          </select>

          <select
            value={ownerType}
            onChange={(e) => setOwnerType(e.target.value as any)}
            className="h-11 rounded-2xl border px-4 text-sm outline-none focus:border-gray-400 bg-white"
          >
            {OWNER_OPTIONS.map((s) => (
              <option key={s || "ALL"} value={s}>
                {s ? `Owner: ${s}` : "All Owners"}
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

      <div className="mt-6 overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-5 py-3 text-sm font-extrabold text-gray-900">
          Return Requests
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-10 rounded-2xl bg-gray-100 animate-pulse"
              />
            ))}
          </div>
        ) : items.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1400px] w-full text-sm">
              <thead className="bg-white sticky top-0 z-10">
                <tr className="border-b text-left text-xs font-bold text-gray-600">
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Seller</th>
                  <th className="px-5 py-3">Return</th>
                  <th className="px-5 py-3">Requested</th>
                  <th className="px-5 py-3">Items</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Refund</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {items.map((r) => {
                  const rowAttention = isAttentionRow(r);
                  const rs = String(r.returnStatus || "").toUpperCase();
                  const pm = String(r.paymentMethod || "").toUpperCase();
                  const ps = String(r.paymentStatus || "").toUpperCase();
                  const owner = String(r.ownerType || "").toUpperCase();

                  const itemsCount = Array.isArray(r.items)
                    ? r.items.reduce(
                        (s, it) => s + Math.max(1, Number(it?.qty || 1)),
                        0
                      )
                    : 0;

                  const refundStatus = String(r?.refund?.status || "").toUpperCase();
                  const refundAmt = r?.refund?.amount;

                  const canAction = owner === "ADMIN" && rs === "REQUESTED";
                  const canRefund =
                    ["APPROVED", "RECEIVED"].includes(rs) &&
                    refundStatus !== "PROCESSED";

                  const busyApprove =
                    busyKey === `${r.orderId}::${r.subOrderId}::${r.returnId}::approve`;
                  const busyReject =
                    busyKey === `${r.orderId}::${r.subOrderId}::${r.returnId}::reject`;
                  const busyRefund =
                    busyKey === `${r.orderId}::${r.subOrderId}::${r.returnId}::refund`;

                  return (
                    <tr
                      key={`${r.orderId}::${r.returnId}`}
                      className={
                        "border-b last:border-b-0 hover:bg-gray-50/60 " +
                        (rowAttention ? "bg-amber-50/50" : "")
                      }
                    >
                      <td className="px-5 py-3">
                        <div className={"relative " + (rowAttention ? "pl-3" : "")}>
                          {rowAttention ? (
                            <span className="absolute left-0 top-1 h-10 w-1 rounded-full bg-amber-500" />
                          ) : null}
                          <div className="font-bold text-gray-900">
                            {r.orderCode || "—"}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            Order: {String(r.orderId).slice(-8)} • Sub:{" "}
                            {String(r.subOrderId).slice(-8)}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <div className="font-semibold text-gray-900">
                          {r.soldBy || "—"}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge tone={owner === "ADMIN" ? "indigo" : "gray"}>
                            {owner || "—"}
                          </Badge>
                          {r.vendorName ? (
                            <Badge tone="blue">{r.vendorName}</Badge>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={toneForReturnStatus(rs) as any}>
                            {rs || "—"}
                          </Badge>
                          {r.subOrderStatus ? (
                            <Badge tone="gray">
                              SO: {String(r.subOrderStatus).toUpperCase()}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-2 flex gap-3">
                          <button
                            type="button"
                            onClick={() => openRow(r, "overview")}
                            className="text-[12px] font-semibold text-blue-700 hover:underline"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openRow(r, "items")}
                            className="text-[12px] font-semibold text-gray-800 hover:underline"
                          >
                            Items
                          </button>
                        </div>
                      </td>

                      <td className="px-5 py-3 text-gray-700">
                        <div className="font-semibold">
                          {fmtDateTime(r.requestedAt)}
                        </div>
                        {r.reason ? (
                          <div className="mt-1 text-[11px] text-gray-500 line-clamp-2">
                            Reason: {String(r.reason)}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-5 py-3">
                        <Badge tone="blue">{itemsCount} qty</Badge>
                        {r.note ? (
                          <div className="mt-2 text-[11px] text-gray-600 line-clamp-2">
                            Note: {String(r.note)}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="gray">{pm || "—"}</Badge>
                          <Badge tone="gray">{ps || "—"}</Badge>
                        </div>
                        {pm === "COD" && r.bankDetails ? (
                          <div className="mt-2 text-[11px] text-emerald-700 font-semibold">
                            Bank: Provided
                          </div>
                        ) : null}
                      </td>

                      <td className="px-5 py-3">
                        {r.refund ? (
                          <div className="space-y-1">
                            <Badge
                              tone={refundStatus === "PROCESSED" ? "green" : "amber"}
                            >
                              {refundStatus || "—"}
                            </Badge>
                            {typeof refundAmt === "number" ? (
                              <div className="text-[12px] text-gray-700">
                                {money(refundAmt)}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-[12px] text-gray-500">—</span>
                        )}
                        {canRefund ? (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => openRow(r, "refund")}
                              className="text-[12px] font-semibold text-emerald-700 hover:underline"
                            >
                              Refund pending
                            </button>
                          </div>
                        ) : null}
                      </td>

                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <IconButton onClick={() => openRow(r, "overview")}>
                            Open
                          </IconButton>

                          {canAction ? (
                            <>
                              <IconButton
                                disabled={busyApprove || busyReject || busyRefund}
                                onClick={() => onApprove(r)}
                                tone="primary"
                              >
                                {busyApprove ? "..." : "Approve"}
                              </IconButton>
                              <IconButton
                                disabled={busyApprove || busyReject || busyRefund}
                                onClick={() => onReject(r)}
                                tone="danger"
                              >
                                {busyReject ? "..." : "Reject"}
                              </IconButton>
                            </>
                          ) : owner === "VENDOR" && rs === "REQUESTED" ? (
                            <Badge tone="gray">Vendor will handle</Badge>
                          ) : null}

                          {canRefund ? (
                            <IconButton
                              disabled={busyApprove || busyReject || busyRefund}
                              onClick={() => onRefund(r)}
                              tone="primary"
                              title="Process refund now"
                            >
                              {busyRefund ? "..." : "Refund"}
                            </IconButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-gray-600">
            No return requests found.
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Page <span className="font-semibold text-gray-900">{page}</span> of{" "}
          <span className="font-semibold text-gray-900">{totalPages}</span>
          {totalPages === 1 ? (
            <span className="ml-2 text-[11px] text-gray-500">
              (backend totalPages currently fixed)
            </span>
          ) : null}
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

      <Drawer
        open={drawerOpen}
        onClose={closeRow}
        title={
          selected?.orderCode
            ? `${selected.orderCode} · ${String(selected.returnStatus || "").toUpperCase()}`
            : "Return"
        }
        subtitle={
          selected
            ? `Order: ${String(selected.orderId).slice(-8)} • Sub: ${String(
                selected.subOrderId
              ).slice(-8)} • Return: ${String(selected.returnId).slice(-8)}`
            : undefined
        }
      >
        {selected ? (
          <>
            <Tabs
              value={activeTab}
              onChange={(v) => setActiveTab(v as any)}
              items={[
                { key: "overview", label: "Overview" },
                { key: "items", label: "Items" },
                { key: "bank", label: "Bank" },
                { key: "images", label: "Images" },
                { key: "refund", label: "Refund" },
              ]}
            />

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                {activeTab === "overview" ? (
                  <div className="rounded-3xl border bg-white p-4">
                    <div className="mb-3 text-sm font-extrabold text-gray-900">
                      Overview
                    </div>

                    <div className="space-y-2 text-sm">
                      <StatRow
                        k="Return status"
                        v={
                          <Badge
                            tone={
                              toneForReturnStatus(String(selected.returnStatus)) as any
                            }
                          >
                            {String(selected.returnStatus || "—").toUpperCase()}
                          </Badge>
                        }
                      />
                      <StatRow k="Requested" v={fmtDateTime(selected.requestedAt)} />
                      <StatRow k="Approved" v={fmtDateTime(selected.approvedAt)} />
                      <StatRow k="Rejected" v={fmtDateTime(selected.rejectedAt)} />
                      <StatRow k="Received" v={fmtDateTime(selected.receivedAt)} />
                      <StatRow
                        k="Reject reason"
                        v={
                          selected.rejectReason ? (
                            <span className="text-red-700">
                              {String(selected.rejectReason)}
                            </span>
                          ) : (
                            "—"
                          )
                        }
                      />
                      <StatRow
                        k="Reason"
                        v={selected.reason ? String(selected.reason) : "—"}
                      />
                      <StatRow
                        k="Note"
                        v={selected.note ? String(selected.note) : "—"}
                      />
                      <StatRow
                        k="Owner"
                        v={
                          <Badge
                            tone={
                              String(selected.ownerType).toUpperCase() === "ADMIN"
                                ? "indigo"
                                : "gray"
                            }
                          >
                            {String(selected.ownerType || "—").toUpperCase()}
                          </Badge>
                        }
                      />
                      <StatRow k="Sold by" v={selected.soldBy || "—"} />
                      <StatRow
                        k="Payment"
                        v={`${String(selected.paymentMethod || "—").toUpperCase()} · ${String(
                          selected.paymentStatus || "—"
                        ).toUpperCase()}`}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {String(selected.ownerType || "").toUpperCase() === "ADMIN" &&
                      String(selected.returnStatus || "").toUpperCase() ===
                        "REQUESTED" ? (
                        <>
                          <IconButton
                            disabled={!!busyKey}
                            onClick={() => onApprove(selected)}
                            tone="primary"
                          >
                            Approve
                          </IconButton>
                          <IconButton
                            disabled={!!busyKey}
                            onClick={() => onReject(selected)}
                            tone="danger"
                          >
                            Reject
                          </IconButton>
                        </>
                      ) : String(selected.ownerType || "").toUpperCase() ===
                          "VENDOR" &&
                        String(selected.returnStatus || "").toUpperCase() ===
                          "REQUESTED" ? (
                        <Badge tone="gray">Vendor will handle this</Badge>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {activeTab === "items" ? (
                  <div className="rounded-3xl border bg-white p-4">
                    <div className="mb-3 text-sm font-extrabold text-gray-900">
                      Return Items
                    </div>

                    {Array.isArray(selected.items) && selected.items.length ? (
                      <div className="space-y-3">
                        {selected.items.map((it: any, idx: number) => {
                          const resolved = getResolvedReturnItem(it, selected);

                          return (
                            <div
                              key={idx}
                              className="flex gap-3 rounded-2xl border p-3 text-sm"
                            >
                              <div className="h-14 w-14 overflow-hidden rounded-xl bg-gray-100 shrink-0">
                                {resolved.image ? (
                                  <img
                                    src={resolved.image}
                                    alt="p"
                                    className="h-full w-full object-cover"
                                  />
                                ) : null}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="font-extrabold text-gray-900 line-clamp-1">
                                  {resolved.title || "Product"}
                                </div>

                                <div className="text-[11px] text-gray-500 font-semibold">
                                  SKU: {resolved.sku || "—"}
                                </div>

                                <div className="mt-1 text-[12px] text-gray-700">
                                  Qty:{" "}
                                  <span className="font-semibold">
                                    {resolved.qty}
                                  </span>
                                  {resolved.colorKey
                                    ? ` • Color: ${resolved.colorKey}`
                                    : ""}
                                  {resolved.variantText
                                    ? ` • Variant: ${resolved.variantText}`
                                    : it?.variantId
                                    ? ` • Variant: ${String(it.variantId)}`
                                    : ""}
                                </div>

                                {!resolved.title && !resolved.sku ? (
                                  <div className="mt-1 text-[11px] text-gray-500">
                                    ProductId:{" "}
                                    <span className="font-mono">
                                      {normalizeId(it?.productId) || "—"}
                                    </span>
                                  </div>
                                ) : null}
                              </div>

                              <div className="text-right">
                                {typeof resolved.finalLineTotal === "number" ? (
                                  <div className="font-extrabold text-gray-900">
                                    {money(resolved.finalLineTotal)}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">
                        No return items found.
                      </div>
                    )}
                  </div>
                ) : null}

                {activeTab === "bank" ? (
                  <div className="rounded-3xl border bg-white p-4">
                    <div className="mb-3 text-sm font-extrabold text-gray-900">
                      Bank Details (COD)
                    </div>
                    {selected.bankDetails ? (
                      <div className="rounded-2xl border bg-gray-50 p-4 text-sm text-gray-700 space-y-1">
                        <div>
                          <span className="font-semibold">Holder:</span>{" "}
                          {selected.bankDetails?.accountHolderName || "—"}
                        </div>
                        <div>
                          <span className="font-semibold">A/C:</span>{" "}
                          {selected.bankDetails?.accountNumber || "—"}
                        </div>
                        <div>
                          <span className="font-semibold">IFSC:</span>{" "}
                          {selected.bankDetails?.ifsc || "—"}
                        </div>
                        {selected.bankDetails?.bankName ? (
                          <div>
                            <span className="font-semibold">Bank:</span>{" "}
                            {selected.bankDetails?.bankName}
                          </div>
                        ) : null}
                        {selected.bankDetails?.upiId ? (
                          <div>
                            <span className="font-semibold">UPI:</span>{" "}
                            {selected.bankDetails?.upiId}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">No bank details.</div>
                    )}
                  </div>
                ) : null}

                {activeTab === "images" ? (
                  <div className="rounded-3xl border bg-white p-4">
                    <div className="mb-3 text-sm font-extrabold text-gray-900">
                      Images
                    </div>
                    {Array.isArray(selected.images) && selected.images.length ? (
                      <div className="flex flex-wrap gap-2">
                        {selected.images.slice(0, 20).map((p: string, i: number) => {
                          const src = resolveImageUrl(p);
                          return (
                            <a
                              key={i}
                              href={src || "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="h-16 w-16 overflow-hidden rounded-xl border bg-white"
                              title="Open"
                            >
                              {src ? (
                                <img
                                  src={src}
                                  alt={`ret-${i}`}
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">No images.</div>
                    )}
                  </div>
                ) : null}

                {activeTab === "refund" ? (
                  <div className="rounded-3xl border bg-white p-4">
                    {(() => {
                      const rs = String(selected.returnStatus || "").toUpperCase();
                      const refundStatus = String(
                        selected.refund?.status || ""
                      ).toUpperCase();
                      const canRefund =
                        ["APPROVED", "RECEIVED"].includes(rs) &&
                        refundStatus !== "PROCESSED";

                      const busyRefund =
                        busyKey ===
                        `${selected.orderId}::${selected.subOrderId}::${selected.returnId}::refund`;

                      return (
                        <>
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="text-sm font-extrabold text-gray-900">
                              Refund
                            </div>

                            {canRefund ? (
                              <IconButton
                                tone="primary"
                                disabled={!!busyKey}
                                onClick={() => onRefund(selected)}
                              >
                                {busyRefund ? "..." : "Process Refund"}
                              </IconButton>
                            ) : (
                              <Badge tone="gray">
                                {refundStatus === "PROCESSED"
                                  ? "Refund processed"
                                  : rs === "REQUESTED"
                                  ? "Approve/Receive first"
                                  : "Not eligible"}
                              </Badge>
                            )}
                          </div>

                          {selected.refund ? (
                            <div className="space-y-2 text-sm">
                              <StatRow
                                k="Status"
                                v={
                                  <Badge
                                    tone={
                                      refundStatus === "PROCESSED"
                                        ? "green"
                                        : refundStatus === "FAILED"
                                        ? "red"
                                        : "amber"
                                    }
                                  >
                                    {refundStatus || "—"}
                                  </Badge>
                                }
                              />
                              <StatRow
                                k="Amount"
                                v={
                                  typeof selected.refund?.amount === "number"
                                    ? money(selected.refund.amount)
                                    : "—"
                                }
                              />
                              <StatRow
                                k="Method"
                                v={String(
                                  selected.refund?.method || "—"
                                ).toUpperCase()}
                              />
                              <StatRow
                                k="Provider"
                                v={String(
                                  selected.refund?.provider || "—"
                                ).toUpperCase()}
                              />
                              <StatRow
                                k="Reference"
                                v={
                                  selected.refund?.reference ? (
                                    <span className="font-mono text-[12px]">
                                      {String(selected.refund.reference)}
                                    </span>
                                  ) : (
                                    "—"
                                  )
                                }
                              />
                              <StatRow
                                k="Processed"
                                v={fmtDateTime(selected.refund?.processedAt)}
                              />
                            </div>
                          ) : (
                            <div className="text-sm text-gray-600">
                              No refund snapshot yet.
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border bg-white p-4">
                  <div className="mb-2 text-sm font-extrabold text-gray-900">
                    Quick Summary
                  </div>
                  <div className="space-y-2 text-sm">
                    <StatRow k="Order" v={selected.orderCode || "—"} />
                    <StatRow
                      k="Return"
                      v={
                        <Badge
                          tone={
                            toneForReturnStatus(String(selected.returnStatus)) as any
                          }
                        >
                          {String(selected.returnStatus || "—").toUpperCase()}
                        </Badge>
                      }
                    />
                    <StatRow k="Requested" v={fmtDateTime(selected.requestedAt)} />
                    <StatRow
                      k="Owner"
                      v={String(selected.ownerType || "—").toUpperCase()}
                    />
                    <StatRow k="Sold by" v={selected.soldBy || "—"} />
                  </div>
                </div>

                <div className="rounded-3xl border bg-white p-4">
                  <div className="mb-2 text-sm font-extrabold text-gray-900">
                    Shortcuts
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <IconButton onClick={() => setActiveTab("overview")}>
                      Overview
                    </IconButton>
                    <IconButton onClick={() => setActiveTab("items")}>
                      Items
                    </IconButton>
                    <IconButton onClick={() => setActiveTab("images")}>
                      Images
                    </IconButton>
                    <IconButton onClick={() => setActiveTab("bank")}>
                      Bank
                    </IconButton>
                    <IconButton onClick={() => setActiveTab("refund")}>
                      Refund
                    </IconButton>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </Drawer>
    </div>
  );
}