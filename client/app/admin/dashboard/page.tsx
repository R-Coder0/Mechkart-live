/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { type ComponentType, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  IndianRupee,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
  Store,
  Users,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { apiGet } from "@/lib/api/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;
const ORDER_STATUSES = ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];
const PAYMENT_STATUSES = ["PENDING", "COD_PENDING_CONFIRMATION", "PAID", "FAILED"];

function money(value: any) {
  const amount = Math.round(Number(value || 0));
  return `₹ ${amount.toLocaleString("en-IN")}`;
}

function count(value: any) {
  return Number(value || 0).toLocaleString("en-IN");
}

function fmtDateTime(value?: any) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function toneForStatus(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "PAID" || s === "DELIVERED") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "FAILED" || s === "CANCELLED") return "bg-red-50 text-red-700 border-red-200";
  if (s === "SHIPPED" || s === "CONFIRMED") return "bg-blue-50 text-blue-700 border-blue-200";
  if (s === "COD_PENDING_CONFIRMATION" || s === "PLACED" || s === "PENDING") {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  return "bg-gray-50 text-gray-700 border-gray-200";
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneForStatus(value)}`}>
      {value}
    </span>
  );
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="gap-4 rounded-lg border bg-white py-5 shadow-sm">
      <CardHeader className="flex-row items-center justify-between gap-3 px-5">
        <CardTitle className="text-sm font-semibold text-gray-600">{title}</CardTitle>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-gray-50 text-gray-700">
          <Icon className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent className="px-5">
        <div className="text-3xl font-extrabold tracking-normal text-gray-950">{value}</div>
        {sub ? <div className="mt-1 text-xs font-medium text-gray-500">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

function CountRow({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.max(4, Math.round((value / total) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-gray-700">{label}</span>
        <span className="font-bold text-gray-950">{count(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100">
        <div className="h-2 rounded-full bg-gray-900" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet(`${API_BASE}/admin/stats`);
      setStats(data?.data ?? data);
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const weeklyRevenueChart = useMemo(() => {
    const list = Array.isArray(stats?.weeklyRevenue) ? stats.weeklyRevenue : [];
    return list.map((item: any) => ({
      day: item?.day || item?._id || "-",
      revenue: Number(item?.total || 0),
      orders: Number(item?.orders || 0),
    }));
  }, [stats?.weeklyRevenue]);

  const orderCounts = stats?.orderStatusCounts || {};
  const paymentCounts = stats?.paymentStatusCounts || {};
  const lowStock = Array.isArray(stats?.lowStock) ? stats.lowStock : [];
  const latestOrders = Array.isArray(stats?.latestOrders) ? stats.latestOrders : [];
  const totalOrders = Number(stats?.totalOrders || 0);

  if (loading && !stats) {
    return (
      <div className="mx-auto max-w-[1700px] px-4 py-8">
        <div className="space-y-4">
          <div className="h-8 w-56 animate-pulse rounded bg-gray-100" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-lg border bg-gray-50" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1700px] px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-950">Dashboard</h1>
          <p className="text-sm text-gray-600">Live admin overview</p>
        </div>

        <button
          type="button"
          onClick={fetchStats}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Paid Revenue" value={money(stats?.totalRevenue)} sub={`${count(stats?.paidOrders)} paid orders`} icon={IndianRupee} />
        <StatCard title="Today Revenue" value={money(stats?.todayRevenue)} sub={`${count(stats?.todayOrders)} orders today`} icon={PackageCheck} />
        <StatCard title="Total Orders" value={count(stats?.totalOrders)} sub={`${count(orderCounts.PLACED)} placed`} icon={ShoppingCart} />
        <StatCard title="Users" value={count(stats?.totalUsers)} sub="Registered customers" icon={Users} />
        <StatCard title="Vendors" value={count(stats?.totalVendors)} sub={`${count(stats?.pendingVendors)} pending approval`} icon={Store} />
        <StatCard title="Products" value={count(stats?.totalProducts)} sub={`${count(stats?.activeProducts)} active approved`} icon={Boxes} />
        <StatCard title="Vendor Products" value={count(stats?.pendingVendorProducts)} sub="Pending approval" icon={PackageCheck} />
        <StatCard title="Low Stock" value={count(lowStock.length)} sub="Products at threshold" icon={AlertTriangle} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.8fr)]">
        <Card className="rounded-lg border bg-white py-5 shadow-sm">
          <CardHeader className="px-5">
            <CardTitle className="text-base font-bold text-gray-950">Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-80 px-2 sm:px-5">
            {weeklyRevenueChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyRevenueChart} margin={{ left: 8, right: 18, top: 10, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <Tooltip
                    formatter={(value: any, name: string) => (name === "revenue" ? [money(value), "Revenue"] : [value, "Orders"])}
                    labelStyle={{ fontWeight: 700 }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#111827" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-medium text-gray-500">No revenue yet</div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg border bg-white py-5 shadow-sm">
          <CardHeader className="px-5">
            <CardTitle className="text-base font-bold text-gray-950">Order Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-5">
            {ORDER_STATUSES.map((status) => (
              <CountRow key={status} label={status} value={Number(orderCounts[status] || 0)} total={totalOrders} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="rounded-lg border bg-white py-5 shadow-sm">
          <CardHeader className="flex-row items-center justify-between gap-3 px-5">
            <CardTitle className="text-base font-bold text-gray-950">Latest Orders</CardTitle>
            <Link href="/admin/order" className="text-sm font-semibold text-blue-700 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="px-0">
            {latestOrders.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-sm">
                  <thead>
                    <tr className="border-y bg-gray-50 text-left text-xs font-bold uppercase text-gray-500">
                      <th className="px-5 py-3">Order</th>
                      <th className="px-5 py-3">Customer</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Payment</th>
                      <th className="px-5 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestOrders.map((order: any) => (
                      <tr key={String(order?._id || order?.orderCode)} className="border-b last:border-b-0">
                        <td className="px-5 py-3 font-bold text-gray-950">{order?.orderCode || "-"}</td>
                        <td className="px-5 py-3">
                          <div className="font-semibold text-gray-800">{order?.contact?.name || "-"}</div>
                          <div className="text-xs text-gray-500">{order?.contact?.phone || "-"}</div>
                        </td>
                        <td className="px-5 py-3 font-bold text-gray-950">{money(order?.totals?.grandTotal)}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <StatusBadge value={String(order?.paymentMethod || "-")} />
                            <StatusBadge value={String(order?.paymentStatus || "-")} />
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-600">{fmtDateTime(order?.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 py-8 text-sm font-medium text-gray-500">No orders yet</div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4">
          <Card className="rounded-lg border bg-white py-5 shadow-sm">
            <CardHeader className="px-5">
              <CardTitle className="text-base font-bold text-gray-950">Payment Status</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 px-5 sm:grid-cols-2">
              {PAYMENT_STATUSES.map((status) => (
                <div key={status} className="rounded-lg border bg-gray-50 p-4">
                  <div className="text-xs font-bold uppercase text-gray-500">{status}</div>
                  <div className="mt-2 text-2xl font-extrabold text-gray-950">{count(paymentCounts[status])}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-lg border bg-white py-5 shadow-sm">
            <CardHeader className="px-5">
              <CardTitle className="text-base font-bold text-gray-950">Low Stock Products</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {lowStock.length ? (
                <div className="divide-y">
                  {lowStock.map((item: any) => (
                    <div key={String(item?._id || item?.productId)} className="flex items-center justify-between gap-4 px-5 py-3">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-gray-950">{item?.title || item?.productId || "-"}</div>
                        <div className="text-xs text-gray-500">
                          {item?.productId || "-"} - {item?.ownerType || "ADMIN"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-gray-950">{count(item?.totalStock)}</div>
                        <div className="text-xs font-medium text-gray-500">Threshold {count(item?.lowStockThreshold)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-8 text-sm font-medium text-gray-500">No low-stock products</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
