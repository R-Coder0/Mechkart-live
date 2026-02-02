/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

// ✅ Admin token helper
const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
};

// ✅ Standard Bearer header
const authHeaders = (): Record<string, string> => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};


function money(n: any) {
  const x = Number(n || 0);
  return `₹${Math.round(Number.isFinite(x) ? x : 0)}`;
}

function fmtDateTime(v?: any) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("en-IN");
  } catch {
    return "—";
  }
}

function badgeClass(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "AVAILABLE") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "HOLD") return "bg-amber-50 text-amber-700 border-amber-200";
  if (s === "PAID") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (s === "FAILED") return "bg-red-50 text-red-700 border-red-200";
  if (s === "REVERSED") return "bg-gray-50 text-gray-700 border-gray-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

function typeLabel(t: string) {
  const x = String(t || "").toUpperCase();
  switch (x) {
    case "DELIVERED_HOLD_CREDIT":
      return "Delivered → Hold Credit";
    case "HOLD_TO_AVAILABLE":
      return "Hold → Available (Unlocked)";
    case "PAYOUT_RELEASED":
      return "Payout Released";
    case "PAYOUT_FAILED":
      return "Payout Failed";
    case "CANCEL_DEDUCT":
      return "Cancelled → Deduct";
    case "RETURN_DEDUCT":
      return "Return → Deduct";
    case "ADJUSTMENT":
      return "Adjustment";
    default:
      return x;
  }
}

// -------------------- API helpers (Admin) --------------------
// Backend routes (as per your server):
// GET    /api/admin/wallet/vendor-wallet?q=&page=&limit=
// GET    /api/admin/wallet/vendor/:vendorId?q=&type=&status=&page=&limit=
// POST   /api/admin/wallet/unlock?limit=100
// POST   /api/admin/wallet/payout/release   { vendorId, amount, method, reference, note }
// POST   /api/admin/wallet/payout/failed    { vendorId, amount, method, reference, reason }

async function adminFetchVendors(params: { q?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  qs.set("page", String(params.page || 1));
  qs.set("limit", String(params.limit || 20));

  const res = await fetch(`${API_BASE}/admin/wallet/vendor-wallet?${qs.toString()}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      ...authHeaders(),
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Failed to load vendors");
  return json?.data ?? json;
}

async function adminFetchVendorWallet(
  vendorId: string,
  params: { q?: string; type?: string; status?: string; page?: number; limit?: number }
) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.type) qs.set("type", params.type);
  if (params.status) qs.set("status", params.status);
  qs.set("page", String(params.page || 1));
  qs.set("limit", String(params.limit || 20));

  const res = await fetch(`${API_BASE}/admin/wallet/vendor/${vendorId}?${qs.toString()}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      ...authHeaders(),
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Failed to load wallet");
  return json?.data ?? json;
}

async function adminRunUnlock(limit = 100) {
  const res = await fetch(`${API_BASE}/admin/wallet/unlock?limit=${limit}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      ...authHeaders(),
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Unlock failed");
  return json?.data ?? json;
}

async function adminReleasePayout(payload: {
  vendorId: string;
  amount: number;
  method: "UPI" | "BANK" | "MANUAL";
  reference?: string;
  note?: string;
}) {
  const res = await fetch(`${API_BASE}/admin/wallet/payout/release`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Payout release failed");
  return json?.data ?? json;
}

async function adminFailPayout(payload: {
  vendorId: string;
  amount: number;
  method: "UPI" | "BANK" | "MANUAL";
  reference?: string;
  reason?: string;
}) {
  // ✅ FIXED route: /failed (as per backend)
  const res = await fetch(`${API_BASE}/admin/wallet/payout/failed`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Payout fail log failed");
  return json?.data ?? json;
}

type ModalState =
  | { open: false }
  | {
      open: true;
      vendor: any;
      wallet: any;
      txns: any[];
    };

const TYPE_OPTIONS = [
  "",
  "DELIVERED_HOLD_CREDIT",
  "HOLD_TO_AVAILABLE",
  "PAYOUT_RELEASED",
  "PAYOUT_FAILED",
  "CANCEL_DEDUCT",
  "RETURN_DEDUCT",
  "ADJUSTMENT",
];

const STATUS_OPTIONS = ["", "HOLD", "AVAILABLE", "PAID", "REVERSED", "FAILED"];

export default function AdminWalletPage() {
  // Left: vendors
  const [vLoading, setVLoading] = useState(true);
  const [vError, setVError] = useState<string | null>(null);
  const [vq, setVq] = useState("");
  const [vPage, setVPage] = useState(1);
  const vLimit = 15;

  const [vendorsData, setVendorsData] = useState<any>({
    items: [],
    page: 1,
    limit: vLimit,
    total: 0,
    totalPages: 1,
  });

  const vendors = Array.isArray(vendorsData?.items) ? vendorsData.items : [];
  const vTotalPages = Number(vendorsData?.totalPages || 1);

  // Selected vendor
  const [selectedVendor, setSelectedVendor] = useState<any | null>(null);

  // Right: vendor wallet
  const [wLoading, setWLoading] = useState(false);
  const [wError, setWError] = useState<string | null>(null);
  const [wq, setWq] = useState("");
  const [wType, setWType] = useState("");
  const [wStatus, setWStatus] = useState("");
  const [wPage, setWPage] = useState(1);
  const wLimit = 20;

  const [walletData, setWalletData] = useState<any>({
    vendorId: "",
    balances: { hold: 0, available: 0, paid: 0 },
    items: [],
    page: 1,
    limit: wLimit,
    total: 0,
    totalPages: 1,
  });

  const txns = useMemo(() => {
    if (Array.isArray(walletData?.items)) return walletData.items;
    if (Array.isArray(walletData?.transactions)) return walletData.transactions;
    return [];
  }, [walletData]);

  const wTotalPages = Number(walletData?.totalPages || 1);

  // Modals / Actions
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ open: false });

  const loadVendors = async (nextPage = 1) => {
    try {
      setVLoading(true);
      setVError(null);

      // ✅ token guard (optional but helpful)
      if (!getToken()) throw new Error("Admin token missing. Please login again.");

      const resp = await adminFetchVendors({ q: vq, page: nextPage, limit: vLimit });
      setVendorsData(resp);
      setVPage(resp.page || nextPage);

      // auto-select first vendor if none selected
      const list = Array.isArray(resp?.items) ? resp.items : [];
      if (!selectedVendor && list.length) setSelectedVendor(list[0]);
    } catch (e: any) {
      setVError(e?.message || "Failed to load vendors");
    } finally {
      setVLoading(false);
    }
  };

  const loadWallet = async (vendor: any, nextPage = 1) => {
    if (!vendor?._id) return;
    try {
      setWLoading(true);
      setWError(null);

      if (!getToken()) throw new Error("Admin token missing. Please login again.");

      const resp = await adminFetchVendorWallet(String(vendor._id), {
        q: wq,
        type: wType,
        status: wStatus,
        page: nextPage,
        limit: wLimit,
      });

      setWalletData(resp);
      setWPage(resp.page || nextPage);
    } catch (e: any) {
      setWError(e?.message || "Failed to load wallet");
    } finally {
      setWLoading(false);
    }
  };

  useEffect(() => {
    loadVendors(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedVendor?._id) return;
    loadWallet(selectedVendor, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendor?._id]);

  const vendorsSummary = useMemo(() => {
    const total = Number(vendorsData?.total || 0);
    return `${total} vendor(s)`;
  }, [vendorsData?.total]);

  const walletBalances = walletData?.balances || { hold: 0, available: 0, paid: 0 };

  const onRunUnlock = async () => {
    try {
      setBusy("unlock");
      if (!getToken()) throw new Error("Admin token missing. Please login again.");

      const raw = prompt("Unlock limit? (default 100)") || "";
      const lim = raw.trim() ? Number(raw.trim()) : 100;
      const limit = Number.isFinite(lim) && lim > 0 ? lim : 100;

      await adminRunUnlock(limit);

      if (selectedVendor?._id) await loadWallet(selectedVendor, 1);
      await loadVendors(vPage);
      alert("Unlock job executed");
    } catch (e: any) {
      alert(e?.message || "Unlock failed");
    } finally {
      setBusy(null);
    }
  };

  const onReleasePayout = async () => {
    if (!selectedVendor?._id) return;
    try {
      setBusy("payout");
      if (!getToken()) throw new Error("Admin token missing. Please login again.");

      const amountRaw = prompt("Payout amount (RUPEES) from AVAILABLE?") || "";
      const amt = Number(amountRaw.trim());
      if (!Number.isFinite(amt) || amt <= 0) return;

      const methodRaw = (prompt("Method? UPI / BANK / MANUAL", "UPI") || "UPI").toUpperCase();
      const method = (["UPI", "BANK", "MANUAL"].includes(methodRaw) ? methodRaw : "MANUAL") as any;

      const reference = prompt("Reference/UTR/TxnId (optional)") || "";
      const note = prompt("Note (optional)") || "";

      await adminReleasePayout({
        vendorId: String(selectedVendor._id),
        amount: amt,
        method,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });

      await loadWallet(selectedVendor, 1);
      await loadVendors(vPage);
      alert("Payout released");
    } catch (e: any) {
      alert(e?.message || "Payout release failed");
    } finally {
      setBusy(null);
    }
  };

  const onFailPayout = async () => {
    if (!selectedVendor?._id) return;
    try {
      setBusy("payout_fail");
      if (!getToken()) throw new Error("Admin token missing. Please login again.");

      const amountRaw = prompt("Failed payout amount (RUPEES)?") || "";
      const amt = Number(amountRaw.trim());
      if (!Number.isFinite(amt) || amt <= 0) return;

      const methodRaw = (prompt("Method? UPI / BANK / MANUAL", "UPI") || "UPI").toUpperCase();
      const method = (["UPI", "BANK", "MANUAL"].includes(methodRaw) ? methodRaw : "MANUAL") as any;

      const reference = prompt("Reference/UTR/TxnId (optional)") || "";
      const reason = prompt("Failure reason?") || "Failed";

      await adminFailPayout({
        vendorId: String(selectedVendor._id),
        amount: amt,
        method,
        reference: reference.trim() || undefined,
        reason: reason.trim() || undefined,
      });

      await loadWallet(selectedVendor, 1);
      alert("Payout failure logged");
    } catch (e: any) {
      alert(e?.message || "Payout fail log failed");
    } finally {
      setBusy(null);
    }
  };

  const openTxnModal = () => {
    if (!selectedVendor) return;
    setModal({
      open: true,
      vendor: selectedVendor,
      wallet: walletData,
      txns,
    });
  };

  const closeTxnModal = () => setModal({ open: false });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin · Vendor Wallets</h1>
          <p className="text-sm text-gray-600">{vendorsSummary}</p>
        </div>

        <div className="flex gap-2">
          <Link href="/admin" className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50">
            Admin Home
          </Link>

          <button
            disabled={busy === "unlock"}
            onClick={onRunUnlock}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
          >
            {busy === "unlock" ? "Running…" : "Run Unlock Job"}
          </button>
        </div>
      </div>

      {/* Layout */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT: Vendors */}
        <div className="lg:col-span-5">
          <div className="rounded-3xl border bg-white overflow-hidden">
            <div className="border-b bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-900">Vendors</div>

            <div className="p-4 border-b">
              <div className="flex gap-2">
                <input
                  value={vq}
                  onChange={(e) => setVq(e.target.value)}
                  placeholder="Search vendor name / phone / email"
                  className="h-11 flex-1 rounded-2xl border px-4 text-sm outline-none focus:border-gray-400"
                />
                <button
                  onClick={() => loadVendors(1)}
                  className="h-11 rounded-2xl bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-black"
                >
                  Search
                </button>
              </div>
              {vError ? (
                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {vError}
                </div>
              ) : null}
            </div>

            {vLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-2xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : vendors.length ? (
              <>
                <div className="divide-y">
                  {vendors.map((v: any) => {
                    const active = String(selectedVendor?._id || "") === String(v?._id || "");
                    const b = v?.wallet?.balances || v?.balances || { hold: 0, available: 0, paid: 0 };
                    return (
                      <button
                        key={String(v._id)}
                        onClick={() => setSelectedVendor(v)}
                        className={`w-full text-left px-4 py-4 hover:bg-gray-50 ${active ? "bg-emerald-50/40" : "bg-white"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 line-clamp-1">
                              {v?.name || v?.companyName || v?.vendorName || "Vendor"}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {v?.phone || v?.mobile || "—"} {v?.email ? `• ${v.email}` : ""}
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <div className="text-[11px] text-gray-500">Available</div>
                            <div className="font-extrabold text-gray-900">{money(b?.available)}</div>
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                          <div className="rounded-xl border bg-white px-3 py-2">
                            <div className="text-gray-500">Hold</div>
                            <div className="font-bold text-gray-900">{money(b?.hold)}</div>
                          </div>
                          <div className="rounded-xl border bg-white px-3 py-2">
                            <div className="text-gray-500">Available</div>
                            <div className="font-bold text-gray-900">{money(b?.available)}</div>
                          </div>
                          <div className="rounded-xl border bg-white px-3 py-2">
                            <div className="text-gray-500">Paid</div>
                            <div className="font-bold text-gray-900">{money(b?.paid)}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="border-t p-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Page <span className="font-semibold text-gray-900">{vPage}</span> /{" "}
                    <span className="font-semibold text-gray-900">{vTotalPages}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={vLoading || vPage <= 1}
                      onClick={() => loadVendors(vPage - 1)}
                      className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                    >
                      Prev
                    </button>
<button
  disabled={vLoading || vPage >= vTotalPages}
  onClick={() => loadVendors(vPage + 1)}
  className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
>
  Next
</button>

                  </div>
                </div>
              </>
            ) : (
              <div className="p-6 text-sm text-gray-600">No vendors found.</div>
            )}
          </div>
        </div>

        {/* RIGHT: Wallet */}
        <div className="lg:col-span-7">
          <div className="rounded-3xl border bg-white overflow-hidden">
            <div className="border-b bg-gray-50 px-5 py-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">
                Wallet {selectedVendor ? `• ${selectedVendor?.name || selectedVendor?.companyName || "Vendor"}` : ""}
              </div>

              <div className="flex gap-2">
                <button
                  disabled={!selectedVendor || busy === "payout"}
                  onClick={onReleasePayout}
                  className="h-9 rounded-xl bg-emerald-600 px-3 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy === "payout" ? "..." : "Release Payout"}
                </button>
                <button
                  disabled={!selectedVendor || busy === "payout_fail"}
                  onClick={onFailPayout}
                  className="h-9 rounded-xl bg-red-600 px-3 text-[12px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {busy === "payout_fail" ? "..." : "Log Payout Failed"}
                </button>
                <button
                  disabled={!selectedVendor}
                  onClick={() => loadWallet(selectedVendor, wPage)}
                  className="h-9 rounded-xl border px-3 text-[12px] font-semibold hover:bg-gray-50 disabled:opacity-60"
                >
                  Refresh
                </button>
              </div>
            </div>

            {!selectedVendor ? (
              <div className="p-6 text-sm text-gray-600">Select a vendor to view wallet.</div>
            ) : (
              <>
                {/* balances */}
                <div className="p-5 border-b">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-3xl border bg-white p-4">
                      <div className="text-sm font-semibold text-gray-700">Hold</div>
                      <div className="mt-2 text-2xl font-extrabold text-gray-900">{money(walletBalances.hold)}</div>
                      <div className="mt-1 text-[12px] text-gray-500">Locked (unlock due)</div>
                    </div>
                    <div className="rounded-3xl border bg-white p-4">
                      <div className="text-sm font-semibold text-gray-700">Available</div>
                      <div className="mt-2 text-2xl font-extrabold text-gray-900">{money(walletBalances.available)}</div>
                      <div className="mt-1 text-[12px] text-gray-500">Payout eligible</div>
                    </div>
                    <div className="rounded-3xl border bg-white p-4">
                      <div className="text-sm font-semibold text-gray-700">Paid</div>
                      <div className="mt-2 text-2xl font-extrabold text-gray-900">{money(walletBalances.paid)}</div>
                      <div className="mt-1 text-[12px] text-gray-500">Already released</div>
                    </div>
                  </div>
                </div>

                {/* filters */}
                <div className="p-4 border-b">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                    <input
                      value={wq}
                      onChange={(e) => setWq(e.target.value)}
                      placeholder="Search order code / note / reference"
                      className="h-11 rounded-2xl border px-4 text-sm outline-none focus:border-gray-400"
                    />

                    <select
                      value={wType}
                      onChange={(e) => setWType(e.target.value)}
                      className="h-11 rounded-2xl border px-4 text-sm outline-none focus:border-gray-400 bg-white"
                    >
                      <option value="">All Types</option>
                      {TYPE_OPTIONS.filter(Boolean).map((t) => (
                        <option key={t} value={t}>
                          {typeLabel(t)}
                        </option>
                      ))}
                    </select>

                    <select
                      value={wStatus}
                      onChange={(e) => setWStatus(e.target.value)}
                      className="h-11 rounded-2xl border px-4 text-sm outline-none focus:border-gray-400 bg-white"
                    >
                      <option value="">All Status</option>
                      {STATUS_OPTIONS.filter(Boolean).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => loadWallet(selectedVendor, 1)}
                      className="h-11 rounded-2xl bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-black"
                    >
                      Apply
                    </button>

                    <button
                      onClick={() => {
                        setWq("");
                        setWType("");
                        setWStatus("");
                        setTimeout(() => loadWallet(selectedVendor, 1), 0);
                      }}
                      className="h-11 rounded-2xl border px-4 text-sm font-semibold hover:bg-gray-50"
                    >
                      Clear
                    </button>
                  </div>

                  {wError ? (
                    <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                      {wError}
                    </div>
                  ) : null}
                </div>

                {/* tx table */}
                <div className="border-b">
                  {wLoading ? (
                    <div className="p-5 space-y-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-10 rounded-2xl bg-gray-100 animate-pulse" />
                      ))}
                    </div>
                  ) : txns.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-[1100px] w-full text-sm">
                        <thead className="bg-white">
                          <tr className="border-b text-left text-xs font-bold text-gray-600">
                            <th className="px-5 py-3">Date</th>
                            <th className="px-5 py-3">Type</th>
                            <th className="px-5 py-3">Order</th>
                            <th className="px-5 py-3">Amount</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Note</th>
                          </tr>
                        </thead>

                        <tbody>
                          {txns.slice(0, 10).map((t: any, idx: number) => {
                            const when = t?.effectiveAt || t?.createdAt || t?.updatedAt;
                            const st = String(t?.status || "").toUpperCase();
                            const dir = String(t?.direction || "").toUpperCase();
                            const amt = Number(t?.amount || 0);
                            const signed = dir === "DEBIT" ? -Math.abs(amt) : Math.abs(amt);
                            return (
                              <tr key={t?._id || t?.idempotencyKey || idx} className="border-b last:border-b-0">
                                <td className="px-5 py-3 text-gray-700">{fmtDateTime(when)}</td>

                                <td className="px-5 py-3">
                                  <div className="font-semibold text-gray-900">{typeLabel(t?.type || "")}</div>
                                  <div className="text-[11px] text-gray-500 font-mono">{String(t?.type || "")}</div>
                                </td>

                                <td className="px-5 py-3">
                                  <div className="font-semibold text-gray-900">{t?.orderCode || "—"}</div>
                                  {t?.subOrderId ? (
                                    <div className="text-[11px] text-gray-500">Sub: {String(t.subOrderId).slice(-8)}</div>
                                  ) : null}
                                </td>

                                <td className="px-5 py-3">
                                  <div className={`font-extrabold ${signed < 0 ? "text-red-700" : "text-emerald-700"}`}>
                                    {signed < 0 ? "-" : "+"}
                                    {money(Math.abs(signed))}
                                  </div>
                                  <div className="text-[11px] text-gray-500">{dir || "—"}</div>
                                </td>

                                <td className="px-5 py-3">
                                  <span
                                    className={`inline-flex rounded-xl border px-3 py-1 text-[12px] font-semibold ${badgeClass(st)}`}
                                  >
                                    {st || "—"}
                                  </span>
                                </td>

                                <td className="px-5 py-3">
                                  <div className="text-gray-800 text-[12px] line-clamp-2">{t?.note || "—"}</div>
                                  {t?.meta?.reference ? (
                                    <div className="text-[11px] text-gray-500">
                                      Ref: <span className="font-mono">{String(t.meta.reference)}</span>
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      <div className="p-4 border-t flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          Showing latest 10 •{" "}
                          <button onClick={openTxnModal} className="font-semibold text-gray-900 underline underline-offset-4">
                            View all
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <button
                            disabled={wLoading || wPage <= 1}
                            onClick={() => loadWallet(selectedVendor, wPage - 1)}
                            className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                          >
                            Prev
                          </button>
                          <button
                            disabled={wLoading || wPage >= wTotalPages}
                            onClick={() => loadWallet(selectedVendor, wPage + 1)}
                            className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-sm text-gray-600">No transactions found.</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* All Txns Modal */}
      {modal.open ? (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={closeTxnModal} />
          <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 z-10 border-b bg-white px-5 py-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-gray-900">
                  Transactions • {modal.vendor?.name || modal.vendor?.companyName || "Vendor"}
                </div>
                <div className="text-[11px] text-gray-500">
                  Hold {money(modal.wallet?.balances?.hold)} • Available {money(modal.wallet?.balances?.available)} • Paid{" "}
                  {money(modal.wallet?.balances?.paid)}
                </div>
              </div>
              <button onClick={closeTxnModal} className="h-9 rounded-xl border px-3 text-sm font-semibold hover:bg-gray-50">
                Close
              </button>
            </div>

            <div className="p-5">
              <div className="overflow-x-auto">
                <table className="min-w-[1200px] w-full text-sm">
                  <thead className="bg-white">
                    <tr className="border-b text-left text-xs font-bold text-gray-600">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Order</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Note</th>
                      <th className="px-5 py-3">Idempotency</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(modal.txns || []).map((t: any, idx: number) => {
                      const when = t?.effectiveAt || t?.createdAt || t?.updatedAt;
                      const st = String(t?.status || "").toUpperCase();
                      const dir = String(t?.direction || "").toUpperCase();
                      const amt = Number(t?.amount || 0);
                      const signed = dir === "DEBIT" ? -Math.abs(amt) : Math.abs(amt);

                      return (
                        <tr key={t?._id || t?.idempotencyKey || idx} className="border-b last:border-b-0">
                          <td className="px-5 py-3 text-gray-700">{fmtDateTime(when)}</td>

                          <td className="px-5 py-3">
                            <div className="font-semibold text-gray-900">{typeLabel(t?.type || "")}</div>
                            <div className="text-[11px] text-gray-500 font-mono">{String(t?.type || "")}</div>
                          </td>

                          <td className="px-5 py-3">
                            <div className="font-semibold text-gray-900">{t?.orderCode || "—"}</div>
                            {t?.subOrderId ? (
                              <div className="text-[11px] text-gray-500">Sub: {String(t.subOrderId).slice(-8)}</div>
                            ) : null}
                          </td>

                          <td className="px-5 py-3">
                            <div className={`font-extrabold ${signed < 0 ? "text-red-700" : "text-emerald-700"}`}>
                              {signed < 0 ? "-" : "+"}
                              {money(Math.abs(signed))}
                            </div>
                            <div className="text-[11px] text-gray-500">{dir || "—"}</div>
                          </td>

                          <td className="px-5 py-3">
                            <span className={`inline-flex rounded-xl border px-3 py-1 text-[12px] font-semibold ${badgeClass(st)}`}>
                              {st || "—"}
                            </span>
                          </td>

                          <td className="px-5 py-3">
                            <div className="text-gray-800 text-[12px]">{t?.note || "—"}</div>
                            {t?.meta?.reference ? (
                              <div className="text-[11px] text-gray-500">
                                Ref: <span className="font-mono">{String(t.meta.reference)}</span>
                              </div>
                            ) : null}
                          </td>

                          <td className="px-5 py-3">
                            <div className="text-[11px] text-gray-700 font-mono break-all">{t?.idempotencyKey || "—"}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 text-[11px] text-gray-500">
                Pagination is on main panel. Modal shows current loaded txns (same page).
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
