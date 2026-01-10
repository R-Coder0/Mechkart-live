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

// same helper like checkout
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

  const firstItem = useMemo(() => (order?.items || [])[0] || null, [order]);
  const product = firstItem?.productId || null;

  const title = String(firstItem?.title || product?.title || "Product");
  const vText = getVariantText(product, firstItem?.variantId);
  const colorText = firstItem?.colorKey ? String(firstItem.colorKey) : "";

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (vText) parts.push(vText);
    if (colorText) parts.push(colorText);
    return parts.join(", ");
  }, [vText, colorText]);

  const imgPath = resolveItemImage(product, firstItem?.variantId, firstItem?.colorKey, firstItem?.image);
  const img = resolveImageUrl(imgPath);

  const createdAt = order?.createdAt ? new Date(order.createdAt) : new Date();
  const updatedAt = order?.updatedAt ? new Date(order.updatedAt) : createdAt;

  const totals = order?.totals || {};
  const subtotal = Number(totals?.subtotal ?? order?.totalAmount ?? 0);
  const mrpTotal = Number(totals?.mrpTotal ?? 0);
  const savings = Number(totals?.savings ?? Math.max(0, mrpTotal - subtotal));

  const status = String(order?.status || "PLACED").toUpperCase();
  const isCancelled = status === "CANCELLED";
  const isDelivered = status === "DELIVERED";
  const isShipped = status === "SHIPPED";
  const isConfirmed = status === "CONFIRMED";
  const isPlaced = status === "PLACED";

  // Dates for timeline (simple + safe fallbacks)
  const placedDate = createdAt;
  const confirmedDate = createdAt; // you can store separate confirmedAt later
  const shippedDate = updatedAt;   // temporary fallback
  const deliveredDate = updatedAt; // temporary fallback
  const cancelledDate = updatedAt; // temporary fallback

  const expectedDelivery = addDays(createdAt, 7);

  const deliveryHeadline = useMemo(() => {
    if (isCancelled) return `Cancelled on ${fmtDateLong(cancelledDate)}`;
    if (isDelivered) return `Delivered on ${fmtDateLong(deliveredDate)}`;
    return `Delivery expected by ${fmtDateLong(expectedDelivery)}`;
  }, [isCancelled, isDelivered, cancelledDate, deliveredDate, expectedDelivery]);

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
          onClick={() => router.push("/website/user/orders")}
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
            Order Code: <span className="font-semibold text-gray-800">{order?.orderCode || String(order?._id).slice(-8)}</span>
          </div>
        </div>

        <button
          onClick={() => router.push("/website/user/orders")}
          className=" border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
        >
          Back
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT */}
        <div className="lg:col-span-8 space-y-6">
          {/* Product summary card */}
          <div className=" border bg-white overflow-hidden">
            {/* Optional top note strip (like shared order) - keep simple */}
            <div className="bg-yellow-50 px-5 py-2 text-xs text-gray-700">
              Order status updates will appear here.
            </div>

            <div className="p-5 flex gap-4 items-start">
              <div className="flex-1">
                <div className="text-lg font-semibold text-gray-900">{title}</div>

                {subtitle ? (
                  <div className="mt-1 text-sm text-gray-600">{subtitle}</div>
                ) : null}

                {/* Seller line - future */}
                <div className="mt-2 text-xs text-gray-500">
                  Payment: <span className="font-semibold text-gray-700">{order?.paymentMethod || "COD"}</span>{" "}
                  ({order?.paymentStatus || "PENDING"})
                </div>

                <div className="mt-3 text-xl font-bold text-gray-900">
                  {money(subtotal)}
                </div>
              </div>

              <div className="h-20 w-20  overflow-hidden bg-gray-50 shrink-0">
                <img src={img} alt={title} className="h-full w-full object-cover" />
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
                  <div className="font-semibold text-gray-900">{deliveryHeadline}</div>
                </div>
                <div className="text-xs text-gray-500">
                  Ordered: {fmtDateLong(createdAt)}
                </div>
              </div>

              {/* Tracking timeline */}
              <div className="mt-5">
                <OrderTimeline status={status} createdAt={createdAt} updatedAt={updatedAt} />
              </div>
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
              <Row label="Listing price" value={money(mrpTotal || subtotal)} />
              <Row label="Special price" value={money(subtotal)} />
              <Row label="Total fees" value={money(0)} />

              <div className="h-px bg-gray-200" />

              <div className="flex items-center justify-between">
                <div className="font-bold text-gray-900">Total amount</div>
                <div className="font-bold text-gray-900">{money(subtotal)}</div>
              </div>

              <div className="mt-3  border px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-gray-700">Payment method</div>
                  <div className="font-semibold text-gray-900">{String(order?.paymentMethod || "COD")}</div>
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

/**
 * Tracking statuses (simple, no location)
 * We show:
 * - Order Confirmed (always)
 * - Shipped (if status >= SHIPPED)
 * - Delivered (if DELIVERED)
 * - Cancelled (if CANCELLED)
 */
function OrderTimeline({
  status,
  createdAt,
  updatedAt,
}: {
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  const s = String(status || "PLACED").toUpperCase();

  const isCancelled = s === "CANCELLED";
  const isDelivered = s === "DELIVERED";
  const isShipped = s === "SHIPPED";
  const isConfirmed = s === "CONFIRMED";
  const isPlaced = s === "PLACED";

  // simple progression
  const stepConfirmedDone = true;
  const stepShippedDone = ["SHIPPED", "DELIVERED"].includes(s);
  const stepDeliveredDone = ["DELIVERED"].includes(s);

  const stepCancelledDone = isCancelled;

  return (
    <div className="space-y-4">
      {/* Confirmed */}
      <Step
        done={stepConfirmedDone}
        title={`Order Confirmed, ${createdAt.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}`}
        subtitle={isPlaced ? "Your order has been placed." : "Your order is confirmed."}
        active={!stepShippedDone && !isCancelled && !isDelivered}
      />

      {/* Shipped */}
      <Step
        done={stepShippedDone}
        title={`Shipped`}
        subtitle={stepShippedDone ? `Updated on ${updatedAt.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}` : "Not shipped yet."}
        active={stepShippedDone && !isDelivered && !isCancelled}
      />

      {/* Delivered or Cancelled */}
      {isCancelled ? (
        <Step
          done={stepCancelledDone}
          title={`Cancelled`}
          subtitle={`Cancelled on ${updatedAt.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}`}
          active
          danger
        />
      ) : (
        <Step
          done={stepDeliveredDone}
          title={`Delivered`}
          subtitle={stepDeliveredDone ? `Delivered on ${updatedAt.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}` : "Not delivered yet."}
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
