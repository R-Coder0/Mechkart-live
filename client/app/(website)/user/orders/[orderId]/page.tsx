/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

function money(n: number) {
  return `₹${Math.round(Number(n || 0))}`;
}

function toNum(v: any, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function fmtDateLong(d?: any) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function fmtDateTime(d?: any) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-IN");
  } catch {
    return "—";
  }
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
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
  const v = (product?.variants || []).find(
    (x: any) => String(x._id) === String(variantId)
  );
  if (!v) return "";
  return v.label || v.comboText || v.size || v.weight || "";
}

function resolveItemImage(
  product?: any,
  variantId?: string,
  colorKey?: string | null,
  fallback?: string | null
) {
  if (!product) return fallback || "";

  const v = (product.variants || []).find(
    (x: any) => String(x._id) === String(variantId)
  );
  const c = (product.colors || []).find(
    (x: any) => normKey(x.name) === normKey(colorKey)
  );

  const cImg = (c?.images || []).find(Boolean);
  const vImg = (v?.images || []).find(Boolean);
  const gImg = (product.galleryImages || []).find(Boolean);
  const fImg = product.featureImage || "";

  return cImg || vImg || gImg || fImg || fallback || "";
}

// ✅ safe compute items total if backend doesn't send totals
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
      total:
        order?.totals?.grandTotal ??
        order?.totals?.total ??
        order?.totalAmount,
    },
  ];
}

function pickShipmentForSubOrder(subOrder: any, tracking: any) {
  const direct = subOrder?.shipment;
  if (direct) return direct;

  const ts = Array.isArray(tracking?.shipments) ? tracking.shipments : [];
  if (!ts.length) return null;

  const bySub = ts.find(
    (x: any) => String(x?.subOrderId || "") === String(subOrder?._id || "")
  );
  if (bySub) return bySub;

  const byVendor = subOrder?.vendorId
    ? ts.find((x: any) => String(x?.vendorId || "") === String(subOrder.vendorId))
    : null;
  if (byVendor) return byVendor;

  if (ts.length === 1) return ts[0];

  return null;
}

function pickSubOrderTotal(order: any, so: any) {
  const direct =
    toNum(so?.total, NaN) ||
    toNum(so?.grandTotal, NaN) ||
    (toNum(so?.subtotal, NaN) + toNum(so?.shipping, 0));

  if (Number.isFinite(direct) && direct > 0) return direct;

  const computed = calcItemsTotal(so?.items || []);
  if (computed > 0) return computed;

  // legacy fallback
  return (
    toNum(order?.totals?.grandTotal, NaN) ||
    toNum(order?.totals?.total, NaN) ||
    toNum(order?.totals?.subtotal, NaN) ||
    toNum(order?.totalAmount, 0)
  );
}

type Order = any;

type TrackingResponse = {
  orderId: string;
  orderCode: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  shipments: any[];
  createdAt?: string;
};

type BankDetails = {
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  bankName?: string;
  upiId?: string;
};

export default function WebsiteUserOrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const orderId = String((params as any)?.orderId || "");
  // ✅ IMPORTANT: comes from list page link ?subOrderId=...
  const subOrderIdParam = String(searchParams.get("subOrderId") || "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  // Tracking states
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);

  // Return Request states
  const [rrOpen, setRrOpen] = useState(false);
  const [rrBusy, setRrBusy] = useState(false);
  const [rrErr, setRrErr] = useState<string | null>(null);
  const [rrOk, setRrOk] = useState<string | null>(null);

  const [rrReason, setRrReason] = useState("");
  const [rrNote, setRrNote] = useState("");

  // ✅ Return proof images (max 5)
  const [rrFiles, setRrFiles] = useState<File[]>([]);

  // ✅ Partial return selection: key => `${subOrderId}:${itemKey}`
  const [rrSelected, setRrSelected] = useState<Record<string, number>>({});

  // ✅ COD bank details (mandatory if paymentMethod=COD)
  const [bank, setBank] = useState<BankDetails>({
    accountHolderName: "",
    accountNumber: "",
    ifsc: "",
    bankName: "",
    upiId: "",
  });

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/users/orders/${orderId}`, {
        credentials: "include",
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Failed to load order");

      setOrder(json?.data ?? json);
    } catch (e: any) {
      setError(e?.message || "Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  const loadTracking = async () => {
    try {
      setTrackingLoading(true);
      setTrackingError(null);

      const res = await fetch(`${API_BASE}/users/orders/${orderId}/tracking`, {
        credentials: "include",
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Failed to load tracking");

      setTracking(json?.data ?? json);
    } catch (e: any) {
      setTrackingError(e?.message || "Failed to load tracking");
    } finally {
      setTrackingLoading(false);
    }
  };

  useEffect(() => {
    if (!orderId) return;
    load();
    loadTracking();
  }, [orderId]);

  const paymentMethod = String(order?.paymentMethod || "COD").toUpperCase();
  const isCOD = paymentMethod === "COD";

  function validateBankDetails(b: BankDetails) {
    const ah = (b.accountHolderName || "").trim();
    const an = (b.accountNumber || "").trim();
    const ifsc = (b.ifsc || "").trim();

    if (!ah) return "Account holder name is required for COD refund.";
    if (!an) return "Account number is required for COD refund.";
    if (!ifsc) return "IFSC is required for COD refund.";
    if (an.length < 6) return "Account number looks too short.";
    if (ifsc.length < 8) return "IFSC looks invalid.";
    return null;
  }

  const createdAt = order?.createdAt ? new Date(order.createdAt) : new Date();
  const updatedAt = order?.updatedAt ? new Date(order.updatedAt) : createdAt;

  const totals = order?.totals || {};

  const mrpTotal = useMemo(() => toNum(totals?.mrpTotal, 0), [totals?.mrpTotal]);

  const status = String(order?.status || "PLACED").toUpperCase();
  const isCancelled = status === "CANCELLED";
  const isDelivered = status === "DELIVERED";

  const expectedDelivery = addDays(createdAt, 7);

  const deliveryHeadline = useMemo(() => {
    if (isCancelled) return `Cancelled on ${fmtDateLong(updatedAt)}`;
    if (isDelivered) return `Delivered on ${fmtDateLong(updatedAt)}`;
    return `Delivery expected by ${fmtDateLong(expectedDelivery)}`;
  }, [isCancelled, isDelivered, updatedAt, expectedDelivery]);

  const subOrders = useMemo(() => normalizeSubOrders(order), [order]);

  // ✅ FIX: if user opened split card, show ONLY that subOrder
  const scopedSubOrders = useMemo(() => {
    if (!subOrderIdParam) return subOrders;
    const found = subOrders.find((x: any) => String(x._id) === String(subOrderIdParam));
    return found ? [found] : subOrders; // fallback if wrong id
  }, [subOrders, subOrderIdParam]);

  const computedSubOrders = useMemo(() => {
    return scopedSubOrders.map((so: any) => {
      const uiItems = (so.items || []).map((it: any) => {
        const product = it?.productId || it?.product || null;
        const title = String(it?.title || product?.title || "Product");

        const vText = getVariantText(product, it?.variantId);
        const colorText = it?.colorKey ? String(it.colorKey) : "";

        const qty = Math.max(1, toNum(it?.qty, 1));

        const lineTotal =
          toNum(it?.finalLineTotal, NaN) ||
          toNum(it?.lineTotal, NaN) ||
          toNum(it?.total, NaN) ||
          (toNum(it?.finalPrice, NaN) ? toNum(it?.finalPrice, 0) * qty : NaN) ||
          (toNum(it?.salePrice, NaN) ? toNum(it?.salePrice, 0) * qty : NaN) ||
          0;

        const imgPath = resolveItemImage(product, it?.variantId, it?.colorKey, it?.image);
        const img = resolveImageUrl(imgPath);

        const itemKey =
          String(it?._id || "") ||
          `${String(it?.productId?._id || it?.productId || "")}:${String(it?.variantId || "")}:${String(
            it?.colorKey || ""
          )}`;

        return {
          raw: it,
          itemKey,
          product,
          title,
          vText,
          colorText,
          qty,
          lineTotal,
          img,
          productCode: it?.productCode || "",
        };
      });

      return { ...so, __uiItems: uiItems };
    });
  }, [scopedSubOrders]);

  // ✅ header payable: subOrder open => show subOrder total
  const payable = useMemo(() => {
    if (subOrderIdParam && computedSubOrders.length === 1) {
      return pickSubOrderTotal(order, computedSubOrders[0]);
    }
    return (
      toNum(totals?.grandTotal, NaN) ||
      toNum(totals?.subtotal, NaN) ||
      toNum(order?.totalAmount, 0)
    );
  }, [subOrderIdParam, computedSubOrders, totals?.grandTotal, totals?.subtotal, order?.totalAmount, order]);

  const savings = useMemo(() => {
    const s = toNum(totals?.savings, NaN);
    if (Number.isFinite(s)) return Math.max(0, s);
    return Math.max(0, mrpTotal ? mrpTotal - payable : 0);
  }, [totals?.savings, mrpTotal, payable]);

  const headerTitle = useMemo(() => {
    const nSub = computedSubOrders.length;
    if (nSub > 1) return `Order split into ${nSub} shipments`;
    const first = computedSubOrders?.[0]?.__uiItems?.[0];
    if (!first) return "Order";
    const t = String(first.title || "Product");
    const totalItems = computedSubOrders?.[0]?.__uiItems?.length || 1;
    return totalItems > 1 ? `${t} + ${totalItems - 1} more item(s)` : t;
  }, [computedSubOrders]);

  const headerSubtitle = useMemo(() => {
    if (computedSubOrders.length > 1) {
      const names = computedSubOrders.map((s: any) => s.soldBy).filter(Boolean);
      const uniq = Array.from(new Set(names));
      return `Sold by: ${uniq.join(", ")}`;
    }
    const first = computedSubOrders?.[0]?.__uiItems?.[0];
    if (!first) return "";
    const parts: string[] = [];
    if (first.vText) parts.push(first.vText);
    if (first.colorText) parts.push(first.colorText);
    return parts.join(", ");
  }, [computedSubOrders]);

  const headerImg = useMemo(() => {
    const first = computedSubOrders?.[0]?.__uiItems?.[0];
    return first?.img || "";
  }, [computedSubOrders]);

  const totalItemsCount = useMemo(() => {
    return computedSubOrders.reduce((sum: number, so: any) => sum + (so?.__uiItems?.length || 0), 0);
  }, [computedSubOrders]);

  const returnReq = order?.return || null;
  const returnReqStatus = String(returnReq?.status || "").toUpperCase();

  const submitReturnRequest = async () => {
    try {
      setRrBusy(true);
      setRrErr(null);
      setRrOk(null);

      const reason = rrReason.trim();
      const note = rrNote.trim();

      if (!reason) {
        setRrErr("Please select a return reason.");
        return;
      }

      if (isCOD) {
        const bankErr = validateBankDetails(bank);
        if (bankErr) {
          setRrErr(bankErr);
          return;
        }
      }

      // ✅ build partial return items (NOTE: computedSubOrders is scoped now if subOrderIdParam present)
      const returnItems: any[] = [];
      computedSubOrders.forEach((so: any) => {
        (so.__uiItems || []).forEach((it: any) => {
          const key = `${so._id}:${it.itemKey}`;
          const qty = rrSelected[key] || 0;
          if (qty > 0) {
            returnItems.push({
              subOrderId: so._id,
              productId: it.raw?.productId?._id || it.raw?.productId || null,
              variantId: it.raw?.variantId || null,
              colorKey: it.raw?.colorKey || null,
              qty,
              title: it.title,
            });
          }
        });
      });

      if (returnItems.length === 0) {
        setRrErr("Please select at least one item to return.");
        return;
      }

      const files = rrFiles.slice(0, 5);

      const fd = new FormData();
      fd.append("reason", reason);
      if (note) fd.append("note", note);

      fd.append("items", JSON.stringify(returnItems));

      if (isCOD) {
        fd.append(
          "bankDetails",
          JSON.stringify({
            accountHolderName: bank.accountHolderName.trim(),
            accountNumber: bank.accountNumber.trim(),
            ifsc: bank.ifsc.trim(),
            bankName: (bank.bankName || "").trim() || null,
            upiId: (bank.upiId || "").trim() || null,
          })
        );
      }

      for (const f of files) fd.append("images", f);

      const res = await fetch(`${API_BASE}/users/orders/${orderId}/return-request`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Return request failed");

      setRrOk("Return request submitted.");
      setRrOpen(false);

      await load();
      await loadTracking();
    } catch (e: any) {
      setRrErr(e?.message || "Return request failed");
    } finally {
      setRrBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="border bg-white p-6">
        <div className="h-6 w-64 rounded bg-gray-200 animate-pulse" />
        <div className="mt-6 h-44 bg-gray-100 animate-pulse" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="border bg-white p-6">
        <div className="text-lg font-bold text-gray-900">Order Details</div>
        <div className="mt-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error || "Order not found"}
        </div>

        <button
          onClick={() => router.push("/user/orders")}
          className="mt-4 border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top back */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-bold text-gray-900">Order Details</div>
          <div className="text-xs text-gray-500 mt-1">
            Order Code:{" "}
            <span className="font-semibold text-gray-800">
              {order?.orderCode || String(order?._id).slice(-8)}
            </span>
          </div>

          {/* optional debug line */}
          {subOrderIdParam ? (
            <div className="text-[11px] text-gray-500 mt-1">
              Viewing SubOrder: <span className="font-mono">{subOrderIdParam}</span>
            </div>
          ) : null}
        </div>

        <button
          onClick={() => router.push("/user/orders")}
          className="border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
        >
          Back
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT */}
        <div className="lg:col-span-8 space-y-6">
          {/* Product summary card */}
          <div className="border bg-white overflow-hidden">
            <div className="bg-yellow-50 px-5 py-2 text-xs text-gray-700">
              Order status updates will appear here.
            </div>

            <div className="p-5 flex gap-4 items-start">
              <div className="flex-1">
                <div className="text-lg font-semibold text-gray-900">
                  {headerTitle}
                </div>

                {headerSubtitle ? (
                  <div className="mt-1 text-sm text-gray-600">
                    {headerSubtitle}
                  </div>
                ) : null}

                <div className="mt-2 text-xs text-gray-500">
                  Payment:{" "}
                  <span className="font-semibold text-gray-700">
                    {order?.paymentMethod || "COD"}
                  </span>{" "}
                  ({order?.paymentStatus || "PENDING"})
                </div>

                <div className="mt-3 text-xl font-bold text-gray-900">
                  {money(payable)}
                </div>

                <div className="mt-1 text-xs text-gray-500">
                  {totalItemsCount} item(s)
                </div>
              </div>

              <div className="h-20 w-20 overflow-hidden bg-gray-50 shrink-0">
                {headerImg ? (
                  <img
                    src={headerImg}
                    alt={headerTitle}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
            </div>

            <div className="border-t p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isCancelled ? "bg-red-500" : "bg-emerald-600"
                    }`}
                  />
                  <div className="font-semibold text-gray-900">
                    {deliveryHeadline}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Ordered: {fmtDateLong(createdAt)}
                </div>
              </div>

              <div className="mt-5">
                <OrderTimeline
                  status={status}
                  createdAt={createdAt}
                  updatedAt={updatedAt}
                />
              </div>
            </div>
          </div>

          {/* Tracking card (PER SUBORDER) */}
          <div className="border bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-gray-900">Tracking</div>

              <button
                type="button"
                onClick={loadTracking}
                disabled={trackingLoading}
                className="border px-3 py-2 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60"
              >
                {trackingLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {trackingError ? (
              <div className="mt-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {trackingError}
              </div>
            ) : null}

            {!computedSubOrders.length ? (
              <div className="mt-3 text-sm text-gray-600">No items found.</div>
            ) : (
              <div className="mt-4 space-y-4">
                {computedSubOrders.map((so: any) => {
                  const sh = pickShipmentForSubOrder(so, tracking);
                  const awb = String(sh?.shiprocket?.awb || "");
                  const shipmentId = sh?.shiprocket?.shipmentId ?? null;
                  const srOrderId = String(sh?.shiprocket?.orderId || "");

                  const tr = sh?.shiprocket?.tracking;
                  const trackingStatusText =
                    String(
                      tr?.tracking_data?.shipment_status ||
                        tr?.tracking_data?.shipment_track?.[0]?.current_status ||
                        tr?.current_status ||
                        tr?.status ||
                        sh?.status ||
                        "—"
                    ) || "—";

                  const events: any[] =
                    tr?.tracking_data?.shipment_track_activities ||
                    tr?.tracking_data?.shipment_track ||
                    tr?.activities ||
                    [];

                  return (
                    <div key={so._id} className="border">
                      <div className="border-b px-4 py-3 text-sm font-semibold text-gray-900">
                        Sold by: {so.soldBy}{" "}
                        {so.vendorName ? (
                          <span className="text-xs text-gray-500">
                            ({so.vendorName})
                          </span>
                        ) : null}
                      </div>

                      {!sh ? (
                        <div className="px-4 py-3 text-sm text-gray-600">
                          Shipment not created yet.
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">
                            <InfoCell label="AWB" value={awb || "—"} mono />
                            <InfoCell
                              label="Shipment ID"
                              value={shipmentId ?? "—"}
                              mono
                            />
                            <InfoCell
                              label="Shiprocket Order"
                              value={srOrderId || "—"}
                              mono
                            />
                          </div>

                          <div className="border-t px-4 py-3 text-sm text-gray-800">
                            <span className="font-semibold">Latest Status:</span>{" "}
                            {trackingStatusText}
                          </div>

                          {Array.isArray(events) && events.length ? (
                            <div className="border-t p-4">
                              <div className="text-sm font-semibold text-gray-900">
                                Updates
                              </div>
                              <div className="mt-3 space-y-3">
                                {events.slice(0, 6).map((ev: any, idx: number) => {
                                  const date =
                                    ev?.date ||
                                    ev?.activity_date ||
                                    ev?.updated_at ||
                                    ev?.timestamp;
                                  const statusText =
                                    ev?.status ||
                                    ev?.activity ||
                                    ev?.current_status ||
                                    ev?.status_description ||
                                    "Update";
                                  const loc =
                                    ev?.location ||
                                    ev?.city ||
                                    ev?.pickup_location ||
                                    "";
                                  return (
                                    <div
                                      key={idx}
                                      className="flex items-start justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0"
                                    >
                                      <div className="min-w-0">
                                        <div className="text-sm font-semibold text-gray-900">
                                          {String(statusText)}
                                        </div>
                                        {loc ? (
                                          <div className="text-xs text-gray-600 mt-0.5">
                                            {String(loc)}
                                          </div>
                                        ) : null}
                                      </div>
                                      <div className="text-xs text-gray-500 shrink-0">
                                        {date ? fmtDateTime(date) : "—"}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {events.length > 6 ? (
                                <div className="mt-3 text-xs text-gray-500">
                                  Showing latest 6 updates.
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Return Card */}
          <div className="border bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-gray-900">Return</div>

              {isDelivered ? (
                returnReqStatus ? (
                  <div className="text-xs font-semibold text-gray-700">
                    {returnReqStatus === "REQUESTED"
                      ? "Return Requested"
                      : `Return ${returnReqStatus}`}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setRrErr(null);
                      setRrOk(null);
                      setRrReason("");
                      setRrNote("");
                      setRrFiles([]);
                      setRrSelected({});
                      setBank({
                        accountHolderName: "",
                        accountNumber: "",
                        ifsc: "",
                        bankName: "",
                        upiId: "",
                      });
                      setRrOpen(true);
                    }}
                    className="border px-3 py-2 text-xs font-semibold hover:bg-gray-50"
                  >
                    Request Return
                  </button>
                )
              ) : null}
            </div>

            {returnReqStatus ? (
              <div className="mt-3 border p-4 text-sm">
                <div className="flex items-center justify-between">
                  <div className="text-gray-700">Return status</div>
                  <div className="font-semibold text-gray-900">
                    {returnReqStatus}
                  </div>
                </div>

                {returnReq?.reason ? (
                  <div className="mt-2 text-xs text-gray-600">
                    <span className="font-semibold text-gray-700">
                      Reason:
                    </span>{" "}
                    {String(returnReq.reason)}
                  </div>
                ) : null}

                {returnReq?.note ? (
                  <div className="mt-1 text-xs text-gray-600">
                    <span className="font-semibold text-gray-700">Note:</span>{" "}
                    {String(returnReq.note)}
                  </div>
                ) : null}

                {returnReqStatus === "REJECTED" && returnReq?.rejectReason ? (
                  <div className="mt-2 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    <span className="font-semibold">Reject reason:</span>{" "}
                    {String(returnReq.rejectReason)}
                  </div>
                ) : null}

                {returnReq?.bankDetails ? (
                  <div className="mt-3 border p-3 text-xs text-gray-700">
                    <div className="font-semibold text-gray-900 mb-2">
                      Refund bank details
                    </div>
                    <div>
                      <span className="font-semibold">A/C Holder:</span>{" "}
                      {returnReq.bankDetails?.accountHolderName || "—"}
                    </div>
                    <div>
                      <span className="font-semibold">A/C No:</span>{" "}
                      {returnReq.bankDetails?.accountNumber || "—"}
                    </div>
                    <div>
                      <span className="font-semibold">IFSC:</span>{" "}
                      {returnReq.bankDetails?.ifsc || "—"}
                    </div>
                    {returnReq.bankDetails?.bankName ? (
                      <div>
                        <span className="font-semibold">Bank:</span>{" "}
                        {returnReq.bankDetails.bankName}
                      </div>
                    ) : null}
                    {returnReq.bankDetails?.upiId ? (
                      <div>
                        <span className="font-semibold">UPI:</span>{" "}
                        {returnReq.bankDetails.upiId}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {Array.isArray(returnReq?.images) && returnReq.images.length ? (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-gray-700 mb-2">
                      Uploaded images
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {returnReq.images.slice(0, 5).map((p: string, i: number) => {
                        const src = resolveImageUrl(p);
                        return (
                          <div
                            key={i}
                            className="h-16 w-16 overflow-hidden border bg-gray-50"
                          >
                            {src ? (
                              <img
                                src={src}
                                alt={`return-${i}`}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {returnReq?.requestedAt ? (
                  <div className="mt-2 text-[11px] text-gray-500">
                    Requested: {fmtDateTime(returnReq.requestedAt)}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 text-sm text-gray-600">
                {isDelivered
                  ? "You can request a return within the return window."
                  : "Return is available only after delivery."}
              </div>
            )}

            {rrOk ? (
              <div className="mt-3 text-xs font-semibold text-emerald-700">
                {rrOk}
              </div>
            ) : null}
          </div>

          {/* Items (PER SUBORDER + SOLD BY) */}
          <div className="border bg-white p-5">
            <div className="font-semibold text-gray-900">Items</div>

            <div className="mt-4 space-y-5">
              {computedSubOrders.map((so: any) => (
                <div key={so._id} className="border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-bold text-gray-900">
                      Sold by: <span className="font-extrabold">{so.soldBy}</span>
                    </div>
                    <div className="text-xs font-semibold text-gray-600">
                      Status: {so.status} • Total: {money(pickSubOrderTotal(order, so))}
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    {so.__uiItems.map((x: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex gap-4 border-b pb-4 last:border-b-0 last:pb-0"
                      >
                        <div className="h-20 w-20 overflow-hidden bg-gray-100 shrink-0">
                          {x.img ? (
                            <img
                              src={x.img}
                              alt={x.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-gray-200" />
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900 line-clamp-2">
                                {x.title}
                              </div>

                              {x.productCode ? (
                                <div className="mt-0.5 text-[11px] font-semibold text-gray-500">
                                  Code: {x.productCode}
                                </div>
                              ) : null}

                              <div className="mt-1 text-xs text-gray-600">
                                Qty: {x.qty}
                                {x.colorText ? ` • Color: ${x.colorText}` : ""}
                                {x.vText ? ` • Variant: ${x.vText}` : ""}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-sm font-semibold text-gray-900">
                                {money(x.lineTotal)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {!so.__uiItems.length ? (
                      <div className="text-sm text-gray-600">
                        No items in this sub-order.
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {!computedSubOrders.length ? (
                <div className="border bg-white p-5 text-sm text-gray-700">
                  No items found.
                </div>
              ) : null}
            </div>
          </div>

          {/* Rate experience placeholder */}
          <div className="border bg-white p-5">
            <div className="font-semibold text-gray-900">Rate your experience</div>
            <div className="mt-3 border px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
              Did you find this page helpful?
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-4 space-y-6">
          {/* Delivery details */}
          <div className="border bg-white p-5">
            <div className="text-lg font-bold text-gray-900">Delivery details</div>

            <div className="mt-4 border p-4">
              <div className="text-sm font-semibold text-gray-900">
                {order?.address?.addressType ? String(order.address.addressType) : "Home"}
              </div>

              <div className="mt-2 text-sm text-gray-700 leading-6">
                {order?.address?.addressLine1 || ""}
                {order?.address?.addressLine2 ? `, ${order.address.addressLine2}` : ""}
                {order?.address?.landmark ? `, ${order.address.landmark}` : ""}
                {order?.address?.city ? `, ${order.address.city}` : ""}
                {order?.address?.state ? `, ${order.address.state}` : ""}
                {order?.address?.pincode ? ` - ${order.address.pincode}` : ""}
              </div>

              <div className="mt-4 h-px bg-gray-200" />

              <div className="mt-4 text-sm text-gray-800">
                <div className="font-semibold">
                  {order?.contact?.name || order?.address?.fullName || "—"}
                </div>
                <div className="text-gray-600">
                  {order?.contact?.phone || order?.address?.phone || "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Price details */}
          <div className="border bg-white p-5">
            <div className="text-lg font-bold text-gray-900">Price details</div>

            <div className="mt-4 border p-4 space-y-3 text-sm">
              <Row label="Listing price" value={money(mrpTotal || payable)} />
              <Row label="Special price" value={money(payable)} />
              <Row label="Total fees" value={money(0)} />

              <div className="h-px bg-gray-200" />

              <div className="flex items-center justify-between">
                <div className="font-bold text-gray-900">Total amount</div>
                <div className="font-bold text-gray-900">{money(payable)}</div>
              </div>

              <div className="mt-3 border px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-gray-700">Payment method</div>
                  <div className="font-semibold text-gray-900">
                    {String(order?.paymentMethod || "COD")}
                  </div>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Status: {String(order?.paymentStatus || "PENDING")}
                </div>
              </div>

              {savings > 0 ? (
                <div className="text-xs font-semibold text-emerald-700">
                  You saved {money(savings)}
                </div>
              ) : null}

              {subOrderIdParam ? (
                <div className="text-[11px] text-gray-500">
                  Showing details for selected seller shipment (sub-order).
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Order No. : {order?.orderCode || String(order?._id).slice(-8)}
      </div>

      {/* Return Request Modal (WITH PARTIAL ITEM SELECTION) */}
      {rrOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-lg border bg-white max-h-[90vh] overflow-hidden">
            <div className="border-b px-5 py-4">
              <div className="text-lg font-bold text-gray-900">Request Return</div>
              <div className="mt-1 text-xs text-gray-500">
                Order: {order?.orderCode || String(order?._id).slice(-8)}
              </div>
              <div className="mt-1 text-[11px] text-gray-500">
                Payment: <span className="font-semibold text-gray-800">{paymentMethod}</span>
                {isCOD ? " (Bank details required)" : ""}
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              {rrErr ? (
                <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {rrErr}
                </div>
              ) : null}

              {/* ✅ Select items */}
              <div className="border p-4">
                <div className="text-sm font-semibold text-gray-900">Select items to return</div>
                <div className="mt-3 space-y-4">
                  {computedSubOrders.map((so: any) => (
                    <div key={so._id} className="border p-3">
                      <div className="text-xs font-bold text-gray-900 mb-2">
                        Sold by: {so.soldBy}
                      </div>

                      <div className="space-y-3">
                        {so.__uiItems.map((it: any, idx: number) => {
                          const key = `${so._id}:${it.itemKey}`;
                          const selectedQty = rrSelected[key] || 0;

                          return (
                            <div key={idx} className="flex items-center justify-between gap-3">
                              <label className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={selectedQty > 0}
                                  onChange={(e) => {
                                    const on = e.target.checked;
                                    setRrSelected((prev) => {
                                      const next = { ...prev };
                                      if (!on) delete next[key];
                                      else next[key] = 1;
                                      return next;
                                    });
                                  }}
                                />
                                <span className="text-xs text-gray-800 line-clamp-1">{it.title}</span>
                              </label>

                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-gray-500">Qty</span>
                                <select
                                  value={selectedQty}
                                  disabled={selectedQty === 0}
                                  onChange={(e) => {
                                    const v = Number(e.target.value || 0);
                                    setRrSelected((prev) => ({ ...prev, [key]: v }));
                                  }}
                                  className="h-9 border px-2 text-sm bg-white"
                                >
                                  {Array.from({ length: it.qty + 1 }).map((_, n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 text-[11px] text-gray-500">
                  Tip: Select at least one item for partial return.
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-700 mb-1">Reason</div>
                <select
                  value={rrReason}
                  onChange={(e) => setRrReason(e.target.value)}
                  className="h-11 w-full rounded-xl border px-3 text-sm outline-none bg-white focus:border-gray-400"
                >
                  <option value="">Select reason</option>
                  <option value="Wrong item delivered">Wrong item delivered</option>
                  <option value="Damaged product">Damaged product</option>
                  <option value="Size issue">Size issue</option>
                  <option value="Quality issue">Quality issue</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-700 mb-1">Description / Note (optional)</div>
                <textarea
                  value={rrNote}
                  onChange={(e) => setRrNote(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-gray-400"
                  placeholder="Add details to help us process your return."
                />
              </div>

              {/* ✅ Images (max 5) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-semibold text-gray-700">Upload images (optional)</div>
                  <div className="text-[11px] text-gray-500">Max 5</div>
                </div>

                <input
                  id="rr-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const next = Array.from(e.target.files || []);
                    setRrFiles((prev) => [...prev, ...next].slice(0, 5));
                    e.currentTarget.value = "";
                  }}
                />

                <label
                  htmlFor="rr-upload"
                  className="flex items-center justify-center gap-2 h-14 w-full cursor-pointer rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50"
                >
                  <span className="font-semibold">Click to upload</span>
                  <span className="text-xs text-gray-400">(JPG, PNG)</span>
                </label>

                {rrFiles.length > 0 && (
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {rrFiles.map((file, i) => {
                      const url = URL.createObjectURL(file);
                      return (
                        <div key={i} className="relative h-16 w-16 rounded-lg border overflow-hidden">
                          <img src={url} alt={`upload-${i}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setRrFiles((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-white border text-[10px] font-bold"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ✅ COD bank details */}
              {isCOD ? (
                <div className="border p-4">
                  <div className="text-sm font-semibold text-gray-900">Bank details for refund (COD)</div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">Account holder name *</div>
                      <input
                        value={bank.accountHolderName}
                        onChange={(e) => setBank((p) => ({ ...p, accountHolderName: e.target.value }))}
                        className="h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-gray-400"
                        placeholder="Full name"
                      />
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">Account number *</div>
                      <input
                        value={bank.accountNumber}
                        onChange={(e) => setBank((p) => ({ ...p, accountNumber: e.target.value }))}
                        className="h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-gray-400"
                        placeholder="1234567890"
                      />
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">IFSC *</div>
                      <input
                        value={bank.ifsc}
                        onChange={(e) => setBank((p) => ({ ...p, ifsc: e.target.value.toUpperCase() }))}
                        className="h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-gray-400"
                        placeholder="SBIN0001234"
                      />
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">Bank name (optional)</div>
                      <input
                        value={bank.bankName || ""}
                        onChange={(e) => setBank((p) => ({ ...p, bankName: e.target.value }))}
                        className="h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-gray-400"
                        placeholder="State Bank of India"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <div className="text-xs font-semibold text-gray-700 mb-1">UPI ID (optional)</div>
                      <input
                        value={bank.upiId || ""}
                        onChange={(e) => setBank((p) => ({ ...p, upiId: e.target.value }))}
                        className="h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-gray-400"
                        placeholder="name@upi"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={rrBusy}
                  onClick={() => setRrOpen(false)}
                  className="border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={rrBusy}
                  onClick={submitReturnRequest}
                  className="bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                >
                  {rrBusy ? "Submitting…" : "Submit"}
                </button>
              </div>

              <div className="text-[11px] text-gray-500">
                Note: Images are optional. For COD refunds, bank details are required.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-gray-600">{label}</div>
      <div className="text-gray-900 font-semibold">{value}</div>
    </div>
  );
}

function InfoCell({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="px-4 py-3 border-b sm:border-b-0 sm:border-r last:sm:border-r-0">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-sm text-gray-900 ${mono ? "font-mono" : "font-semibold"}`}>
        {String(value ?? "—")}
      </div>
    </div>
  );
}

function OrderTimeline({ status, createdAt, updatedAt }: { status: string; createdAt: Date; updatedAt: Date }) {
  const s = String(status || "PLACED").toUpperCase();

  const isCancelled = s === "CANCELLED";
  const isDelivered = s === "DELIVERED";

  const stepConfirmedDone = true;
  const stepShippedDone = ["SHIPPED", "DELIVERED"].includes(s);
  const stepDeliveredDone = ["DELIVERED"].includes(s);

  return (
    <div className="space-y-4">
      <Step
        done={stepConfirmedDone}
        title={`Order Confirmed, ${createdAt.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}`}
        subtitle={s === "PLACED" ? "Your order has been placed." : "Your order is confirmed."}
        active={!stepShippedDone && !isCancelled && !isDelivered}
      />

      <Step
        done={stepShippedDone}
        title={`Shipped`}
        subtitle={
          stepShippedDone
            ? `Updated on ${updatedAt.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}`
            : "Not shipped yet."
        }
        active={stepShippedDone && !isDelivered && !isCancelled}
      />

      {isCancelled ? (
        <Step
          done
          title={`Cancelled`}
          subtitle={`Cancelled on ${updatedAt.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}`}
          active
          danger
        />
      ) : (
        <Step
          done={stepDeliveredDone}
          title={`Delivered`}
          subtitle={
            stepDeliveredDone
              ? `Delivered on ${updatedAt.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}`
              : "Not delivered yet."
          }
          active={stepDeliveredDone}
        />
      )}
    </div>
  );
}

function Step({
  done,
  title,
  subtitle,
  active,
  danger,
}: {
  done: boolean;
  title: string;
  subtitle: string;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`h-5 w-5 rounded-full flex items-center justify-center border ${
            done
              ? danger
                ? "bg-red-500 border-red-500"
                : "bg-emerald-600 border-emerald-600"
              : "bg-white border-gray-300"
          }`}
        >
          {done ? <div className="h-2 w-2 rounded-full bg-white" /> : null}
        </div>
        <div className={`w-px flex-1 ${done ? (danger ? "bg-red-200" : "bg-emerald-200") : "bg-gray-200"}`} />
      </div>

      <div className={`flex-1 p-3 ${active ? (danger ? "bg-red-50" : "bg-emerald-50") : ""}`}>
        <div className="font-semibold text-gray-900">{title}</div>
        <div className="mt-1 text-sm text-gray-600">{subtitle}</div>
      </div>
    </div>
  );
}
