/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/immutability */
"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api/api";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const data = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats`);
      setStats(data.data);
    } catch (err) {
      console.log("Stats Error:", err);
    }
  }

  if (!stats) return <p className="p-6">Loading stats...</p>;

  const weeklyRevenueChart = stats.weeklyRevenue.map((w: any) => ({
    day: "Day " + w._id,
    revenue: w.total,
  }));

  return (
    <div className="p-8 space-y-10">

      {/* PAGE HEADING */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600">Admin Overview</p>
      </div>

      {/* TOP 4 STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <Card className="border">
          <CardHeader>
            <CardTitle>Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{stats.totalUsers}</p>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader>
            <CardTitle>Total Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{stats.totalVendors}</p>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader>
            <CardTitle>Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{stats.totalProducts}</p>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader>
            <CardTitle>Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{stats.totalOrders}</p>
          </CardContent>
        </Card>

      </div>

      {/* REVENUE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <Card className="border">
          <CardHeader>
            <CardTitle>Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">${stats.totalRevenue}</p>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader>
            <CardTitle>Today Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">${stats.todayRevenue}</p>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader>
            <CardTitle>Low Stock Products</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{stats.lowStock.length}</p>
          </CardContent>
        </Card>

      </div>

      {/* WEEKLY REVENUE GRAPH */}
      <Card className="border">
        <CardHeader>
          <CardTitle>Weekly Revenue (Chart)</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {weeklyRevenueChart.length === 0 ? (
            <p className="text-gray-500">No revenue data available</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyRevenueChart}>
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <CartesianGrid strokeDasharray="3 3" />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* LOW STOCK TABLE */}
      <Card className="border">
        <CardHeader>
          <CardTitle>Low Stock Products</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.lowStock.length === 0 ? (
            <p className="text-gray-500">No low-stock products</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left text-gray-600">Product</th>
                  <th className="p-2 text-left text-gray-600">Stock</th>
                </tr>
              </thead>
              <tbody>
                {stats.lowStock.map((item: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{item.name}</td>
                    <td className="p-2">{item.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
