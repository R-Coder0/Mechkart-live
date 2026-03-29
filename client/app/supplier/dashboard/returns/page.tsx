/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("vendor_token");
};

function money(n: number) {
  return `₹${Math.round(Number(n || 0))}`;
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

    const finalLine = Number(it?.finalLineTotal);
    if (Number.isFinite(finalLine) && finalLine >= 0) return sum + finalLine;

    const baseLine = Number(it?.baseLineTotal);
    if (Number.isFinite(baseLine) && baseLine >= 0) return sum + baseLine;

    const baseSale = Number(it?.pricingMeta?.baseSalePrice);
    if (Number.isFinite(baseSale) && baseSale > 0) return sum + baseSale * qty;

    return sum;
  }, 0);
}

function pickSubOrderTotal(order: any, so: any) {
  const vtot = so?.vendorTotals || null;
  const v = toNum(vtot?.total, NaN) || toNum(vtot?.subtotal, NaN);
  if (Number.isFinite(v) && v >= 0) return v;

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

function getVariantTextFromItem(it: any) {
  const vid =
    it?.variantId?._id || it?.variantId || it?.variant?._id || it?.variant || "";
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

function getLatestReturnFromSub(sub: any) {
  const rs = Array.isArray(sub?.returns) ? sub.returns : [];
  if (!rs.length) return null;
  return rs[rs.length - 1];
}
function idStr(v: any) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v?._id) return String(v._id);
  return String(v);
}

function pickText(...vals: any[]) {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

function pickImg(...vals: any[]) {
  for (const v of vals) {
    if (Array.isArray(v)) {
      const first = v.find((x) => String(x ?? "").trim());
      if (first) return String(first);
      continue;
    }
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

function findVariantInProduct(product: any, variantId: any) {
  if (!product || !variantId) return null;
  const arr = Array.isArray(product?.variants) ? product.variants : [];
  return arr.find((x: any) => String(x?._id) === String(variantId)) || null;
}

function findColorInProduct(product: any, colorKey: any) {
  if (!product || !colorKey) return null;
  const arr = Array.isArray(product?.colors) ? product.colors : [];
  return (
    arr.find((x: any) => String(x?.name || "").trim().toLowerCase() === String(colorKey || "").trim().toLowerCase()) ||
    null
  );
}

function findSubOrderItemByReturnItem(sub: any, rit: any) {
  const list = Array.isArray(sub?.items) ? sub.items : [];

  const pid = idStr(rit?.productId);
  const vid = rit?.variantId ? idStr(rit.variantId) : "";
  const ck = String(rit?.colorKey || "").trim().toLowerCase();

  return (
    list.find((it: any) => {
      const xpid = idStr(it?.productId);
      const xvid = it?.variantId ? idStr(it.variantId) : "";
      const xck = String(it?.colorKey || "").trim().toLowerCase();
      return xpid === pid && xvid === vid && xck === ck;
    }) || null
  );
}

function hydrateReturnItem(sub: any, rit: any) {
  const matched = findSubOrderItemByReturnItem(sub, rit);

  const product =
    (matched?.productId && typeof matched.productId === "object" ? matched.productId : null) ||
    (matched?.product && typeof matched.product === "object" ? matched.product : null) ||
    (rit?.productId && typeof rit.productId === "object" ? rit.productId : null) ||
    null;

  const variantObj =
    (matched?.variantId && typeof matched.variantId === "object" ? matched.variantId : null) ||
    findVariantInProduct(product, matched?.variantId || rit?.variantId);

  const colorObj = findColorInProduct(product, matched?.colorKey || rit?.colorKey);

  const qty = Math.max(1, Number(rit?.qty || matched?.qty || 1));

  const title = pickText(
    rit?.title,
    rit?.productTitle,
    matched?.title,
    matched?.name,
    matched?.productTitle,
    matched?.productName,
    product?.title,
    product?.name
  );

  const productCode = pickText(
    rit?.productCode,
    matched?.productCode,
    matched?.sku,
    matched?.code,
    matched?.productSku,
    product?.productCode,
    product?.sku
  );

  const variantLabel = pickText(
    rit?.variantLabel,
    matched?.variantLabel,
    matched?.variantName,
    matched?.variantText,
    matched?.variantSnapshot?.label,
    matched?.variantSnapshot?.comboText,
    matched?.variantSnapshot?.size,
    matched?.variantSnapshot?.weight,
    variantObj?.label,
    variantObj?.comboText,
    variantObj?.size,
    variantObj?.weight
  );

  const image = pickImg(
    rit?.image,
    matched?.image,
    matched?.featureImage,
    matched?.selectedVariant?.image,
    matched?.selectedVariant?.images,
    colorObj?.images,
    variantObj?.images,
    product?.featureImage,
    product?.galleryImages
  );

  const unitPrice =
    toNum(rit?.unitPrice, NaN) ||
    toNum(matched?.finalUnitPrice, NaN) ||
    toNum(matched?.unitFinalPrice, NaN) ||
    toNum(matched?.finalPrice, NaN) ||
    toNum(matched?.salePrice, NaN) ||
    toNum(matched?.price, NaN) ||
    toNum(matched?.unitPrice, NaN) ||
    toNum(matched?.pricingMeta?.finalUnitPrice, NaN) ||
    toNum(matched?.pricingMeta?.salePrice, NaN) ||
    toNum(matched?.pricingMeta?.baseSalePrice, NaN) ||
    0;

  const finalLineTotal =
    toNum(rit?.finalLineTotal, NaN) ||
    toNum(matched?.vendorPricing?.baseFinalLineTotal, NaN) ||
    toNum(matched?.finalLineTotal, NaN) ||
    toNum(matched?.lineTotal, NaN) ||
    toNum(matched?.baseLineTotal, NaN) ||
    (unitPrice > 0 ? unitPrice * qty : 0);

  return {
    ...rit,
    qty,
    title: title || null,
    productCode: productCode || null,
    variantLabel: variantLabel || null,
    image: image || null,
    unitPrice: unitPrice || 0,
    finalLineTotal: finalLineTotal || 0,
    colorKey: rit?.colorKey || matched?.colorKey || null,
    variantId: rit?.variantId || matched?.variantId || null,
    productId: rit?.productId || matched?.productId || null,
  };
}
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
  qs.set("limit", String(params.limit || 50));

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

async function vendorApproveReturn(orderId: string, subOrderId: string, returnId: string) {
  const token = getToken();
  if (!token) throw new Error("Vendor token missing. Please login again.");

  const res = await fetch(
    `${API_BASE}/vendors/orders/${orderId}/suborders/${subOrderId}/returns/${returnId}/approve`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Failed to approve return");
  return json;
}

async function vendorRejectReturn(
  orderId: string,
  subOrderId: string,
  returnId: string,
  rejectReason: string
) {
  const token = getToken();
  if (!token) throw new Error("Vendor token missing. Please login again.");

  const res = await fetch(
    `${API_BASE}/vendors/orders/${orderId}/suborders/${subOrderId}/returns/${returnId}/reject`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rejectReason }),
      cache: "no-store",
    }
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Failed to reject return");
  return json;
}

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

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-lg font-extrabold text-gray-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function VendorReturnsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<any>({
    items: [],
    page: 1,
    totalPages: 1,
    total: 0,
  });

  const [busyKey, setBusyKey] = useState("");
  const [ok, setOk] = useState<string | null>(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTarget, setRejectTarget] = useState<any>(null);

  const load = async (nextPage = 1) => {
    try {
      setLoading(true);
      setError(null);
      setOk(null);

      const resp = await vendorFetchOrders({
        q,
        page: nextPage,
        limit: 50,
      });

      setData(resp);
      setPage(resp?.page || nextPage);
    } catch (e: any) {
      setError(e?.message || "Failed to load return requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, []);

  const rows = useMemo(() => {
    const orders = Array.isArray(data?.items) ? data.items : [];
    const out: any[] = [];

    for (const order of orders) {
      const sub = Array.isArray(order?.subOrders) ? order.subOrders[0] : null;
      if (!sub) continue;

      const ret = getLatestReturnFromSub(sub);
      if (!ret) continue;

      const retStatus = String(ret?.status || "").toUpperCase();
      if (status && retStatus !== status) continue;

const items = (Array.isArray(ret?.items) ? ret.items : []).map((it: any) =>
  hydrateReturnItem(sub, it)
);
      const orderCode = String(order?.orderCode || "—");
      const customerName = order?.contact?.name || order?.address?.fullName || "—";
      const phone = order?.contact?.phone || order?.address?.phone || "—";
      const paymentMethod = String(order?.paymentMethod || "COD").toUpperCase();

      out.push({
        order,
        sub,
        ret,
        orderId: String(order?._id || ""),
        subOrderId: String(sub?._id || ""),
        returnId: String(ret?._id || ""),
        orderCode,
        customerName,
        phone,
        paymentMethod,
        retStatus,
        items,
        total: pickSubOrderTotal(order, sub),
        requestedAt: ret?.requestedAt || ret?.createdAt || order?.updatedAt,
      });
    }

    const filtered = q.trim()
      ? out.filter((x) => {
          const t = q.trim().toLowerCase();
          return (
            String(x.orderCode).toLowerCase().includes(t) ||
            String(x.customerName).toLowerCase().includes(t) ||
            String(x.phone).toLowerCase().includes(t)
          );
        })
      : out;

    return filtered.sort((a, b) => {
      const ta = a?.requestedAt ? new Date(a.requestedAt).getTime() : 0;
      const tb = b?.requestedAt ? new Date(b.requestedAt).getTime() : 0;
      return tb - ta;
    });
  }, [data?.items, q, status]);

  const approve = async (row: any) => {
    const actionKey = `${row.orderId}:${row.subOrderId}:${row.returnId}:approve`;
    try {
      setBusyKey(actionKey);
      setError(null);
      setOk(null);
      await vendorApproveReturn(row.orderId, row.subOrderId, row.returnId);
      setOk("Return approved successfully.");
      await load(page);
    } catch (e: any) {
      setError(e?.message || "Failed to approve return");
    } finally {
      setBusyKey("");
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setError("Reject reason is required");
      return;
    }

    const actionKey = `${rejectTarget.orderId}:${rejectTarget.subOrderId}:${rejectTarget.returnId}:reject`;
    try {
      setBusyKey(actionKey);
      setError(null);
      setOk(null);

      await vendorRejectReturn(
        rejectTarget.orderId,
        rejectTarget.subOrderId,
        rejectTarget.returnId,
        reason
      );

      setRejectOpen(false);
      setRejectReason("");
      setRejectTarget(null);
      setOk("Return rejected successfully.");
      await load(page);
    } catch (e: any) {
      setError(e?.message || "Failed to reject return");
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Vendor · Returns</h1>
          <p className="text-sm text-gray-600">{rows.length} return request(s)</p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/vendors/orders"
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Orders
          </Link>
          <button
            type="button"
            onClick={() => load(page)}
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search: order code / customer / phone"
            className="h-11 rounded-2xl border px-4 text-sm outline-none focus:border-gray-400"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-11 rounded-2xl border bg-white px-4 text-sm outline-none focus:border-gray-400"
          >
            <option value="">All Return Status</option>
            {["REQUESTED", "APPROVED", "REJECTED", "RECEIVED", "REFUNDED"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

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

      {ok ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {ok}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-3xl border bg-gray-100" />
          ))
        ) : rows.length ? (
          rows.map((row: any) => {
            const ret = row.ret;
            const retStatus = row.retStatus;
            const canAct = retStatus === "REQUESTED";
            const bank = ret?.bankDetails || null;

            return (
              <div key={`${row.orderId}:${row.returnId}`} className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-lg font-extrabold text-gray-900">{row.orderCode}</div>
                      {retStatus === "REQUESTED" ? <Badge tone="amber">REQUESTED</Badge> : null}
                      {retStatus === "APPROVED" ? <Badge tone="indigo">APPROVED</Badge> : null}
                      {retStatus === "REJECTED" ? <Badge tone="red">REJECTED</Badge> : null}
                      {retStatus === "RECEIVED" ? <Badge tone="blue">RECEIVED</Badge> : null}
                      {retStatus === "REFUNDED" ? <Badge tone="green">REFUNDED</Badge> : null}
                    </div>

                    <div className="mt-2 text-sm text-gray-700">
                      {row.customerName} • {row.phone}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Requested: {fmtDateTime(row.requestedAt)}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Payment: {row.paymentMethod} • SubOrder Total: {money(row.total)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canAct ? (
                      <>
                        <button
                          type="button"
                          disabled={busyKey === `${row.orderId}:${row.subOrderId}:${row.returnId}:approve`}
                          onClick={() => approve(row)}
                          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                        >
                          Approve
                        </button>

                        <button
                          type="button"
                          disabled={busyKey === `${row.orderId}:${row.subOrderId}:${row.returnId}:reject`}
                          onClick={() => {
                            setError(null);
                            setRejectReason("");
                            setRejectTarget(row);
                            setRejectOpen(true);
                          }}
                          className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <div className="text-xs font-semibold text-gray-500">
                        No action available
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <div className="xl:col-span-2 rounded-2xl border p-4">
                    <div className="mb-3 text-sm font-extrabold text-gray-900">Return Items</div>

                    <div className="space-y-3">
{row.items.map((it: any, idx: number) => {
  const img = resolveImageUrl(String(it?.image || "").trim());
  const title = String(it?.title || "Product");
  const variantText =
    String(it?.variantLabel || "").trim() || getVariantTextFromItem(it);
  const colorText = it?.colorKey ? String(it.colorKey) : "";
  const qty = Math.max(1, Number(it?.qty || 1));

  const line =
    toNum(it?.finalLineTotal, NaN) ||
    (toNum(it?.unitPrice, NaN) > 0 ? toNum(it?.unitPrice, 0) * qty : NaN) ||
    0;

  return (
    <div key={idx} className="flex gap-3 rounded-2xl border p-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100">
        {img ? <img src={img} alt="item" className="h-full w-full object-cover" /> : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="line-clamp-1 text-sm font-extrabold text-gray-900">
          {title}
        </div>

        {it?.productCode ? (
          <div className="text-[11px] font-semibold text-gray-500">
            SKU: {String(it.productCode)}
          </div>
        ) : null}

        <div className="mt-1 text-[12px] text-gray-700">
          Qty: {qty}
          {colorText ? ` • Color: ${colorText}` : ""}
          {variantText ? ` • Variant: ${variantText}` : ""}
        </div>
      </div>

      <div className="text-sm font-extrabold text-gray-900">{money(line)}</div>
    </div>
  );
})}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border p-4">
                      <div className="mb-3 text-sm font-extrabold text-gray-900">Return Details</div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-semibold text-gray-800">Reason:</span>{" "}
                          <span className="text-gray-700">{ret?.reason || "—"}</span>
                        </div>

                        <div>
                          <span className="font-semibold text-gray-800">Note:</span>{" "}
                          <span className="text-gray-700">{ret?.note || "—"}</span>
                        </div>

                        <div>
                          <span className="font-semibold text-gray-800">Handled By:</span>{" "}
                          <span className="text-gray-700">{ret?.handledByRole || "—"}</span>
                        </div>

                        {ret?.approvedAt ? (
                          <div>
                            <span className="font-semibold text-gray-800">Approved At:</span>{" "}
                            <span className="text-gray-700">{fmtDateTime(ret.approvedAt)}</span>
                          </div>
                        ) : null}

                        {ret?.rejectedAt ? (
                          <div>
                            <span className="font-semibold text-gray-800">Rejected At:</span>{" "}
                            <span className="text-gray-700">{fmtDateTime(ret.rejectedAt)}</span>
                          </div>
                        ) : null}

                        {ret?.rejectReason ? (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                            <span className="font-semibold">Reject reason:</span>{" "}
                            {String(ret.rejectReason)}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {row.paymentMethod === "COD" && bank ? (
                      <div className="rounded-2xl border p-4">
                        <div className="mb-3 text-sm font-extrabold text-gray-900">Refund Bank Details</div>

                        <div className="space-y-2 text-sm text-gray-700">
                          <div>
                            <span className="font-semibold text-gray-800">A/C Holder:</span>{" "}
                            {bank?.accountHolderName || "—"}
                          </div>
                          <div>
                            <span className="font-semibold text-gray-800">A/C Number:</span>{" "}
                            {bank?.accountNumber || "—"}
                          </div>
                          <div>
                            <span className="font-semibold text-gray-800">IFSC:</span>{" "}
                            {bank?.ifsc || "—"}
                          </div>
                          <div>
                            <span className="font-semibold text-gray-800">Bank:</span>{" "}
                            {bank?.bankName || "—"}
                          </div>
                          <div>
                            <span className="font-semibold text-gray-800">UPI:</span>{" "}
                            {bank?.upiId || "—"}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {Array.isArray(ret?.images) && ret.images.length ? (
                      <div className="rounded-2xl border p-4">
                        <div className="mb-3 text-sm font-extrabold text-gray-900">Return Images</div>
                        <div className="grid grid-cols-2 gap-3">
                          {ret.images.map((img: string, idx: number) => {
                            const src = resolveImageUrl(img);
                            return (
                              <div key={idx} className="overflow-hidden rounded-xl border bg-gray-50">
                                {src ? (
                                  <img
                                    src={src}
                                    alt={`return-${idx}`}
                                    className="h-28 w-full object-cover"
                                  />
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-3xl border bg-white p-6 text-sm text-gray-600">
            No return requests found.
          </div>
        )}
      </div>

      <Modal
        open={rejectOpen}
        title="Reject Return"
        onClose={() => {
          setRejectOpen(false);
          setRejectReason("");
          setRejectTarget(null);
        }}
      >
        <div className="space-y-4">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={5}
            placeholder="Enter reject reason"
            className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRejectOpen(false);
                setRejectReason("");
                setRejectTarget(null);
              }}
              className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!rejectReason.trim() || !!busyKey}
              onClick={confirmReject}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              Confirm Reject
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}