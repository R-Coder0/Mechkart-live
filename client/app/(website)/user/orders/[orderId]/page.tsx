/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

function money(n: number) {
  return `₹${Math.round(Number(n || 0))}`;
}

function toNum(v: any, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function fmtDate(d?: any) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

function fmtDateLong(d?: any) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
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
  const v = (product?.variants || []).find((x: any) => String(x._id) === String(variantId));
  if (!v) return "";
  return v.label || v.comboText || v.size || v.weight || "";
}

function resolveItemImage(product?: any, variantId?: string, colorKey?: string | null, fallback?: string | null) {
  if (!product) return fallback || "";

  const v = (product.variants || []).find((x: any) => String(x._id) === String(variantId));
  const c = (product.colors || []).find((x: any) => normKey(x.name) === normKey(colorKey));

  const cImg = (c?.images || []).find(Boolean);
  const vImg = (v?.images || []).find(Boolean);
  const gImg = (product.galleryImages || []).find(Boolean);
  const fImg = product.featureImage || "";

  return cImg || vImg || gImg || fImg || fallback || "";
}

type Order = any;

export default function WebsiteUserOrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = String((params as any)?.orderId || "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

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

  useEffect(() => {
    if (orderId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const items = useMemo(() => (Array.isArray(order?.items) ? order.items : []), [order?.items]);

  const createdAt = order?.createdAt ? new Date(order.createdAt) : new Date();
  const updatedAt = order?.updatedAt ? new Date(order.updatedAt) : createdAt;

  const totals = order?.totals || {};

  // ✅ Payable should be grandTotal when available
  const payable = useMemo(() => {
    return toNum(totals?.grandTotal, NaN) || toNum(totals?.subtotal, NaN) || toNum(order?.totalAmount, 0);
  }, [totals?.grandTotal, totals?.subtotal, order?.totalAmount]);

  const mrpTotal = useMemo(() => toNum(totals?.mrpTotal, 0), [totals?.mrpTotal]);

  const savings = useMemo(() => {
    const s = toNum(totals?.savings, NaN);
    if (Number.isFinite(s)) return Math.max(0, s);
    return Math.max(0, mrpTotal ? mrpTotal - payable : 0);
  }, [totals?.savings, mrpTotal, payable]);

  // For header preview (first item + more)
  const firstItem = useMemo(() => items[0] || null, [items]);
  const firstProduct = firstItem?.productId || null;

  const headerTitle = useMemo(() => {
    const t = String(firstItem?.title || firstProduct?.title || "Product");
    if (items.length > 1) return `${t} + ${items.length - 1} more item(s)`;
    return t;
  }, [firstItem, firstProduct, items.length]);

  const headerSubtitle = useMemo(() => {
    if (!firstItem) return "";
    const vText = getVariantText(firstProduct, firstItem?.variantId);
    const colorText = firstItem?.colorKey ? String(firstItem.colorKey) : "";
    const parts: string[] = [];
    if (vText) parts.push(vText);
    if (colorText) parts.push(colorText);
    return parts.join(", ");
  }, [firstItem, firstProduct]);

  const headerImg = useMemo(() => {
    if (!firstItem) return "";
    const imgPath = resolveItemImage(firstProduct, firstItem?.variantId, firstItem?.colorKey, firstItem?.image);
    return resolveImageUrl(imgPath);
  }, [firstItem, firstProduct]);

  // ✅ Normalize each item for UI list
  const computedItems = useMemo(() => {
    return items.map((it: any) => {
      const product = it?.productId || null;
      const title = String(it?.title || product?.title || "Product");

      const vText = getVariantText(product, it?.variantId);
      const colorText = it?.colorKey ? String(it.colorKey) : "";

      const qty = Math.max(1, toNum(it?.qty, 1));

      // Try multiple field names for per-item totals
      const lineTotal =
        toNum(it?.finalLineTotal, NaN) ||
        toNum(it?.lineTotal, NaN) ||
        toNum(it?.total, NaN) ||
        toNum(it?.amount, NaN) ||
        (toNum(it?.finalPrice, NaN) ? toNum(it?.finalPrice, 0) * qty : NaN) ||
        (toNum(it?.salePrice, NaN) ? toNum(it?.salePrice, 0) * qty : NaN) ||
        0;

      const imgPath = resolveItemImage(product, it?.variantId, it?.colorKey, it?.image);
      const img = resolveImageUrl(imgPath);

      return {
        raw: it,
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
  }, [items]);

  const status = String(order?.status || "PLACED").toUpperCase();
  const isCancelled = status === "CANCELLED";
  const isDelivered = status === "DELIVERED";

  const expectedDelivery = addDays(createdAt, 7);

  const deliveryHeadline = useMemo(() => {
    if (isCancelled) return `Cancelled on ${fmtDateLong(updatedAt)}`;
    if (isDelivered) return `Delivered on ${fmtDateLong(updatedAt)}`;
    return `Delivery expected by ${fmtDateLong(expectedDelivery)}`;
  }, [isCancelled, isDelivered, updatedAt, expectedDelivery]);

  if (loading) {
    return (
      <div className=" border bg-white p-6">
        <div className="h-6 w-64 rounded bg-gray-200 animate-pulse" />
        <div className="mt-6 h-44  bg-gray-100 animate-pulse" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className=" border bg-white p-6">
        <div className="text-lg font-bold text-gray-900">Order Details</div>
        <div className="mt-3  border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error || "Order not found"}
        </div>

        <button
          onClick={() => router.push("/user/orders")}
          className="mt-4  border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
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
            <span className="font-semibold text-gray-800">{order?.orderCode || String(order?._id).slice(-8)}</span>
          </div>
        </div>

        <button onClick={() => router.push("/user/orders")} className=" border px-4 py-2 text-sm font-semibold hover:bg-gray-50">
          Back
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT */}
        <div className="lg:col-span-8 space-y-6">
          {/* Product summary card */}
          <div className=" border bg-white overflow-hidden">
            <div className="bg-yellow-50 px-5 py-2 text-xs text-gray-700">Order status updates will appear here.</div>

            <div className="p-5 flex gap-4 items-start">
              <div className="flex-1">
                <div className="text-lg font-semibold text-gray-900">{headerTitle}</div>

                {headerSubtitle ? <div className="mt-1 text-sm text-gray-600">{headerSubtitle}</div> : null}

                <div className="mt-2 text-xs text-gray-500">
                  Payment: <span className="font-semibold text-gray-700">{order?.paymentMethod || "COD"}</span>{" "}
                  ({order?.paymentStatus || "PENDING"})
                </div>

                <div className="mt-3 text-xl font-bold text-gray-900">{money(payable)}</div>

                <div className="mt-1 text-xs text-gray-500">{items.length} item(s)</div>
              </div>

              <div className="h-20 w-20  overflow-hidden bg-gray-50 shrink-0">
                {headerImg ? <img src={headerImg} alt={headerTitle} className="h-full w-full object-cover" /> : null}
              </div>
            </div>

            <div className="border-t p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${isCancelled ? "bg-red-500" : "bg-emerald-600"}`} />
                  <div className="font-semibold text-gray-900">{deliveryHeadline}</div>
                </div>
                <div className="text-xs text-gray-500">Ordered: {fmtDateLong(createdAt)}</div>
              </div>

              <div className="mt-5">
                <OrderTimeline status={status} createdAt={createdAt} updatedAt={updatedAt} />
              </div>
            </div>
          </div>

          {/* ✅ All items (NEW) */}
          <div className=" border bg-white p-5">
            <div className="font-semibold text-gray-900">Items</div>

            <div className="mt-4 space-y-4">
              {computedItems.map((x: any, idx: number) => (
                <div key={idx} className="flex gap-4 border-b pb-4 last:border-b-0 last:pb-0">
                  <div className="h-20 w-20 overflow-hidden bg-gray-100 shrink-0">
                    {x.img ? <img src={x.img} alt={x.title} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gray-200" />}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 line-clamp-2">{x.title}</div>

                        {x.productCode ? (
                          <div className="mt-0.5 text-[11px] font-semibold text-gray-500">Code: {x.productCode}</div>
                        ) : null}

                        <div className="mt-1 text-xs text-gray-600">
                          Qty: {x.qty}
                          {x.colorText ? ` • Color: ${x.colorText}` : ""}
                          {x.vText ? ` • Variant: ${x.vText}` : ""}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">{money(x.lineTotal)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {!computedItems.length ? (
                <div className=" border bg-white p-5 text-sm text-gray-700">No items found.</div>
              ) : null}
            </div>
          </div>

          {/* Rate experience placeholder */}
          <div className=" border bg-white p-5">
            <div className="font-semibold text-gray-900">Rate your experience</div>
            <div className="mt-3  border px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
              Did you find this page helpful?
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-4 space-y-6">
          {/* Delivery details */}
          <div className=" border bg-white p-5">
            <div className="text-lg font-bold text-gray-900">Delivery details</div>

            <div className="mt-4  border p-4">
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
                <div className="font-semibold">{order?.contact?.name || order?.address?.fullName || "—"}</div>
                <div className="text-gray-600">{order?.contact?.phone || order?.address?.phone || "—"}</div>
              </div>
            </div>
          </div>

          {/* Price details */}
          <div className=" border bg-white p-5">
            <div className="text-lg font-bold text-gray-900">Price details</div>

            <div className="mt-4  border p-4 space-y-3 text-sm">
              <Row label="Listing price" value={money(mrpTotal || payable)} />
              <Row label="Special price" value={money(payable)} />
              <Row label="Total fees" value={money(0)} />

              <div className="h-px bg-gray-200" />

              <div className="flex items-center justify-between">
                <div className="font-bold text-gray-900">Total amount</div>
                <div className="font-bold text-gray-900">{money(payable)}</div>
              </div>

              <div className="mt-3  border px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-gray-700">Payment method</div>
                  <div className="font-semibold text-gray-900">{String(order?.paymentMethod || "COD")}</div>
                </div>
                <div className="mt-1 text-xs text-gray-500">Status: {String(order?.paymentStatus || "PENDING")}</div>
              </div>

              {savings > 0 ? <div className="text-xs font-semibold text-emerald-700">You saved {money(savings)}</div> : null}
            </div>
          </div>
        </div>
      </div>

      {/* bottom order id strip */}
      <div className="text-xs text-gray-500">
        Order No. : {order?.orderCode || String(order?._id).slice(-8)}
      </div>
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
    <div className={`flex gap-3`}>
      <div className="flex flex-col items-center">
        <div
          className={`h-5 w-5 rounded-full flex items-center justify-center border ${
            done ? (danger ? "bg-red-500 border-red-500" : "bg-emerald-600 border-emerald-600") : "bg-white border-gray-300"
          }`}
        >
          {done ? <div className="h-2 w-2 rounded-full bg-white" /> : null}
        </div>
        <div className={`w-px flex-1 ${done ? (danger ? "bg-red-200" : "bg-emerald-200") : "bg-gray-200"}`} />
      </div>

      <div className={`flex-1  p-3 ${active ? (danger ? "bg-red-50" : "bg-emerald-50") : ""}`}>
        <div className="font-semibold text-gray-900">{title}</div>
        <div className="mt-1 text-sm text-gray-600">{subtitle}</div>
      </div>
    </div>
  );
}
