/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
export const dynamic = "force-dynamic";

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

export default function OrderSuccessPage() {
  const sp = useSearchParams();

  // ✅ keep using orderId for API + invoice
  const orderId = useMemo(() => sp.get("orderId") || "", [sp]);

  // ✅ show orderCode to user (nice readable)
  const orderCodeFromQuery = useMemo(() => sp.get("orderCode") || "", [sp]);

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      } catch (e: any) {
        setError(e?.message || "Failed to load order");
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const orderCode = order?.orderCode || orderCodeFromQuery || "";

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
            <Link className="rounded-2xl border px-4 py-3 text-sm font-semibold" href="/website">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const items = order?.items || [];
  const totals = order?.totals || {};
  const total = totals?.subtotal ?? order?.totalAmount ?? 0;

  // ✅ Your createCodOrder saves `address`
  const ship = order?.address || order?.addressSnapshot || order?.shippingAddress || null;
  const contact = order?.contact || null;

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Header card */}
      <div className="rounded-3xl border bg-white p-8">
        <div className="text-2xl font-bold text-gray-900">Order placed successfully</div>

        <div className="mt-3 flex flex-col gap-2 text-sm text-gray-600">
          {/* ✅ show order code to user */}
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

          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <div>
              Status:{" "}
              <span className="font-semibold text-gray-900">{order?.status || "PLACED"}</span>
            </div>
            <div>
              Payment:{" "}
              <span className="font-semibold text-gray-900">{order?.paymentMethod || "COD"}</span>{" "}
              <span className="text-gray-500">({order?.paymentStatus || "PENDING"})</span>
            </div>
            <div>
              Total: <span className="font-semibold text-gray-900">{money(total)}</span>
            </div>
          </div>

          {/* ✅ internal id hidden; only for debugging if needed */}
          {/* <div className="text-xs text-gray-400">Internal ID: {orderId}</div> */}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
            href="/website"
          >
            Continue shopping
          </Link>

          {/* ✅ invoice still uses orderId */}
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
            href="/website/orders"
          >
            View my orders
          </Link>
        </div>
      </div>

      {/* Items */}
      <div className="mt-6 rounded-3xl border bg-white p-6">
        <div className="text-lg font-bold text-gray-900">Items</div>

        <div className="mt-4 space-y-4">
          {items.map((it: any, idx: number) => {
            const title = String(it?.title || "Product");
            const code = String(it?.productCode || "NA"); // ✅ product custom code CH000001 etc
            const qty = Number(it?.qty || 1);
            const price = Number(it?.salePrice || 0);
            const lineTotal = price * qty;

            const img = resolveImageUrl(it?.image || "");

            return (
              <div key={idx} className="flex gap-4 border-b pb-4 last:border-b-0 last:pb-0">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gray-50">
                  <img src={img} alt={title} className="h-full w-full object-cover" />
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{title}</div>
                      <div className="mt-0.5 text-[11px] font-semibold text-gray-500">
                        Product Code: {code}
                      </div>

                      <div className="mt-1 text-xs text-gray-500">
                        Qty: {qty}
                        {it?.colorKey ? ` • Color: ${it.colorKey}` : ""}
                        {it?.variantId ? ` • Variant: ${String(it.variantId).slice(-6)}` : ""}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">{money(lineTotal)}</div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {money(price)} × {qty}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {!items.length ? (
            <div className="rounded-2xl border bg-gray-50 p-4 text-sm text-gray-700">
              No items found in this order.
            </div>
          ) : null}
        </div>
      </div>

      {/* Contact + Address */}
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Contact */}
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

        {/* Address */}
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
            <span className="text-gray-600">Subtotal</span>
            <span className="font-semibold text-gray-900">{money(totals.subtotal ?? total)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600">MRP Total</span>
            <span className="font-semibold text-gray-900">{money(totals.mrpTotal ?? 0)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600">You save</span>
            <span className="font-semibold text-emerald-700">{money(totals.savings ?? 0)}</span>
          </div>

          <div className="h-px bg-gray-200" />

          <div className="flex justify-between text-base">
            <span className="font-bold text-gray-900">Total</span>
            <span className="font-bold text-gray-900">{money(totals.subtotal ?? total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
