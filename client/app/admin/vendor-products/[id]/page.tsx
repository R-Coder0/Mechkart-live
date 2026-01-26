/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

const resolveImageUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const apiBase = API_BASE || "";
  const host = apiBase.replace(/\/api\/?$/, "");
  if (path.startsWith("/")) return `${host}${path}`;
  return `${host}/${path}`;
};

function badgeClass(status?: string) {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "REJECTED") return "bg-red-50 text-red-700 border-red-200";
  if (s === "PENDING") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function money(n: any) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return "—";
  return `₹${Math.round(x)}`;
}

function fmtDate(v?: any) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("en-IN");
  } catch {
    return "—";
  }
}

/**
 * ✅ Backend shape alignment:
 * - product has vendorId (ref Vendor) not vendor
 * - vendor has company.name / company.email (not companyName)
 * - product has ship {lengthCm,breadthCm,heightCm,weightKg} (not shipLengthCm etc.)
 * - reject reason is stored in approvalNote (per your Product model)
 */
type VendorLite = {
  _id: string;
  name?: { first?: string; last?: string };
  email?: string;
  phone?: string;
  status?: string;
  company?: {
    name?: string;
    email?: string;
    gst?: string;
  };
};

type ShipLite = {
  lengthCm?: number;
  breadthCm?: number;
  heightCm?: number;
  weightKg?: number;
};

export default function AdminVendorProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // reject modal
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const getToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("admin_token");
  };

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error("Admin token missing. Login again.");

      // GET /api/admin/vendor-products/:id
      const res = await fetch(`${API_BASE}/admin/vendor-products/${id}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to load product");

      setData(json?.data || null);
    } catch (e: any) {
      setError(e?.message || "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const approvalStatus = String(data?.approvalStatus || "").toUpperCase();

  // ✅ vendor is under vendorId
  const vendor: VendorLite | null =
    data?.vendorId && typeof data.vendorId === "object" ? (data.vendorId as VendorLite) : null;

  const companyName =
    vendor?.company?.name ||
    (vendor?.name ? `${vendor?.name?.first || ""} ${vendor?.name?.last || ""}`.trim() : "") ||
    "—";

  const companyEmail = vendor?.company?.email || vendor?.email || "—";
  const vendorPhone = vendor?.phone || "—";

  const ship: ShipLite | null = data?.ship && typeof data.ship === "object" ? (data.ship as ShipLite) : null;

  const colors = useMemo(() => (Array.isArray(data?.colors) ? data.colors : []), [data]);
  const variants = useMemo(() => (Array.isArray(data?.variants) ? data.variants : []), [data]);
  const gallery = useMemo(() => (Array.isArray(data?.galleryImages) ? data.galleryImages : []), [data]);

  const approve = async () => {
    setSaving(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error("Admin token missing. Login again.");

      // POST /api/admin/vendor-products/:id/approve
      const res = await fetch(`${API_BASE}/admin/vendor-products/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Approve failed");

      await fetchDetails();
    } catch (e: any) {
      setError(e?.message || "Approve error");
    } finally {
      setSaving(false);
    }
  };

  const reject = async () => {
    setSaving(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error("Admin token missing. Login again.");

      // POST /api/admin/vendor-products/:id/reject { reason }
      const res = await fetch(`${API_BASE}/admin/vendor-products/${id}/reject`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: rejectReason.trim() || "Rejected by admin" }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Reject failed");

      setShowReject(false);
      setRejectReason("");
      await fetchDetails();
    } catch (e: any) {
      setError(e?.message || "Reject error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Top bar */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/admin/vendor-products" className="text-sm text-slate-700 hover:text-slate-900 underline">
                ← Back
              </Link>

              <span
                className={[
                  "inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold border",
                  badgeClass(approvalStatus),
                ].join(" ")}
              >
                {approvalStatus || "—"}
              </span>
            </div>

            <h1 className="text-2xl font-semibold text-slate-900 mt-2">
              {data?.title || (loading ? "Loading..." : "—")}
            </h1>

            <p className="text-sm text-slate-600 mt-1">
              {data?.productId ? `${data.productId} • ` : ""}
              {data?.slug || ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchDetails}
              className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Refresh
            </button>

            <button
              onClick={() => router.push("/admin/vendor-products")}
              className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 border border-red-200 bg-red-50 text-red-800 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {/* Content */}
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6">Loading...</div>
        ) : !data ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6">Product not found.</div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Product summary */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
                  <h2 className="text-sm font-semibold text-slate-800">Product Details</h2>
                </div>
                <div className="p-6 grid sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500">Category</div>
                    <div className="text-sm font-medium text-slate-900">{data?.category?.name || "—"}</div>
                    <div className="text-xs text-slate-600 mt-1">Sub: {data?.subCategory?.name || "—"}</div>
                  </div>

                  <div>
                    <div className="text-xs text-slate-500">Pricing</div>
                    <div className="text-sm font-medium text-slate-900">
                      {money(data?.salePrice)} <span className="text-xs text-slate-500">sale</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">MRP: {money(data?.mrp)}</div>
                  </div>

                  <div>
                    <div className="text-xs text-slate-500">Stock</div>
                    <div className="text-sm font-medium text-slate-900">Total: {Number(data?.totalStock ?? 0)}</div>
                    <div className="text-xs text-slate-600 mt-1">
                      Threshold: {Number(data?.lowStockThreshold ?? 5)}{" "}
                      {data?.isLowStock ? (
                        <span className="ml-2 text-amber-700 font-semibold">Low</span>
                      ) : (
                        <span className="ml-2 text-slate-500">OK</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-slate-500">Meta</div>
                    <div className="text-xs text-slate-700 mt-1">Created: {fmtDate(data?.createdAt)}</div>
                    <div className="text-xs text-slate-700 mt-1">Active: {String(data?.isActive ?? true)}</div>
                  </div>

                  {data?.description ? (
                    <div className="sm:col-span-2 mt-2">
                      <div className="text-xs text-slate-500">Description</div>
                      <div className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{data.description}</div>
                    </div>
                  ) : null}

                  {data?.features ? (
                    <div className="sm:col-span-2 mt-2">
                      <div className="text-xs text-slate-500">Features</div>
                      <div className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{data.features}</div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Shipping */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
                  <h2 className="text-sm font-semibold text-slate-800">Shipping</h2>
                </div>
                <div className="p-6 grid sm:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-slate-500">Length (cm)</div>
                    <div className="text-sm font-medium text-slate-900">{ship?.lengthCm ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Breadth (cm)</div>
                    <div className="text-sm font-medium text-slate-900">{ship?.breadthCm ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Height (cm)</div>
                    <div className="text-sm font-medium text-slate-900">{ship?.heightCm ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Weight (kg)</div>
                    <div className="text-sm font-medium text-slate-900">{ship?.weightKg ?? "—"}</div>
                  </div>
                </div>
              </div>

              {/* Media */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
                  <h2 className="text-sm font-semibold text-slate-800">Media</h2>
                </div>
                <div className="p-6 space-y-5">
                  {/* feature image */}
                  <div>
                    <div className="text-xs text-slate-500 mb-2">Feature Image</div>
                    {data?.featureImage ? (
                      <img
                        src={resolveImageUrl(data.featureImage)}
                        alt="feature"
                        className="w-full max-w-xl rounded-xl border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="text-sm text-slate-600">—</div>
                    )}
                  </div>

                  {/* gallery */}
                  <div>
                    <div className="text-xs text-slate-500 mb-2">Gallery</div>
                    {gallery.length ? (
                      <div className="flex flex-wrap gap-2">
                        {gallery.map((g: string, idx: number) => (
                          <img
                            key={idx}
                            src={resolveImageUrl(g)}
                            alt={`g-${idx}`}
                            className="w-24 h-24 rounded-lg border border-slate-200 object-cover"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-600">—</div>
                    )}
                  </div>

                  {/* colors */}
                  <div>
                    <div className="text-xs text-slate-500 mb-2">Colors</div>
                    {colors.length ? (
                      <div className="space-y-4">
                        {colors.map((c: any, idx: number) => (
                          <div key={c?._id || idx} className="border border-slate-200 rounded-xl p-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold text-slate-900">
                                {c?.name || "Color"}
                                {c?.hex ? <span className="text-xs text-slate-500"> • {c.hex}</span> : null}
                              </div>
                              <div className="text-xs text-slate-500">orderIndex: {c?.orderIndex ?? idx}</div>
                            </div>

                            {Array.isArray(c?.images) && c.images.length ? (
                              <div className="flex flex-wrap gap-2 mt-3">
                                {c.images.map((img: string, j: number) => (
                                  <img
                                    key={j}
                                    src={resolveImageUrl(img)}
                                    alt={`c-${idx}-${j}`}
                                    className="w-20 h-20 rounded-lg border border-slate-200 object-cover"
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-600 mt-2">No color images</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-600">—</div>
                    )}
                  </div>

                  {/* variants */}
                  <div>
                    <div className="text-xs text-slate-500 mb-2">Variants</div>
                    {variants.length ? (
                      <div className="space-y-4">
                        {variants.map((v: any, idx: number) => (
                          <div key={v?._id || idx} className="border border-slate-200 rounded-xl p-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="text-sm font-semibold text-slate-900">
                                {v?.label || v?.size || v?.weight || v?.comboText || `Variant ${idx + 1}`}
                              </div>
                              <div className="text-xs text-slate-600">
                                MRP: {money(v?.mrp)} • Sale: {money(v?.salePrice)} • Qty: {Number(v?.quantity ?? 0)}
                              </div>
                            </div>

                            {Array.isArray(v?.images) && v.images.length ? (
                              <div className="flex flex-wrap gap-2 mt-3">
                                {v.images.map((img: string, j: number) => (
                                  <img
                                    key={j}
                                    src={resolveImageUrl(img)}
                                    alt={`v-${idx}-${j}`}
                                    className="w-20 h-20 rounded-lg border border-slate-200 object-cover"
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-600 mt-2">No variant images</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-600">—</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Vendor card */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
                  <h2 className="text-sm font-semibold text-slate-800">Vendor</h2>
                </div>
                <div className="p-6">
                  {vendor ? (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-slate-900">{companyName}</div>

                      <div className="text-xs text-slate-600">
                        {companyEmail} {vendorPhone !== "—" ? `• ${vendorPhone}` : ""}
                      </div>

                      <div className="text-xs text-slate-600">
                        Status: <span className="font-semibold">{vendor.status || "—"}</span>
                      </div>

                      {vendor.company?.gst ? (
                        <div className="text-xs text-slate-600">
                          GST: <span className="font-semibold">{vendor.company.gst}</span>
                        </div>
                      ) : null}

                      <div className="text-xs text-slate-500 mt-2">Vendor ID: {vendor._id}</div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-600">—</div>
                  )}
                </div>
              </div>

              {/* Approval actions */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
                  <h2 className="text-sm font-semibold text-slate-800">Approval</h2>
                </div>

                <div className="p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500">Current status</div>
                    <span
                      className={[
                        "inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold border",
                        badgeClass(approvalStatus),
                      ].join(" ")}
                    >
                      {approvalStatus || "—"}
                    </span>
                  </div>

                  {/* ✅ Reject reason in approvalNote */}
                  {approvalStatus === "REJECTED" && data?.approvalNote ? (
                    <div className="border border-red-200 bg-red-50 text-red-800 rounded-lg p-3 text-sm">
                      <div className="text-xs font-semibold mb-1">Reject reason</div>
                      <div className="whitespace-pre-wrap">{data.approvalNote}</div>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={approve}
                      disabled={saving || approvalStatus === "APPROVED"}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm font-semibold"
                    >
                      {saving ? "Processing..." : approvalStatus === "APPROVED" ? "Approved" : "Approve"}
                    </button>

                    <button
                      onClick={() => setShowReject(true)}
                      disabled={saving || approvalStatus === "REJECTED"}
                      className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm font-semibold"
                    >
                      {saving ? "Processing..." : approvalStatus === "REJECTED" ? "Rejected" : "Reject"}
                    </button>

                    <p className="text-xs text-slate-500">
                      Approve will publish vendor product (approvalStatus=APPROVED).
                      Reject will keep it hidden and store reason in approvalNote.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Reject modal */}
            {showReject ? (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
                <div className="bg-white w-full max-w-lg rounded-xl shadow-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
                    <div className="text-sm font-semibold text-slate-900">Reject Product</div>
                    <div className="text-xs text-slate-600 mt-1">Provide a reason. Vendor will see it.</div>
                  </div>

                  <div className="p-5 space-y-3">
                    <textarea
                      rows={5}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-900"
                      placeholder="Reason (e.g. wrong category, missing images, invalid pricing...)"
                    />

                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setShowReject(false);
                          setRejectReason("");
                        }}
                        disabled={saving}
                        className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 px-4 py-2 rounded-lg text-sm font-medium"
                      >
                        Cancel
                      </button>

                      <button
                        onClick={reject}
                        disabled={saving}
                        className="bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold"
                      >
                        {saving ? "Rejecting..." : "Confirm Reject"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
