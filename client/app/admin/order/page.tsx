/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminFetchOrders, adminUpdateOrderStatus } from "@/lib/adminOrdersApi";

function money(n: number) {
  return `₹${Math.round(Number(n || 0))}`;
}

const STATUS_OPTIONS = ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

export default function AdminOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");

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
      const resp = await adminFetchOrders({ q, status, paymentMethod, page: nextPage, limit });
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

  const onChangeStatus = async (orderId: string, nextStatus: string) => {
    try {
      setBusyId(orderId);
      setError(null);

      // optimistic UI
      setData((prev: any) => ({
        ...prev,
        items: (prev.items || []).map((o: any) => (String(o._id) === String(orderId) ? { ...o, status: nextStatus } : o)),
      }));

      const updated = await adminUpdateOrderStatus(orderId, nextStatus);

      // reconcile with server response (optional)
      setData((prev: any) => ({
        ...prev,
        items: (prev.items || []).map((o: any) => (String(o._id) === String(orderId) ? updated : o)),
      }));
    } catch (e: any) {
      setError(e?.message || "Status update failed");
      // reload to revert optimistic changes
      await load(page);
    } finally {
      setBusyId(null);
    }
  };

  const summaryText = useMemo(() => {
    const total = Number(data?.total || 0);
    return `${total} order(s)`;
  }, [data?.total]);

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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search order code / name / phone"
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
        <div className="border-b bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-900">
          Orders
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : items.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-white">
                <tr className="border-b text-left text-xs font-bold text-gray-600">
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Items</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>

              <tbody>
                {items.map((o: any) => {
                  
                  const orderCode = o?.orderCode || "—";
                  const customerName = o?.contact?.name || "—";
                  const phone = o?.contact?.phone || "—";
                  const count = (o?.items || []).length;
                  const vText = getVariantText(orderCode, o.variantId);
                  const total = o?.totals?.subtotal ?? o?.totalAmount ?? 0;
                  const pay = `${o?.paymentMethod || "COD"} (${o?.paymentStatus || "PENDING"})`;
                  const created = o?.createdAt ? new Date(o.createdAt).toLocaleString("en-IN") : "—";

                  return (
                    <tr key={String(o._id)} className="border-b last:border-b-0">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-gray-900">{orderCode}</div>
                        <div className="text-[11px] text-gray-500">Internal: {String(o._id).slice(-8)}</div>
                      </td>

                      <td className="px-5 py-3">
                        <div className="font-semibold text-gray-900">{customerName}</div>
                        <div className="text-[11px] text-gray-500">{phone}</div>
                      </td>
<td className="px-5 py-3">
  <div className="space-y-2">
    {(o.items || []).slice(0, 2).map((it: any, idx: number) => {
      // ✅ populated product object
      const product = it?.productId;
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
                        <div className="font-semibold text-gray-900">{money(total)}</div>
                      </td>

                      <td className="px-5 py-3">
                        <div className="text-gray-900">{pay}</div>
                      </td>

                      <td className="px-5 py-3">
                        <select
                          value={String(o?.status || "PLACED")}
                          disabled={busyId === String(o._id)}
                          onChange={(e) => onChangeStatus(String(o._id), e.target.value)}
                          className="h-10 rounded-xl border px-3 text-sm outline-none focus:border-gray-400 bg-white disabled:opacity-60"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        {busyId === String(o._id) ? (
                          <div className="mt-1 text-[11px] text-gray-500">Updating…</div>
                        ) : null}
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
