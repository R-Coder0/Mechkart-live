/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  adminApproveVendor,
  adminGetVendor,
  adminListVendors,
  adminRejectVendor,
    adminDeleteVendor,
  adminDisableVendor,
  adminEnableVendor,
  type VendorStatus,
} from "@/lib/adminVendorsApi";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

function resolveFileUrl(p?: string) {
  if (!p) return "";
  if (p.startsWith("http://") || p.startsWith("https://")) return p;

  // normalize windows slashes
  let path = String(p).replace(/\\/g, "/");

  // if it contains "/uploads/", keep from there
  const idx = path.toLowerCase().lastIndexOf("/uploads/");
  if (idx >= 0) path = path.slice(idx);

  // handle "server/uploads/..." or "server/uploads\..."
  if (path.toLowerCase().startsWith("server/uploads/")) {
    path = path.slice("server".length); // => "/uploads/..."
  }

  // handle "uploads/..." (missing leading slash)
  if (path.toLowerCase().startsWith("uploads/")) {
    path = `/${path}`;
  }

  // ensure leading slash
  if (!path.startsWith("/")) path = `/${path}`;

  const host = API_BASE.replace(/\/api\/?$/, "");
  return `${host}${path}`;
}

function badgeClass(status: VendorStatus) {
  if (status === "PENDING") return "bg-yellow-100 text-yellow-800";
  if (status === "APPROVED") return "bg-green-100 text-green-800";
  if (status === "REJECTED") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800"; // DISABLED
}

function fmt(v?: any) {
  if (v === undefined || v === null || v === "") return "—";
  return String(v);
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="text-sm">
      <div className="text-gray-500">{label}</div>
      <div className="font-medium wrap-break-word">{value ?? "—"}</div>
    </div>
  );
}

export default function AdminVendorsPage() {
  const [tab, setTab] = useState<VendorStatus | "ALL">("PENDING");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState<number>(0);

  // reject modal (pending list quick reject)
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectVendorId, setRejectVendorId] = useState<string>("");
  const [rejectReason, setRejectReason] = useState<string>("");

  // ✅ view modal
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewErr, setViewErr] = useState("");
  const [viewVendor, setViewVendor] = useState<any>(null);
  const [viewRejectReason, setViewRejectReason] = useState("");

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((total || 0) / limit));
  }, [total, limit]);

  function normalizeListResponse(json: any) {
    if (json && Array.isArray(json.items)) {
      return { items: json.items, total: Number(json.total ?? json.items.length ?? 0) };
    }
    if (json?.data && Array.isArray(json.data.items)) {
      return { items: json.data.items, total: Number(json.data.total ?? json.data.items.length ?? 0) };
    }
    if (Array.isArray(json)) {
      return { items: json, total: json.length };
    }
    return { items: [], total: 0 };
  }

  async function load(p = page, search = q, st = tab) {
    setLoading(true);
    setErr("");
    try {
      const json = await adminListVendors({ status: st, q: search, page: p, limit });
      const { items, total } = normalizeListResponse(json);
      setRows(items);
      setTotal(total);
    } catch (e: any) {
      setErr(e.message || "Failed to load vendors");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(page, q, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page]);

  const onSearch = async () => {
    setPage(1);
    await load(1, q, tab);
  };

  const doApprove = async (vendorId: string) => {
    if (!confirm("Approve this vendor?")) return;
    try {
      await adminApproveVendor(vendorId);
      await load(page, q, tab);
      if (viewOpen && viewVendor?._id === vendorId) await openView(vendorId);
      alert("Vendor approved");
    } catch (e: any) {
      alert(e.message || "Approve failed");
    }
  };
const doDisable = async (vendorId: string) => {
  const reason = prompt("Disable reason (optional):") || "Disabled by admin";
  if (!confirm("Disable this vendor?")) return;
  try {
    await adminDisableVendor(vendorId, reason);
    await load(page, q, tab);
    if (viewOpen && viewVendor?._id === vendorId) await openView(vendorId);
    alert("Vendor disabled");
  } catch (e: any) {
    alert(e.message || "Disable failed");
  }
};

const doEnable = async (vendorId: string) => {
  if (!confirm("Enable this vendor?")) return;
  try {
    await adminEnableVendor(vendorId);
    await load(page, q, tab);
    if (viewOpen && viewVendor?._id === vendorId) await openView(vendorId);
    alert("Vendor enabled");
  } catch (e: any) {
    alert(e.message || "Enable failed");
  }
};

const doDelete = async (vendorId: string) => {
  if (!confirm("⚠️ Permanent delete. Continue?")) return;
  if (!confirm("Last confirm: This cannot be undone.")) return;
  try {
    await adminDeleteVendor(vendorId);
    await load(page, q, tab);
    if (viewOpen && viewVendor?._id === vendorId) {
      setViewOpen(false);
      setViewVendor(null);
    }
    alert("Vendor deleted");
  } catch (e: any) {
    alert(e.message || "Delete failed");
  }
};
  const openReject = (vendorId: string) => {
    setRejectVendorId(vendorId);
    setRejectReason("");
    setRejectOpen(true);
  };

  const doReject = async () => {
    if (!rejectReason.trim()) return alert("Reject reason is required");
    try {
      await adminRejectVendor(rejectVendorId, rejectReason.trim());
      setRejectOpen(false);
      await load(page, q, tab);
      alert("Vendor rejected");
    } catch (e: any) {
      alert(e.message || "Reject failed");
    }
  };

  // ✅ View modal open + fetch details
  const openView = async (vendorId: string) => {
    setViewOpen(true);
    setViewLoading(true);
    setViewErr("");
    setViewVendor(null);
    setViewRejectReason("");

    try {
      const json = await adminGetVendor(vendorId);
      const v = json?.data || json; // supports both shapes
      setViewVendor(v);
      setViewRejectReason("");
    } catch (e: any) {
      setViewErr(e.message || "Failed to load vendor");
    } finally {
      setViewLoading(false);
    }
  };

  const doRejectFromView = async () => {
    if (!viewVendor?._id) return;
    if (!viewRejectReason.trim()) return alert("Reject reason required");
    if (!confirm("Reject this vendor?")) return;

    try {
      await adminRejectVendor(viewVendor._id, viewRejectReason.trim());
      await load(page, q, tab);
      await openView(viewVendor._id);
      alert("Vendor rejected");
    } catch (e: any) {
      alert(e.message || "Reject failed");
    }
  };

  const doApproveFromView = async () => {
    if (!viewVendor?._id) return;
    await doApprove(viewVendor._id);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Vendors</h1>
          <p className="text-sm text-gray-600">Manage vendor requests and approved vendors.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(["PENDING", "APPROVED", "REJECTED", "DISABLED", "ALL"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
            className={`px-3 py-2 rounded border text-sm ${
              tab === t ? "bg-black text-white border-black" : "bg-white text-black border-gray-300"
            }`}
          >
            {t === "ALL" ? "All Vendors" : t}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mt-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by vendor name / email / phone"
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <button onClick={onSearch} className="px-4 py-2 rounded bg-black text-white text-sm">
          Search
        </button>
      </div>

      {err && (
        <div className="mt-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Table */}
      <div className="mt-4 border rounded overflow-x-auto bg-white">
        <table className="min-w-[1000px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-3">Vendor</th>
              <th className="p-3">Contact</th>
              <th className="p-3">Company</th>
              <th className="p-3">Status</th>
              <th className="p-3">Created</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td className="p-3" colSpan={6}>
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="p-3" colSpan={6}>
                  No vendors found.
                </td>
              </tr>
            ) : (
              rows.map((v: any) => {
                const status: VendorStatus = (v?.status || "PENDING") as VendorStatus;
                const name = `${fmt(v?.name?.first)} ${fmt(v?.name?.last)}`.trim();

                return (
                  <tr key={v?._id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{name || "—"}</div>
                      <div className="text-gray-600">{fmt(v?.email)}</div>
                    </td>

                    <td className="p-3">
                      <div>{fmt(v?.phone)}</div>
                      <div className="text-gray-600">UPI: {fmt(v?.payment?.upiId)}</div>
                    </td>

                    <td className="p-3">
                      <div className="font-medium">{fmt(v?.company?.name)}</div>
                      <div className="text-gray-600">{fmt(v?.company?.email)}</div>
                    </td>

                    <td className="p-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded text-xs font-medium ${badgeClass(status)}`}
                      >
                        {status}
                      </span>
                      {status === "REJECTED" && v?.rejectReason ? (
                        <div className="text-xs text-gray-600 mt-1">Reason: {v.rejectReason}</div>
                      ) : null}
                    </td>

                    <td className="p-3">
                      {v?.createdAt ? new Date(v.createdAt).toLocaleString("en-IN") : "—"}
                    </td>

                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
  <button
    onClick={() => openView(v?._id)}
    className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50"
  >
    View
  </button>

  {status === "PENDING" ? (
    <>
      <button
        onClick={() => doApprove(v?._id)}
        className="px-3 py-1.5 rounded bg-green-600 text-white text-sm"
      >
        Approve
      </button>
      <button
        onClick={() => openReject(v?._id)}
        className="px-3 py-1.5 rounded bg-red-600 text-white text-sm"
      >
        Reject
      </button>
      <button
        onClick={() => doDelete(v?._id)}
        className="px-3 py-1.5 rounded bg-red-800 text-white text-sm"
      >
        Delete
      </button>
    </>
  ) : null}

  {status === "APPROVED" ? (
    <>
      <button
        onClick={() => doDisable(v?._id)}
        className="px-3 py-1.5 rounded bg-gray-800 text-white text-sm"
      >
        Disable
      </button>
      <button
        onClick={() => doDelete(v?._id)}
        className="px-3 py-1.5 rounded bg-red-800 text-white text-sm"
      >
        Delete
      </button>
    </>
  ) : null}

  {status === "DISABLED" ? (
    <>
      <button
        onClick={() => doEnable(v?._id)}
        className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm"
      >
        Enable
      </button>
      <button
        onClick={() => doDelete(v?._id)}
        className="px-3 py-1.5 rounded bg-red-800 text-white text-sm"
      >
        Delete
      </button>
    </>
  ) : null}

  {status === "REJECTED" ? (
    <button
      onClick={() => doDelete(v?._id)}
      className="px-3 py-1.5 rounded bg-red-800 text-white text-sm"
    >
      Delete
    </button>
  ) : null}
</div>

                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <div>
          Page {page} of {totalPages} • Total: {total}
        </div>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-2 rounded border disabled:opacity-50"
          >
            Prev
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-2 rounded border disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Reject Modal (quick reject) */}
      {rejectOpen ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded p-4">
            <div className="text-lg font-semibold">Reject Vendor</div>
            <p className="text-sm text-gray-600 mt-1">
              Reject reason will be emailed to vendor and visible to them.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="mt-3 w-full border rounded p-2 text-sm"
              placeholder="Enter reject reason..."
            />

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRejectOpen(false)} className="px-4 py-2 rounded border">
                Cancel
              </button>
              <button onClick={doReject} className="px-4 py-2 rounded bg-red-600 text-white">
                Reject
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ✅ View Modal */}
      {viewOpen ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-4xl bg-white rounded p-4 md:p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Vendor Details</div>
                {viewVendor ? (
                  <div className="text-sm text-gray-600">
                    {viewVendor?.name?.first} {viewVendor?.name?.last} • {viewVendor?.email}
                  </div>
                ) : null}
              </div>

              <button
                onClick={() => {
                  setViewOpen(false);
                  setViewVendor(null);
                  setViewErr("");
                }}
                className="px-3 py-2 rounded border"
              >
                Close
              </button>
            </div>

            {viewLoading ? <div className="mt-4">Loading...</div> : null}
            {viewErr ? <div className="mt-4 text-red-600 text-sm">{viewErr}</div> : null}

            {!viewLoading && viewVendor ? (
              <>
                <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
                  <div className="text-sm">
                    Status:{" "}
                    <span
                      className={`inline-flex px-2 py-1 rounded text-xs font-medium ${badgeClass(
                        (viewVendor?.status || "PENDING") as VendorStatus
                      )}`}
                    >
                      {viewVendor?.status}
                    </span>
                    {viewVendor?.status === "REJECTED" && viewVendor?.rejectReason ? (
                      <span className="ml-2 text-xs text-gray-600">
                        Reason: {viewVendor.rejectReason}
                      </span>
                    ) : null}
                  </div>
                  

                  {viewVendor?.status === "PENDING" ? (
                    <div className="flex gap-2">
                      <button
                        onClick={doApproveFromView}
                        className="px-4 py-2 rounded bg-green-600 text-white text-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={doRejectFromView}
                        className="px-4 py-2 rounded bg-red-600 text-white text-sm"
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 grid md:grid-cols-2 gap-4">
                  <div className="border rounded p-4">
                    <div className="font-semibold mb-3">Company</div>
                    <div className="grid gap-3">
                      <Field label="Company Name" value={viewVendor?.company?.name} />
                      <Field label="Company Email" value={viewVendor?.company?.email} />
                      <Field label="GST" value={viewVendor?.company?.gst || "—"} />
                    </div>
                  </div>

                  <div className="border rounded p-4">
                    <div className="font-semibold mb-3">Pickup Address</div>
                    <div className="grid gap-3">
                      <Field label="Pickup Name" value={viewVendor?.pickupAddress?.name} />
                      <Field label="Pickup Phone" value={viewVendor?.pickupAddress?.phone} />
                      <Field label="Address" value={viewVendor?.pickupAddress?.address} />
                      <div className="grid grid-cols-3 gap-2">
                        <Field label="City" value={viewVendor?.pickupAddress?.city} />
                        <Field label="State" value={viewVendor?.pickupAddress?.state} />
                        <Field label="Pincode" value={viewVendor?.pickupAddress?.pincode} />
                      </div>
                    </div>
                  </div>

                  <div className="border rounded p-4">
                    <div className="font-semibold mb-3">KYC</div>
                    <div className="grid gap-3">
                      <Field label="PAN Number" value={viewVendor?.kyc?.panNumber} />
                      <div className="text-sm">
                        <div className="text-gray-500">PAN Image</div>
                        {viewVendor?.kyc?.panImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolveFileUrl(viewVendor.kyc.panImage)}
                            alt="PAN"
                            className="mt-2 max-h-64 rounded border"
                          />
                        ) : (
                          <div className="font-medium">—</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border rounded p-4">
                    <div className="font-semibold mb-3">Payment</div>
                    <div className="grid gap-3">
                      <Field label="UPI ID" value={viewVendor?.payment?.upiId || "—"} />
                      <Field label="Bank Account" value={viewVendor?.payment?.bankAccount || "—"} />
                      <Field label="IFSC" value={viewVendor?.payment?.ifsc || "—"} />
                      <div className="text-sm">
                        <div className="text-gray-500">QR Image</div>
                        {viewVendor?.payment?.qrImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolveFileUrl(viewVendor.payment.qrImage)}
                            alt="QR"
                            className="mt-2 max-h-64 rounded border"
                          />
                        ) : (
                          <div className="font-medium">—</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {viewVendor?.status === "PENDING" ? (
                  <div className="mt-6 border rounded p-4">
                    <div className="font-semibold">Reject Reason</div>
                    <p className="text-sm text-gray-600 mt-1">
                      If you reject, this reason will be emailed to vendor.
                    </p>
                    <textarea
                      value={viewRejectReason}
                      onChange={(e) => setViewRejectReason(e.target.value)}
                      rows={3}
                      className="mt-3 w-full border rounded p-2 text-sm"
                      placeholder="Enter reason (required for reject)"
                    />
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
