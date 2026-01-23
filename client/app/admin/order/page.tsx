/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  adminFetchOrders,
  adminUpdateOrderStatus,
  adminConfirmCod,
  adminCreateShiprocketShipment,

  // Return/Refund calls
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

export default function AdminOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<string>("");

  const [page, setPage] = useState(1);
  const limit = 20;

  const [data, setData] = useState<any>({
    items: [],
    page: 1,
    limit,
    total: 0,
    totalPages: 1,
  });

  const items = data?.items || [];
  const totalPages = Number(data?.totalPages || 1);

  function getVariantText(product?: any, variantId?: string) {
    const v = (product?.variants || []).find((x: any) => String(x._id) === String(variantId));
    if (!v) return "Variant";
    return v.label || v.comboText || v.size || v.weight || "Variant";
  }

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
      items: (prev.items || []).map((o: any) =>
        String(o._id) === String(orderId) ? { ...o, ...patch } : o
      ),
    }));
  };

  const replaceLocalOrder = (orderId: string, next: any) => {
    setData((prev: any) => ({
      ...prev,
      items: (prev.items || []).map((o: any) =>
        String(o._id) === String(orderId) ? next : o
      ),
    }));
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

  // ✅ Return Actions
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

  // ✅ Refund (optional partial amount in rupees)
  const onProcessRefund = async (orderId: string) => {
    try {
      const ok = confirm("Process refund now?");
      if (!ok) return;

      // optional amount prompt
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

  const summaryText = useMemo(() => {
    const total = Number(data?.total || 0);
    return `${total} order(s)`;
  }, [data?.total]);

  const hasShiprocketShipment = (o: any) =>
    Array.isArray(o?.shipments) && o.shipments.some((s: any) => s?.provider === "SHIPROCKET");

  const latestShiprocketShipment = (o: any) => {
    const list = Array.isArray(o?.shipments) ? o.shipments.filter((s: any) => s?.provider === "SHIPROCKET") : [];
    if (!list.length) return null;
    const sorted = [...list].sort((a: any, b: any) => {
      const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    return sorted[0] || list[list.length - 1];
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin · Orders</h1>
          <p className="text-sm text-gray-600">{summaryText}</p>
        </div>

        <div className="flex gap-2">
          <Link href="/admin" className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50">
            Admin Home
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 rounded-3xl border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search order code / name / phone / RZP id"
            className="h-11 rounded-2xl border px-4 text-sm outline-none focus:border-gray-400"
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
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {/* Table */}
      <div className="mt-6 rounded-3xl border bg-white overflow-hidden">
        <div className="border-b bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-900">Orders</div>

        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : items.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1700px] w-full text-sm">
              <thead className="bg-white">
                <tr className="border-b text-left text-xs font-bold text-gray-600">
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Items</th>
                  <th className="px-5 py-3">Payable</th>
                  <th className="px-5 py-3">Payment Details</th>
                  <th className="px-5 py-3">Shipment</th>
                  <th className="px-5 py-3">Return / Refund</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
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
                  const rzpOrderId = pg?.orderId || "";
                  const rzpPaymentId = pg?.paymentId || "";
                  const rzpAmountPaise = pg?.amount;
                  const rzpCurrency = pg?.currency || "INR";
                  const verifiedAt = pg?.verifiedAt || null;

                  const cod = o?.cod || null;
                  const codConfirmedAt = cod?.confirmedAt || null;

                  const codIsConfirmed =
                    pm === "COD" && (Boolean(codConfirmedAt) || ["CONFIRMED", "SHIPPED", "DELIVERED"].includes(st));

                  const isBusy = busyId === orderId;
                  const lockedDelivered = st === "DELIVERED";
                  const lockedCancelled = st === "CANCELLED";

                  const isCodPlaced = pm === "COD" && st === "PLACED";
                  const blockShipUntilConfirm = pm === "COD" && !codIsConfirmed;

                  // shipment info
                  const sr = latestShiprocketShipment(o);
                  const srAwb = sr?.shiprocket?.awb || "";
                  const srShipmentId = sr?.shiprocket?.shipmentId ?? null;
                  const srOrderId = sr?.shiprocket?.orderId || "";

                  const shipmentExists = hasShiprocketShipment(o);

                  const canCreateShipment =
                    st === "CONFIRMED" &&
                    !shipmentExists &&
                    !(pm === "COD" && !codIsConfirmed) &&
                    !(pm === "ONLINE" && ps !== "PAID");

                  // ✅ Return/Refund (new)
                  const ret = o?.return || null;
                  const retStatus = String(ret?.status || "").toUpperCase(); // REQUESTED/APPROVED/REJECTED/PICKUP_CREATED/RECEIVED/REFUNDED
                  const refund = o?.refund || null;
                  const refundStatus = String(refund?.status || "").toUpperCase(); // PENDING/PROCESSED/FAILED

                  const canApproveReject = retStatus === "REQUESTED";
                  const canRefund = ["APPROVED", "RECEIVED"].includes(retStatus);

                  const refundProcessed = refundStatus === "PROCESSED" || retStatus === "REFUNDED";
                  const refundButtonDisabled = !canRefund || refundProcessed || isBusy;

                  const bank = ret?.bankDetails || null; // if your backend stores it here
                  const imgs = Array.isArray(ret?.images) ? ret.images : [];

                  return (
                    <tr key={orderId} className="border-b last:border-b-0">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-gray-900">{orderCode}</div>
                        <div className="text-[11px] text-gray-500">Internal: {orderId.slice(-8)}</div>
                      </td>

                      <td className="px-5 py-3">
                        <div className="font-semibold text-gray-900">{customerName}</div>
                        <div className="text-[11px] text-gray-500">{phone}</div>
                      </td>

                      <td className="px-5 py-3">
                        <div className="space-y-2">
                          {(o.items || []).slice(0, 2).map((it: any, idx: number) => {
                            const product = it?.productId; // populated
                            const vText = getVariantText(product, it?.variantId);
                            return (
                              <div key={idx} className="text-[12px] text-gray-800">
                                <div className="font-semibold">{it.title}</div>
                                <div className="mt-0.5 text-[11px] font-semibold text-gray-500">
                                  Code: {it.productCode || "—"}
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                  Variant: {vText}
                                  {it.colorKey ? ` • Color: ${it.colorKey}` : ""}
                                  {" • "}Qty: {it.qty}
                                </div>
                              </div>
                            );
                          })}
                          {(o.items || []).length > 2 ? (
                            <div className="text-[11px] text-gray-500">+{o.items.length - 2} more item(s)</div>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <div className="font-semibold text-gray-900">{money(payable)}</div>
                        {o?.totals?.discount ? (
                          <div className="text-[11px] text-emerald-700 font-semibold">
                            Discount: -{money(o.totals.discount)}
                          </div>
                        ) : null}
                      </td>

                      {/* Payment Details */}
                      <td className="px-5 py-3">
                        <div className="text-gray-900 font-semibold">
                          {pm} <span className="text-gray-500 font-normal">({ps})</span>
                        </div>

                        {pm === "ONLINE" ? (
                          <div className="mt-1 space-y-1 text-[11px] text-gray-600">
                            <div>
                              <span className="font-semibold text-gray-700">RZP Order:</span>{" "}
                              <span className="font-mono">{rzpOrderId || "—"}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-700">RZP Payment:</span>{" "}
                              <span className="font-mono">{rzpPaymentId || "—"}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-700">Amount:</span>{" "}
                              {rzpAmountPaise ? `${moneyPaise(rzpAmountPaise)} ${rzpCurrency}` : "—"}
                            </div>
                            <div>
                              <span className="font-semibold text-gray-700">Verified:</span>{" "}
                              {verifiedAt ? fmtDateTime(verifiedAt) : "—"}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 space-y-1 text-[11px] text-gray-600">
                            <div>
                              <span className="font-semibold text-gray-700">COD:</span>{" "}
                              {codIsConfirmed ? (
                                <>
                                  Confirmed{codConfirmedAt ? ` (${fmtDateTime(codConfirmedAt)})` : ""}
                                </>
                              ) : (
                                "Not confirmed"
                              )}
                            </div>

                            {isCodPlaced ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => onConfirmCod(orderId)}
                                className="mt-2 inline-flex h-9 items-center justify-center rounded-xl bg-emerald-600 px-3 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                              >
                                {isBusy ? "Confirming…" : "Confirm COD"}
                              </button>
                            ) : null}
                          </div>
                        )}
                      </td>

                      {/* Shipment */}
                      <td className="px-5 py-3">
                        {shipmentExists ? (
                          <div className="space-y-1 text-[11px] text-gray-700">
                            <div>
                              <span className="font-semibold">Provider:</span> SHIPROCKET
                            </div>
                            <div>
                              <span className="font-semibold">Shipment ID:</span>{" "}
                              <span className="font-mono">{srShipmentId ?? "—"}</span>
                            </div>
                            <div>
                              <span className="font-semibold">AWB:</span>{" "}
                              <span className="font-mono">{srAwb || "—"}</span>
                            </div>
                            <div>
                              <span className="font-semibold">SR Order:</span>{" "}
                              <span className="font-mono">{srOrderId || "—"}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-[11px] text-gray-500">No shipment created</div>
                            <button
                              type="button"
                              disabled={!canCreateShipment || isBusy}
                              onClick={() => onCreateShipment(orderId)}
                              className="inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-3 text-[12px] font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                              {isBusy ? "Creating…" : "Create Shipment"}
                            </button>
                            {!canCreateShipment ? (
                              <div className="text-[11px] text-gray-500">
                                {st !== "CONFIRMED"
                                  ? "Confirm order first"
                                  : pm === "ONLINE" && ps !== "PAID"
                                    ? "Online payment must be PAID"
                                    : pm === "COD" && !codIsConfirmed
                                      ? "Confirm COD first"
                                      : "—"}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </td>

                      {/* ✅ Return / Refund */}
                      <td className="px-5 py-3">
                        {!retStatus ? (
                          <div className="text-[11px] text-gray-500">—</div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-[12px] font-semibold text-gray-900">
                              Return: <span className="font-mono">{retStatus}</span>
                            </div>

                            {ret?.requestedAt ? (
                              <div className="text-[11px] text-gray-600">
                                Requested: {fmtDateTime(ret.requestedAt)}
                              </div>
                            ) : null}

                            {ret?.reason ? (
                              <div className="text-[11px] text-gray-600">
                                Reason: <span className="font-semibold text-gray-800">{String(ret.reason)}</span>
                              </div>
                            ) : null}

                            {/* ✅ note (not comment) */}
                            {ret?.note ? (
                              <div className="text-[11px] text-gray-600">
                                Note: <span className="font-semibold text-gray-800">{String(ret.note)}</span>
                              </div>
                            ) : null}

                            {retStatus === "REJECTED" && ret?.rejectReason ? (
                              <div className="text-[11px] text-red-700">
                                Reject: {String(ret.rejectReason)}
                              </div>
                            ) : null}

                            {/* ✅ show COD bank details (if present) */}
                            {bank ? (
                              <div className="border p-2 text-[11px] text-gray-700">
                                <div className="font-semibold text-gray-900 mb-1">Bank Details (COD)</div>
                                <div>
                                  <span className="font-semibold">A/C Holder:</span>{" "}
                                  {bank?.accountHolderName || "—"}
                                </div>
                                <div>
                                  <span className="font-semibold">A/C No:</span>{" "}
                                  {bank?.accountNumber || "—"}
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

                            {/* ✅ image proofs preview */}
                            {imgs.length ? (
                              <div>
                                <div className="text-[11px] font-semibold text-gray-700 mb-1">Images</div>
                                <div className="flex flex-wrap gap-2">
                                  {imgs.slice(0, 5).map((p: string, i: number) => {
                                    const src = resolveImageUrl(p);
                                    return (
                                      <a
                                        key={i}
                                        href={src || "#"}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="h-10 w-10 border bg-gray-50 overflow-hidden"
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
                                <button
                                  disabled={isBusy}
                                  onClick={() => onApproveReturn(orderId)}
                                  className="h-9 rounded-xl bg-emerald-600 px-3 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                >
                                  {isBusy ? "..." : "Approve"}
                                </button>

                                <button
                                  disabled={isBusy}
                                  onClick={() => onRejectReturn(orderId)}
                                  className="h-9 rounded-xl bg-red-600 px-3 text-[12px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                                >
                                  {isBusy ? "..." : "Reject"}
                                </button>
                              </div>
                            ) : null}

                            {/* Refund status */}
                            {refund ? (
                              <div className="text-[11px] text-gray-700">
                                Refund: <span className="font-semibold">{refundStatus || "—"}</span>
                                {refund?.amount ? <span className="text-gray-500"> • {money(refund.amount)}</span> : null}
                                {refund?.processedAt ? <span className="text-gray-500"> • {fmtDateTime(refund.processedAt)}</span> : null}
                              </div>
                            ) : null}

                            {/* Refund action */}
                            {canRefund ? (
                              <button
                                disabled={refundButtonDisabled}
                                onClick={() => onProcessRefund(orderId)}
                                className="h-9 rounded-xl bg-gray-900 px-3 text-[12px] font-semibold text-white hover:bg-black disabled:opacity-60"
                              >
                                {isBusy ? "Processing…" : refundProcessed ? "Refund Done" : "Process Refund"}
                              </button>
                            ) : null}

                            {retStatus === "REFUNDED" ? (
                              <div className="text-[11px] font-semibold text-emerald-700">Refund Completed</div>
                            ) : null}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3">
                        <select
                          value={st}
                          disabled={isBusy || lockedDelivered || lockedCancelled}
                          onChange={(e) => onChangeStatus(orderId, e.target.value)}
                          className="h-10 rounded-xl border px-3 text-sm outline-none focus:border-gray-400 bg-white disabled:opacity-60"
                        >
                          {STATUS_OPTIONS.map((s) => {
                            const disableConfirmed = pm === "COD" && st === "PLACED" && s === "CONFIRMED";
                            const disableShipDeliver = blockShipUntilConfirm && (s === "SHIPPED" || s === "DELIVERED");
                            const disabled = disableConfirmed || disableShipDeliver;
                            return (
                              <option key={s} value={s} disabled={disabled}>
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

                      <td className="px-5 py-3 text-gray-700">{created}</td>
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
            className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            disabled={loading || page >= totalPages}
            onClick={() => load(page + 1)}
            className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
