/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { vendorMe, vendorDashboardStats } from "@/lib/vendorApi";

function Card({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="border rounded p-4">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub ? <div className="text-xs text-gray-500 mt-1">{sub}</div> : null}
    </div>
  );
}

export default function VendorDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const run = async () => {
      setErr("");
      setLoading(true);

      try {
        // These endpoints are optional. If not available yet,
        // dashboard will still render with placeholders.
        try {
          const my = await vendorMe();
          setMe(my);
        } catch {
          setMe(null);
        }

        try {
          const st = await vendorDashboardStats();
          setStats(st);
        } catch {
          setStats(null);
        }
      } catch (e: any) {
        setErr(e?.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-gray-600">
            Welcome{me?.name?.first ? `, ${me.name.first}` : ""}. Manage your store activity here.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/vendor/products"
            className="px-3 py-2 rounded bg-black text-white text-sm"
          >
            Add / Manage Products
          </Link>
          <Link
            href="/vendor/orders"
            className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
          >
            View Orders
          </Link>
        </div>
      </div>

      {err ? (
        <div className="mt-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card
          title="Total Orders"
          value={String(stats?.totalOrders ?? "—")}
          sub="All time"
        />
        <Card
          title="Pending Orders"
          value={String(stats?.pendingOrders ?? "—")}
          sub="Need action"
        />
        <Card
          title="Products"
          value={String(stats?.totalProducts ?? "—")}
          sub="Active listings"
        />
        <Card
          title="Revenue"
          value={stats?.revenue ? `₹${Math.round(stats.revenue)}` : "—"}
          sub="Delivered orders"
        />
      </div>

      <div className="mt-6 border rounded p-4">
        <div className="font-semibold">Quick Actions</div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Link href="/vendor/profile" className="border rounded p-3 hover:bg-gray-50">
            <div className="font-medium">Complete Profile</div>
            <div className="text-sm text-gray-600">Pickup address, bank/UPI, KYC details</div>
          </Link>

          <Link href="/vendor/products" className="border rounded p-3 hover:bg-gray-50">
            <div className="font-medium">Add Products</div>
            <div className="text-sm text-gray-600">Create new product listings</div>
          </Link>

          <Link href="/vendor/orders" className="border rounded p-3 hover:bg-gray-50">
            <div className="font-medium">Process Orders</div>
            <div className="text-sm text-gray-600">View orders, packing, shipment status</div>
          </Link>

          <div className="border rounded p-3 bg-gray-50">
            <div className="font-medium">Shipments</div>
            <div className="text-sm text-gray-600">
              Shipment creation will be enabled when vendor shipment flow is connected.
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-gray-600">Loading dashboard...</div>
      ) : null}
    </div>
  );
}
