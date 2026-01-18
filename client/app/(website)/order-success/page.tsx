/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;
const RZP_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);

    const src = "https://checkout.razorpay.com/v1/checkout.js";
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function money(n: number) {
  return `₹${Math.round(Number(n || 0))}`;
}

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function resolveImageUrl(path?: string) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const host = (API_BASE || "").replace(/\/api\/?$/, "");
  return path.startsWith("/") ? `${host}${path}` : `${host}/${path}`;
}

function getVariantText(product?: any, variantId?: string) {
  const v = (product?.variants || []).find((x: any) => String(x._id) === String(variantId));
  if (!v) return "";
  return String(v.label || v.comboText || v.size || v.weight || "").trim();
}

export default function OrderSuccessPage() {
  const sp = useSearchParams();

  // ✅ keep hooks always in same order (no conditional hook calls)
  const orderId = useMemo(() => sp.get("orderId") || "", [sp]);
  const orderCodeFromQuery = useMemo(() => sp.get("orderCode") || "", [sp]);

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [payBusy, setPayBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        if (!orderId) {
          setError("Missing orderId");
          return;
        }

        const res = await fetch(`${API_BASE}/users/orders/${orderId}`, {
          credentials: "include",
          cache: "no-store",
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || "Order fetch failed");

        setOrder(json?.data || json);

        // preload Razorpay script (non-blocking)
        loadRazorpayScript();
      } catch (e: any) {
        setError(e?.message || "Failed to load order");
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const orderCode = useMemo(() => {
    return order?.orderCode || orderCodeFromQuery || "";
  }, [order?.orderCode, orderCodeFromQuery]);

  const totals = useMemo(() => order?.totals || {}, [order?.totals]);

  // ✅ final payable
  const payable = useMemo(() => {
    return (
      toNum(totals?.grandTotal, NaN) ||
      toNum(totals?.total, NaN) ||
      toNum(order?.totalAmount, NaN) ||
      toNum(totals?.subtotal, 0)
    );
  }, [totals, order?.totalAmount]);

  // ✅ subtotal before offer
  const subtotalBeforeOffer = useMemo(() => {
    return toNum(totals?.subtotal, NaN) || toNum(totals?.subtotalBeforeOffer, NaN) || payable;
  }, [totals, payable]);

  // ✅ mrp total
  const mrpTotal = useMemo(() => {
    return toNum(totals?.mrpTotal, NaN) || toNum(totals?.totalMrp, NaN) || 0;
  }, [totals]);

  // ✅ offer / coupon discount
  const offerDiscount = useMemo(() => {
    return Math.max(
      0,
      toNum(totals?.discount, NaN) ||
        toNum(totals?.offerDiscount, NaN) ||
        toNum(totals?.couponDiscount, NaN) ||
        0
    );
  }, [totals]);

  // ✅ total savings (MRP -> payable)
  const totalSavings = useMemo(() => {
    return Math.max(0, toNum(totals?.savings, NaN) || (mrpTotal ? mrpTotal - payable : 0));
  }, [totals, mrpTotal, payable]);

  const items = useMemo(() => {
    return Array.isArray(order?.items) ? order.items : [];
  }, [order?.items]);

  // ✅ ONLINE pending?
  const isOnlinePending = useMemo(() => {
    const pm = String(order?.paymentMethod || "").toUpperCase();
    const ps = String(order?.paymentStatus || "").toUpperCase();
    return pm === "ONLINE" && ps !== "PAID";
  }, [order?.paymentMethod, order?.paymentStatus]);

  const computedItems = useMemo(() => {
    if (!items.length) return [];

    const raw = items.map((it: any) => {
      const qty = Math.max(1, toNum(it?.qty, 1));
      const product = it?.productId || null;

      const variant = (product?.variants || []).find((v: any) => String(v._id) === String(it?.variantId));

      const saleEach =
        toNum(it?.finalPrice, NaN) ||
        toNum(it?.salePrice, NaN) ||
        toNum(it?.price, NaN) ||
        toNum(it?.unitPrice, NaN) ||
        toNum(it?.lineUnitPrice, NaN) ||
        toNum(variant?.salePrice, NaN) ||
        toNum(product?.salePrice, NaN) ||
        0;

      const mrpEach =
        toNum(it?.mrp, NaN) ||
        toNum(it?.mrpPrice, NaN) ||
        toNum(it?.listPrice, NaN) ||
        toNum(variant?.mrp, NaN) ||
        toNum(product?.mrp, NaN) ||
        0;

      const saleLine = Math.max(0, saleEach * qty);
      const mrpLine = Math.max(0, mrpEach * qty);

      const title = String(it?.title || product?.title || "Product");
      const code = String(it?.productCode || "NA");
      const image = String(it?.image || "");

      return { it, qty, product, saleLine, mrpLine, title, code, image };
    });

    const sumSaleLine = raw.reduce((s: any, x: { saleLine: any }) => s + x.saleLine, 0);
    const sumQty = raw.reduce((s: any, x: { qty: any }) => s + x.qty, 0);

    let remaining = Math.max(0, Math.round(payable));

    const out = raw.map((x: any, idx: number) => {
      let allocatedLine = 0;

      if (sumSaleLine > 0) {
        if (idx === raw.length - 1) allocatedLine = remaining;
        else {
          allocatedLine = Math.round((x.saleLine / sumSaleLine) * payable);
          allocatedLine = Math.min(allocatedLine, remaining);
        }
      } else {
        if (idx === raw.length - 1) allocatedLine = remaining;
        else {
          allocatedLine = Math.round((x.qty / Math.max(1, sumQty)) * payable);
          allocatedLine = Math.min(allocatedLine, remaining);
        }
      }

      remaining = Math.max(0, remaining - allocatedLine);

      const each = Math.round(allocatedLine / Math.max(1, x.qty));
      const variantText = getVariantText(x.product, x.it?.variantId);

      return {
        ...x.it,
        __ui: {
          title: x.title,
          code: x.code,
          qty: x.qty,
          product: x.product,
          variantText,
          image: x.image,
          payableLine: allocatedLine,
          payableEach: each,
          mrpLine: x.mrpLine,
        },
      };
    });

    return out;
  }, [items, payable]);

  const ship = useMemo(() => {
    return order?.address || order?.addressSnapshot || order?.shippingAddress || null;
  }, [order]);

  const contact = useMemo(() => order?.contact || null, [order]);

  const appliedOfferName = useMemo(() => {
    return (
      order?.appliedOffer?.name ||
      order?.offer?.name ||
      totals?.appliedOffer?.name ||
      totals?.offerName ||
      ""
    );
  }, [order, totals]);

  const appliedCouponCode = useMemo(() => {
    return (
      String(order?.couponCode || totals?.couponCode || "").trim() ||
      String(order?.appliedOffer?.couponCode || totals?.appliedOffer?.couponCode || "").trim()
    );
  }, [order, totals]);

  const onCopy = async () => {
    try {
      if (!orderCode) return;
      await navigator.clipboard.writeText(orderCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  // ✅ Pay Now (resume payment if ONLINE pending)
  const onPayNow = async () => {
    try {
      setError(null);

      if (!orderId) throw new Error("Missing orderId");
      if (!order) throw new Error("Order not loaded");
      if (!RZP_KEY) throw new Error("Missing NEXT_PUBLIC_RAZORPAY_KEY_ID in UI env");

      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Razorpay SDK failed to load. Please try again.");

      const rpOrderId = String(order?.pg?.orderId || "").trim();

      // amount in paise: prefer order.pg.amount else derive from totals
      const amountPaise =
        Number(order?.pg?.amount || 0) || Math.round(Number(order?.totals?.grandTotal || payable || 0) * 100);

      if (!rpOrderId) throw new Error("Payment orderId missing");
      if (!amountPaise) throw new Error("Payment amount missing");

      setPayBusy(true);

      const options: any = {
        key: RZP_KEY,
        amount: amountPaise,
        currency: "INR",
        name: "Country Home",
        description: `Complete payment for ${String(order?.orderCode || "")}`,
        order_id: rpOrderId,
        prefill: {
          name: order?.contact?.name || "",
          contact: order?.contact?.phone || "",
          email: order?.contact?.email || "",
        },
        notes: {
          appOrderId: String(orderId),
          orderCode: String(order?.orderCode || ""),
        },
        handler: async function (response: any) {
          try {
            const res = await fetch(`${API_BASE}/users/orders/razorpay/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                orderId: String(orderId),
                razorpay_order_id: String(response.razorpay_order_id || ""),
                razorpay_payment_id: String(response.razorpay_payment_id || ""),
                razorpay_signature: String(response.razorpay_signature || ""),
              }),
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.message || "Payment verification failed");

            window.location.href = `/order-success?orderId=${orderId}`;
          } catch (e: any) {
            setError(e?.message || "Payment verification failed");
            setPayBusy(false);
          }
        },
        modal: {
          ondismiss: () => setPayBusy(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (resp: any) {
        setPayBusy(false);
        setError(resp?.error?.description || "Payment failed");
      });
      rzp.open();
    } catch (e: any) {
      setPayBusy(false);
      setError(e?.message || "Could not start payment");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="h-8 w-56 rounded bg-gray-200 animate-pulse" />
        <div className="mt-6 h-44 rounded-3xl border bg-gray-50 animate-pulse" />
        <div className="mt-4 h-72 rounded-3xl border bg-gray-50 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-3xl border bg-white p-8">
          <div className="text-xl font-bold text-gray-900">Order</div>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <div className="mt-6 flex gap-3">
            <Link className="rounded-2xl border px-4 py-3 text-sm font-semibold" href="/">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Header card */}
      <div className="rounded-3xl border bg-white p-8">
        <div className="text-2xl font-bold text-gray-900">Order placed successfully</div>

        <div className="mt-3 flex flex-col gap-2 text-sm text-gray-600">
          <div className="flex flex-wrap items-center gap-2">
            <span>Order Code:</span>
            <span className="font-semibold text-gray-900">{orderCode || "—"}</span>

            {orderCode ? (
              <button
                type="button"
                onClick={onCopy}
                className="rounded-xl border px-3 py-1.5 text-[12px] font-semibold text-gray-900 hover:bg-gray-50"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            ) : null}
          </div>

          {appliedOfferName || appliedCouponCode ? (
            <div className="text-emerald-700 font-semibold">
              Applied: {appliedOfferName || "Offer"}
              {appliedCouponCode ? ` (${appliedCouponCode})` : ""}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <div>
              Status: <span className="font-semibold text-gray-900">{order?.status || "PLACED"}</span>
            </div>
            <div>
              Payment:{" "}
              <span className="font-semibold text-gray-900">{order?.paymentMethod || "COD"}</span>{" "}
              <span className="text-gray-500">({order?.paymentStatus || "PENDING"})</span>
            </div>
            <div>
              Payable: <span className="font-semibold text-gray-900">{money(payable)}</span>
            </div>
          </div>

          {/* ✅ ONLINE payment pending banner + Pay Now */}
          {isOnlinePending ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="font-semibold text-amber-900">Payment Pending</div>
              <div className="mt-1 text-amber-800">
                Your order is created but payment is not completed. Please complete payment to confirm the order.
              </div>
              <button
                type="button"
                onClick={onPayNow}
                disabled={payBusy}
                className="mt-3 rounded-2xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                {payBusy ? "Opening payment..." : "Pay Now"}
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
            href="/"
          >
            Continue shopping
          </Link>

          <a
            className="rounded-2xl border px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            href={`${API_BASE}/users/orders/${orderId}/invoice`}
            target="_blank"
            rel="noreferrer"
          >
            Download invoice
          </a>

          <Link
            className="rounded-2xl border px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            href="/user/orders"
          >
            View my orders
          </Link>
        </div>
      </div>

      {/* Items */}
      <div className="mt-6 rounded-3xl border bg-white p-6">
        <div className="text-lg font-bold text-gray-900">Items</div>

        <div className="mt-4 space-y-4">
          {computedItems.map((it: any, idx: number) => {
            const ui = it.__ui || {};
            const title = ui.title || "Product";
            const code = ui.code || "NA";
            const qty = ui.qty || 1;

            const variantText = ui.variantText || "";
            const img = resolveImageUrl(ui.image || it?.image || "");

            const lineTotal = toNum(ui.payableLine, 0);
            const each = toNum(ui.payableEach, 0);
            const mrpLine = toNum(ui.mrpLine, 0);

            const saved = mrpLine > 0 ? Math.max(0, mrpLine - lineTotal) : 0;

            return (
              <div key={idx} className="flex gap-4 border-b pb-4 last:border-b-0 last:pb-0">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gray-50">
                  <img src={img} alt={title} className="h-full w-full object-cover" />
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{title}</div>
                      <div className="mt-0.5 text-[11px] font-semibold text-gray-500">Product Code: {code}</div>

                      <div className="mt-1 text-xs text-gray-500">
                        Qty: {qty}
                        {it?.colorKey ? ` • Color: ${it.colorKey}` : ""}
                        {variantText ? ` • Variant: ${variantText}` : ""}
                      </div>

                      {mrpLine > 0 ? (
                        <div className="mt-1 text-xs text-gray-500">
                          <span className="line-through">{money(mrpLine)}</span>
                          {saved > 0 ? (
                            <span className="ml-2 text-emerald-700 font-semibold">Saved {money(saved)}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">{money(lineTotal)}</div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {money(each)} × {qty}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {!computedItems.length ? (
            <div className="rounded-2xl border bg-gray-50 p-4 text-sm text-gray-700">No items found in this order.</div>
          ) : null}
        </div>
      </div>

      {/* Contact + Address */}
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-3xl border bg-white p-6">
          <div className="text-lg font-bold text-gray-900">Contact</div>

          {contact ? (
            <div className="mt-3 text-sm text-gray-700 space-y-1">
              <div className="font-semibold text-gray-900">{contact?.name || "—"}</div>
              <div>{contact?.phone || "—"}</div>
              {contact?.email ? <div>{contact.email}</div> : <div className="text-gray-500">—</div>}
            </div>
          ) : (
            <div className="mt-3 text-sm text-gray-600">—</div>
          )}
        </div>

        <div className="rounded-3xl border bg-white p-6">
          <div className="text-lg font-bold text-gray-900">Delivery address</div>

          {ship ? (
            <div className="mt-3 text-sm text-gray-700">
              <div className="font-semibold text-gray-900">{ship.fullName}</div>
              <div className="mt-1">
                {ship.addressLine1}
                {ship.addressLine2 ? `, ${ship.addressLine2}` : ""}
                {ship.landmark ? `, ${ship.landmark}` : ""}
              </div>
              <div className="mt-1">
                {ship.city}, {ship.state} - {ship.pincode}
              </div>
              <div className="mt-2 font-semibold">Mobile: {ship.phone}</div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-gray-600">No address found.</div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 rounded-3xl border bg-white p-6">
        <div className="text-lg font-bold text-gray-900">Order summary</div>

        <div className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">MRP Total</span>
            <span className="font-semibold text-gray-900">{money(mrpTotal)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal (before offer)</span>
            <span className="font-semibold text-gray-900">{money(subtotalBeforeOffer)}</span>
          </div>

          {offerDiscount > 0 ? (
            <div className="flex justify-between">
              <span className="text-gray-600">Offer Discount</span>
              <span className="font-semibold text-emerald-700">-{money(offerDiscount)}</span>
            </div>
          ) : null}

          <div className="flex justify-between">
            <span className="text-gray-600">You save</span>
            <span className="font-semibold text-emerald-700">{money(totalSavings)}</span>
          </div>

          <div className="h-px bg-gray-200" />

          <div className="flex justify-between text-base">
            <span className="font-bold text-gray-900">Payable</span>
            <span className="font-bold text-gray-900">{money(payable)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
