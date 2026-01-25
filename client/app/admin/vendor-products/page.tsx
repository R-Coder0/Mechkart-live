/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

const resolveImageUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const host = (API_BASE || "").replace(/\/api\/?$/, "");
  return path.startsWith("/") ? `${host}${path}` : `${host}/${path}`;
};

type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

interface VendorRef {
  _id: string;
  companyName?: string;
  email?: string;
  phone?: string;
}

interface CategoryRef {
  _id: string;
  name: string;
  slug?: string;
}

interface Variant {
  _id: string;
  quantity: number;
  mrp: number;
  salePrice: number;
}

interface VendorProduct {
  _id: string;
  productId: string;
  title: string;
  slug: string;
  featureImage?: string;
  mrp: number;
  salePrice: number;
  baseStock?: number;
  lowStockThreshold?: number;
  variants?: Variant[];
  shipLengthCm?: number;
  shipBreadthCm?: number;
  shipHeightCm?: number;
  shipWeightKg?: number;
  approvalStatus: ApprovalStatus;
  isActive: boolean;
  vendor?: VendorRef;
  category?: CategoryRef;
  subCategory?: CategoryRef | null;
  createdAt: string;
}

export default function AdminVendorProductsPage() {
  const [items, setItems] = useState<VendorProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [status, setStatus] = useState<ApprovalStatus>("PENDING");
  const [q, setQ] = useState("");
  const [vendorId, setVendorId] = useState("");

  // reject modal
  const [rejecting, setRejecting] = useState<VendorProduct | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const getAdminToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("admin_token");
  };

  const getTotalStock = (p: VendorProduct) => {
    if (p.variants && p.variants.length > 0) {
      return p.variants.reduce((sum, v) => sum + (v.quantity || 0), 0);
    }
    return p.baseStock || 0;
  };

  const isLowStock = (p: VendorProduct) => {
    const total = getTotalStock(p);
    const limit = p.lowStockThreshold ?? 5;
    return total <= limit;
  };

  const fetchVendorProducts = async () => {
    try {
      setLoading(true);
      setErr(null);

      const token = getAdminToken();
      if (!token) {
        setErr("Admin token not found. Please login again.");
        return;
      }

      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      if (vendorId.trim()) params.set("vendorId", vendorId.trim());

      const res = await fetch(`${API_BASE}/admin/vendor-products?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load vendor products");

      setItems(data.data || []);
    } catch (e: any) {
      setErr(e.message || "Error loading vendor products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendorProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return items;
    return items.filter((p) => p.title.toLowerCase().includes(s) || p.slug.toLowerCase().includes(s) || p.productId.toLowerCase().includes(s));
  }, [items, q]);

  const approve = async (id: string) => {
    try {
      const token = getAdminToken();
      if (!token) return setErr("Admin token not found. Please login again.");
      setActingId(id);

      const res = await fetch(`${API_BASE}/admin/vendor-products/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Approve failed");

      // update UI
      setItems((prev) => prev.map((x) => (x._id === id ? { ...x, approvalStatus: "APPROVED", isActive: true } : x)));
    } catch (e: any) {
      setErr(e.message || "Approve error");
    } finally {
      setActingId(null);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    try {
      const token = getAdminToken();
      if (!token) return setErr("Admin token not found. Please login again.");
      setActingId(rejecting._id);

      const res = await fetch(`${API_BASE}/admin/vendor-products/${rejecting._id}/reject`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: rejectReason || "Rejected by admin" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Reject failed");

      setItems((prev) => prev.map((x) => (x._id === rejecting._id ? { ...x, approvalStatus: "REJECTED", isActive: false } : x)));
      setRejecting(null);
      setRejectReason("");
    } catch (e: any) {
      setErr(e.message || "Reject error");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Vendor Products</h1>
            <p className="text-sm text-slate-500">Review vendor submissions, verify shipment details, approve/reject.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ApprovalStatus)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title / slug / productId"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white w-full sm:w-72"
            />

            <button
              type="button"
              onClick={fetchVendorProducts}
              className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-semibold"
            >
              Refresh
            </button>
          </div>
        </div>

        {err && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-3 border-b bg-slate-50 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-800">List</div>
            <div className="text-xs text-slate-500">
              Total: <span className="font-semibold text-slate-800">{filtered.length}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Product</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Vendor</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Shipment</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Stock</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Approval</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 bg-white">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      Loading...
                    </td>
                  </tr>
                )}

                {!loading &&
                  filtered.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-50">
                      {/* product */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-md border border-gray-200 overflow-hidden bg-slate-100 shrink-0">
                            {p.featureImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={resolveImageUrl(p.featureImage)} alt={p.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">No Image</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 line-clamp-2">{p.title}</div>
                            <div className="text-[11px] text-slate-500 break-all">{p.slug}</div>
                            <div className="text-[11px] text-slate-500">
                              ID: <span className="font-medium">{p.productId}</span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Cat: <span className="font-medium">{p.category?.name || "-"}</span>
                              {p.subCategory?.name ? ` | Sub: ${p.subCategory.name}` : ""}
                            </div>
                            <div className="text-[11px] text-slate-600">
                              ₹{p.salePrice} <span className="line-through text-slate-400">₹{p.mrp}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* vendor */}
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-slate-900">{p.vendor?.companyName || "-"}</div>
                        <div className="text-[11px] text-slate-500 break-all">{p.vendor?.email || ""}</div>
                        <div className="text-[11px] text-slate-500">{p.vendor?.phone || ""}</div>
                      </td>

                      {/* shipment */}
                      <td className="px-4 py-3 text-xs text-slate-700">
                        <div>
                          L×B×H:{" "}
                          <span className="font-semibold">
                            {p.shipLengthCm ?? "-"}×{p.shipBreadthCm ?? "-"}×{p.shipHeightCm ?? "-"} cm
                          </span>
                        </div>
                        <div>
                          Weight: <span className="font-semibold">{p.shipWeightKg ?? "-"} kg</span>
                        </div>
                      </td>

                      {/* stock */}
                      <td className="px-4 py-3 text-xs">
                        <span className="font-semibold text-slate-900">{getTotalStock(p)}</span>
                        {isLowStock(p) && <span className="ml-2 text-[11px] text-red-600 font-semibold">Low</span>}
                      </td>

                      {/* approval */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            p.approvalStatus === "PENDING"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : p.approvalStatus === "APPROVED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {p.approvalStatus}
                        </span>
                      </td>

                      {/* actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={actingId === p._id || p.approvalStatus === "APPROVED"}
                            onClick={() => approve(p._id)}
                            className="px-2.5 py-1.5 text-xs rounded-md border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                          >
                            {actingId === p._id ? "Working..." : "Approve"}
                          </button>

                          <button
                            type="button"
                            disabled={actingId === p._id || p.approvalStatus === "REJECTED"}
                            onClick={() => {
                              setRejecting(p);
                              setRejectReason("");
                            }}
                            className="px-2.5 py-1.5 text-xs rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reject modal */}
        {rejecting && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md border border-gray-200 shadow-lg">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Reject Product</div>
                <button
                  type="button"
                  onClick={() => setRejecting(null)}
                  className="p-2 rounded-full hover:bg-slate-100"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="p-4 space-y-2">
                <div className="text-sm font-medium text-slate-800">{rejecting.title}</div>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="Reason (optional)"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRejecting(null)}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={reject}
                    disabled={actingId === rejecting._id}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {actingId === rejecting._id ? "Rejecting..." : "Confirm Reject"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
