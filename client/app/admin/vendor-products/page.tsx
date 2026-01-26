/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

const resolveImageUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const apiBase = API_BASE || "";
  const host = apiBase.replace(/\/api\/?$/, "");
  if (path.startsWith("/")) return `${host}${path}`;
  return `${host}/${path}`;
};

// ✅ BACKEND SHAPE (Product.vendorId populated, ship is embedded object)
type VendorLite = {
  _id: string;
  name?: { first?: string; last?: string };
  email?: string; // vendor personal
  phone?: string;
  status?: string;
  company?: {
    name?: string; // ✅ company name is here
    email?: string; // ✅ company email is here
    gst?: string;
  };
};

type CategoryLite = { _id: string; name: string; slug: string };

type ShipLite = {
  lengthCm?: number;
  breadthCm?: number;
  heightCm?: number;
  weightKg?: number;
};

type ProductRow = {
  _id: string;
  productId?: string;
  title: string;
  slug: string;
  featureImage?: string;

  totalStock?: number;
  isLowStock?: boolean;
  isActive?: boolean;

  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  approvalNote?: string;

  createdAt?: string;

  // ✅ IMPORTANT: backend uses vendorId (ref Vendor)
  vendorId?: VendorLite | string | null;

  category?: CategoryLite | string | null;
  subCategory?: CategoryLite | string | null;

  mrp?: number;
  salePrice?: number;

  // ✅ ship embedded
  ship?: ShipLite;
};

function badgeClass(status?: string) {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "REJECTED") return "bg-red-50 text-red-700 border-red-200";
  if (s === "PENDING") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function fmtDate(v?: any) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("en-IN");
  } catch {
    return "—";
  }
}

export default function AdminVendorProductsPage() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ProductRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [status, setStatus] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<"ALL" | "true" | "false">("ALL");
  const [lowStock, setLowStock] = useState<"ALL" | "true" | "false">("ALL");

  const getToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("admin_token");
  };

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (status !== "ALL") sp.set("status", status);
    if (q.trim()) sp.set("q", q.trim());
    if (active !== "ALL") sp.set("active", active);
    if (lowStock !== "ALL") sp.set("lowStock", lowStock);
    return sp.toString();
  }, [status, q, active, lowStock]);

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error("Admin token missing. Login again.");

      // GET /api/admin/vendor-products?status=&q=&active=&lowStock=
      const res = await fetch(`${API_BASE}/admin/vendor-products?${queryString}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to load vendor products");

      setItems(json?.data || []);
    } catch (e: any) {
      setError(e?.message || "Error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Vendor Products</h1>
            <p className="text-sm text-slate-600 mt-1">
              Review vendor-submitted products and approve or reject them.
            </p>
          </div>

          <button
            onClick={fetchList}
            className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 px-4 py-2 rounded-lg text-sm font-medium"
          >
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            {/* Status Tabs */}
            <div className="flex flex-wrap gap-2">
              {(["ALL","PENDING", "APPROVED", "REJECTED", ] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={[
                    "px-3 py-1.5 rounded-lg text-sm font-medium border",
                    status === s
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              {/* Search */}
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search title / slug / productId..."
                className="w-full sm:w-72 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-900"
              />

              {/* Active */}
              <select
                value={active}
                onChange={(e) => setActive(e.target.value as any)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none"
              >
                <option value="ALL">Active: All</option>
                <option value="true">Active: Yes</option>
                <option value="false">Active: No</option>
              </select>

              {/* Low stock */}
              <select
                value={lowStock}
                onChange={(e) => setLowStock(e.target.value as any)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none"
              >
                <option value="ALL">Low stock: All</option>
                <option value="true">Low stock: Yes</option>
                <option value="false">Low stock: No</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="mt-4 border border-red-200 bg-red-50 text-red-800 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Product
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Vendor
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Category
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Stock
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Shipment
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Approval
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Created
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={8}>
                      Loading...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={8}>
                      No vendor products found.
                    </td>
                  </tr>
                ) : (
                  items.map((p) => {
                    const vendorObj =
                      typeof p.vendorId === "object" && p.vendorId ? (p.vendorId as VendorLite) : null;

                    const categoryObj =
                      typeof p.category === "object" && p.category ? (p.category as CategoryLite) : null;

                    const subCategoryObj =
                      typeof p.subCategory === "object" && p.subCategory ? (p.subCategory as CategoryLite) : null;

                    const companyName =
                      vendorObj?.company?.name ||
                      (vendorObj?.name ? `${vendorObj?.name?.first || ""} ${vendorObj?.name?.last || ""}`.trim() : "") ||
                      "—";

                    const companyEmail = vendorObj?.company?.email || vendorObj?.email || "—";

                    return (
                      <tr key={p._id} className="hover:bg-slate-50">
                        {/* Product */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
                              {p.featureImage ? (
                                <img
                                  src={resolveImageUrl(p.featureImage)}
                                  alt={p.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                                  No Image
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">{p.title}</div>
                              <div className="text-xs text-slate-600 truncate">
                                {p.productId ? `${p.productId} • ` : ""}
                                {p.slug}
                              </div>
                              {(typeof p.salePrice === "number" || typeof p.mrp === "number") && (
                                <div className="text-xs text-slate-700">
                                  ₹{Number(p.salePrice ?? 0)}
                                  <span className="text-slate-400 line-through ml-2">₹{Number(p.mrp ?? 0)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Vendor */}
                        <td className="px-4 py-3">
                          {vendorObj ? (
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 truncate">{companyName}</div>
                              <div className="text-xs text-slate-600 truncate">
                                {companyEmail}
                                {vendorObj.phone ? ` • ${vendorObj.phone}` : ""}
                              </div>
                              {vendorObj.status ? (
                                <div className="text-[11px] text-slate-500">Status: {vendorObj.status}</div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Category */}
                        <td className="px-4 py-3">
                          <div className="text-slate-900">{categoryObj?.name || "—"}</div>
                          <div className="text-xs text-slate-600">{subCategoryObj?.name || ""}</div>
                        </td>

                        {/* Stock */}
                        <td className="px-4 py-3">
                          <div className="text-slate-900">{Number(p.totalStock ?? 0)}</div>
                          {p.isLowStock ? (
                            <div className="text-xs text-amber-700">Low stock</div>
                          ) : (
                            <div className="text-xs text-slate-500">—</div>
                          )}
                        </td>

                        {/* Shipment */}
                        <td className="px-4 py-3 text-xs text-slate-700">
                          <div>
                            L×B×H:{" "}
                            <span className="font-semibold">
                              {p.ship?.lengthCm ?? "-"}×{p.ship?.breadthCm ?? "-"}×{p.ship?.heightCm ?? "-"} cm
                            </span>
                          </div>
                          <div>
                            Weight: <span className="font-semibold">{p.ship?.weightKg ?? "-"} kg</span>
                          </div>
                        </td>

                        {/* Approval */}
                        <td className="px-4 py-3">
                          <span
                            className={[
                              "inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold border",
                              badgeClass(p.approvalStatus),
                            ].join(" ")}
                          >
                            {p.approvalStatus || "—"}
                          </span>
                          {p.approvalStatus === "REJECTED" && p.approvalNote ? (
                            <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                              Note: {p.approvalNote}
                            </div>
                          ) : null}
                        </td>

                        {/* Created */}
                        <td className="px-4 py-3 text-slate-700">{fmtDate(p.createdAt)}</td>

                        {/* Action */}
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/admin/vendor-products/${p._id}`}
                            className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-300 bg-white hover:bg-slate-50"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-4">Tip: Default tab PENDING रखा है ताकि approval queue तुरंत दिखे।</p>
      </div>
    </div>
  );
}
