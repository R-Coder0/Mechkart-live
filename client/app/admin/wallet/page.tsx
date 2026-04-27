/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
};

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

function fmtDate(v?: any) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
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

function vendorDisplayName(v: any) {
  const companyName = v?.company?.name || v?.companyName || v?.company?.name;
  if (companyName) return String(companyName);

  const nameObj = v?.name;
  if (nameObj && typeof nameObj === "object") {
    const first = String(nameObj.first || "").trim();
    const last = String(nameObj.last || "").trim();
    const full = `${first} ${last}`.trim();
    if (full) return full;
  }

  if (typeof v?.name === "string" && v.name.trim()) return v.name.trim();
  if (v?.vendorName) return String(v.vendorName);
  return "Vendor";
}

function safeImgUrl(path?: string) {
  const p = String(path || "").trim();
  if (!p) return "";
  if (p.startsWith("http://") || p.startsWith("https://")) return p;

  const base = String(API_BASE || "");
  if (!base) return p;

  const host = base.replace(/\/api\/?$/, "");
  if (p.startsWith("/")) return `${host}${p}`;
  return `${host}/${p}`;
}

function toNum(v: any, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function normalizeBalances(b: any) {
  return {
    hold: toNum(b?.hold, 0),
    available: toNum(b?.available, 0),
    paid: toNum(b?.paid, 0),
    deduction: toNum(b?.deduction, 0),
  };
}

function getWalletSummary(walletData: any) {
  const balances = normalizeBalances(walletData?.wallet?.balances || walletData?.balances || {});
  const apiSummary = walletData?.wallet?.summary || {};
  const grossAvailable = toNum(apiSummary?.grossAvailable, balances.available);
  const deduction = toNum(apiSummary?.deduction, balances.deduction);
  const netReleasable = Math.max(0, toNum(apiSummary?.netReleasable, grossAvailable - deduction));

  return {
    balances,
    summary: {
      hold: toNum(apiSummary?.hold, balances.hold),
      grossAvailable,
      deduction,
      netReleasable,
      paid: toNum(apiSummary?.paid, balances.paid),
    },
  };
}

// -------------------- API helpers (Admin) --------------------
async function adminFetchVendors(params: { q?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  qs.set("page", String(params.page || 1));
  qs.set("limit", String(params.limit || 20));

  const res = await fetch(`${API_BASE}/admin/wallet/vendor-wallet?${qs.toString()}`, {
    method: "GET",
    cache: "no-store",
    headers: { ...authHeaders() },
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
    headers: { ...authHeaders() },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Failed to load wallet");
  return json?.data ?? json;
}

async function adminRunUnlock() {
  const res = await fetch(`${API_BASE}/admin/wallet/unlock`, {
    method: "POST",
    cache: "no-store",
    headers: { ...authHeaders() },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Unlock failed");
  return json?.data ?? json;
}

async function adminReleasePayout(payload: {
  vendorId: string;
  amount?: number;
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
  if (!res.ok) throw new Error(json?.message || json?.data?.reason || "Payout release failed");
  return json?.data ?? json;
}

async function adminFailPayout(payload: {
  vendorId: string;
  amount: number;
  method: "UPI" | "BANK" | "MANUAL";
  reference?: string;
  reason?: string;
}) {
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

type TxnModalState =
  | { open: false }
  | {
      open: true;
      vendor: any;
      walletData: any;
      txns: any[];
    };

type UnlockModalState =
  | { open: false }
  | {
      open: true;
    };

type PayoutModalState =
  | { open: false }
  | {
      open: true;
      amount: number;
      method: "UPI" | "BANK" | "MANUAL";
      reference: string;
      note: string;
      useFullNet: boolean;
    };

type FailModalState =
  | { open: false }
  | {
      open: true;
      amount: number;
      method: "UPI" | "BANK" | "MANUAL";
      reference: string;
      reason: string;
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

function uuidFallback(prefix = "REF") {
  try {
    if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  } catch {}
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function txnExtraNote(t: any) {
  const type = String(t?.type || "").toUpperCase();
  const meta = t?.meta || {};

  if (type === "RETURN_DEDUCT" || type === "CANCEL_DEDUCT") {
    const vendorReverseAmount = toNum(meta?.vendorReverseAmount, 0);
    const deductionAmount = toNum(meta?.deductionAmount, 0);

    if (type === "CANCEL_DEDUCT") {
      return {
        label: "Breakup",
        text: `Base reverse ${money(vendorReverseAmount)} - No shipping deduction`,
      };
    }

    return {
      label: "Breakup",
      text: `Base reverse ${money(vendorReverseAmount)} • Shipping deduction ${money(deductionAmount)}`,
    };
  }

  if (type === "PAYOUT_RELEASED") {
    const deductionApplied = toNum(meta?.deductionApplied, 0);
    const grossConsumed = toNum(meta?.grossConsumed, 0);

    return {
      label: "Settlement",
      text: `Deduction adjusted ${money(deductionApplied)} • Gross consumed ${money(grossConsumed)}`,
    };
  }

  return null;
}

export default function AdminWalletPage() {
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

  const [selectedVendor, setSelectedVendor] = useState<any | null>(null);

  const [wLoading, setWLoading] = useState(false);
  const [wError, setWError] = useState<string | null>(null);
  const [wq, setWq] = useState("");
  const [wType, setWType] = useState("");
  const [wStatus, setWStatus] = useState("");
  const [wPage, setWPage] = useState(1);
  const wLimit = 20;

  const [walletData, setWalletData] = useState<any>({
    vendor: null,
    wallet: { balances: { hold: 0, available: 0, paid: 0, deduction: 0 }, stats: {}, summary: {} },
    transactions: [],
    page: 1,
    limit: wLimit,
    totalTxns: 0,
    totalPages: 1,
    unlockSummary: { dueHoldAmount: 0, dueHoldCount: 0, nextUnlockAt: null },
  });

  const txns = useMemo(() => {
    return Array.isArray(walletData?.transactions) ? walletData.transactions : [];
  }, [walletData]);

  const wTotalPages = Number(walletData?.totalPages || 1);

  const [busy, setBusy] = useState<string | null>(null);

  const [txnModal, setTxnModal] = useState<TxnModalState>({ open: false });
  const [unlockModal, setUnlockModal] = useState<UnlockModalState>({ open: false });
  const [payoutModal, setPayoutModal] = useState<PayoutModalState>({ open: false });
  const [failModal, setFailModal] = useState<FailModalState>({ open: false });

  const loadVendors = async (nextPage = 1) => {
    try {
      setVLoading(true);
      setVError(null);
      if (!getToken()) throw new Error("Admin token missing. Please login again.");

      const resp = await adminFetchVendors({ q: vq, page: nextPage, limit: vLimit });
      setVendorsData(resp);
      setVPage(resp.page || nextPage);

      const list = Array.isArray(resp?.items) ? resp.items : [];
      if (!selectedVendor && list.length) setSelectedVendor(list[0]);
    } catch (e: any) {
      setVError(e?.message || "Failed to load vendors");
    } finally {
      setVLoading(false);
    }
  };

  const loadWallet = async (vendor: any, nextPage = 1) => {
    if (!vendor?.vendorId) return;
    try {
      setWLoading(true);
      setWError(null);
      if (!getToken()) throw new Error("Admin token missing. Please login again.");

      const resp = await adminFetchVendorWallet(String(vendor.vendorId), {
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
    if (!selectedVendor?.vendorId) return;
    loadWallet(selectedVendor, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendor?.vendorId]);

  const vendorsSummary = useMemo(() => {
    const total = Number(vendorsData?.total || 0);
    return `${total} vendor(s)`;
  }, [vendorsData?.total]);

  const vendorInfo = walletData?.vendor || null;
  const walletInfo = getWalletSummary(walletData);
  const walletBalances = walletInfo.balances;
  const walletSummary = walletInfo.summary;
  const unlockSummary = walletData?.unlockSummary || {
    dueHoldAmount: 0,
    dueHoldCount: 0,
    nextUnlockAt: null,
  };

  const onOpenUnlock = () => {
    setUnlockModal({ open: true });
  };

  const onOpenReleasePayout = () => {
    if (!selectedVendor?.vendorId) return;

    const amt = Math.max(0, toNum(walletSummary?.netReleasable, 0));

    setPayoutModal({
      open: true,
      amount: amt,
      method: "MANUAL",
      reference: uuidFallback("PAYOUT"),
      note: "Admin payout release",
      useFullNet: true,
    });
  };

  const onOpenFailPayout = () => {
    if (!selectedVendor?.vendorId) return;

    const amt = Math.max(0, toNum(walletSummary?.netReleasable, 0));

    setFailModal({
      open: true,
      amount: amt,
      method: "MANUAL",
      reference: uuidFallback("FAIL"),
      reason: "Payout failed (logged by admin)",
    });
  };

  const onSubmitUnlock = async () => {
    if (!unlockModal.open) return;
    try {
      setBusy("unlock");
      if (!getToken()) throw new Error("Admin token missing. Please login again.");

      await adminRunUnlock();

      if (selectedVendor?.vendorId) await loadWallet(selectedVendor, 1);
      await loadVendors(vPage);

      setUnlockModal({ open: false });

      const latest = selectedVendor?.vendorId
        ? await adminFetchVendorWallet(String(selectedVendor.vendorId), { page: 1, limit: wLimit })
        : null;

      const summary = latest?.unlockSummary;
      alert(
        `Unlock executed. Due unlock: ${money(summary?.dueHoldAmount || 0)}. Next unlock: ${fmtDate(
          summary?.nextUnlockAt
        )}`
      );
    } catch (e: any) {
      alert(e?.message || "Unlock failed");
    } finally {
      setBusy(null);
    }
  };

  const onSubmitPayout = async () => {
    if (!payoutModal.open || !selectedVendor?.vendorId) return;
    try {
      setBusy("payout");
      if (!getToken()) throw new Error("Admin token missing. Please login again.");

      const amt = Number(payoutModal.amount || 0);
      if (!payoutModal.useFullNet && (!Number.isFinite(amt) || amt <= 0)) {
        alert("Enter a valid payout amount.");
        return;
      }

      const payload: any = {
        vendorId: String(selectedVendor.vendorId),
        method: payoutModal.method,
        reference: payoutModal.reference?.trim() || uuidFallback("PAYOUT"),
        note: payoutModal.note?.trim() || undefined,
      };

      if (!payoutModal.useFullNet) {
        payload.amount = amt;
      }

      await adminReleasePayout(payload);

      await loadWallet(selectedVendor, 1);
      await loadVendors(vPage);

      setPayoutModal({ open: false });
      alert("Payout released");
    } catch (e: any) {
      alert(e?.message || "Payout release failed");
    } finally {
      setBusy(null);
    }
  };

  const onSubmitFail = async () => {
    if (!failModal.open || !selectedVendor?.vendorId) return;
    try {
      setBusy("payout_fail");
      if (!getToken()) throw new Error("Admin token missing. Please login again.");

      const amt = Number(failModal.amount || 0);
      if (!Number.isFinite(amt) || amt <= 0) {
        alert("Enter a valid amount to log failure.");
        return;
      }

      await adminFailPayout({
        vendorId: String(selectedVendor.vendorId),
        amount: amt,
        method: failModal.method,
        reference: failModal.reference?.trim() || uuidFallback("FAIL"),
        reason: failModal.reason?.trim() || undefined,
      });

      await loadWallet(selectedVendor, 1);

      setFailModal({ open: false });
      alert("Payout failure logged");
    } catch (e: any) {
      alert(e?.message || "Payout fail log failed");
    } finally {
      setBusy(null);
    }
  };

  const openTxnModal = () => {
    if (!selectedVendor) return;
    setTxnModal({
      open: true,
      vendor: selectedVendor,
      walletData,
      txns,
    });
  };

  const closeTxnModal = () => setTxnModal({ open: false });

  return (
    <div className="mx-auto max-w-[1700px] px-4 py-10">
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
            onClick={onOpenUnlock}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
          >
            {busy === "unlock" ? "Running…" : "Run Unlock Job"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="overflow-hidden rounded-3xl border bg-white">
            <div className="border-b bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-900">Vendors</div>

            <div className="border-b p-4">
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
              <div className="space-y-3 p-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-2xl bg-gray-100" />
                ))}
              </div>
            ) : vendors.length ? (
              <>
                <div className="divide-y">
                  {vendors.map((v: any) => {
                    const active = String(selectedVendor?.vendorId || "") === String(v?.vendorId || "");
                    const balances = normalizeBalances(v?.wallet?.balances || {});
                    const apiSummary = v?.wallet?.summary || {};
                    const grossAvailable = toNum(apiSummary?.grossAvailable, balances.available);
                    const deduction = toNum(apiSummary?.deduction, balances.deduction);
                    const netReleasable = Math.max(0, toNum(apiSummary?.netReleasable, grossAvailable - deduction));

                    return (
                      <button
                        key={String(v.vendorId)}
                        onClick={() => setSelectedVendor(v)}
                        className={`w-full px-4 py-4 text-left hover:bg-gray-50 ${active ? "bg-emerald-50/40" : "bg-white"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="line-clamp-1 font-semibold text-gray-900">{vendorDisplayName(v)}</div>
                            <div className="text-[11px] text-gray-500">
                              {v?.phone || "—"} {v?.email ? `• ${v.email}` : ""}
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <div className="text-[11px] text-gray-500">Net Payout</div>
                            <div className="font-extrabold text-emerald-700">{money(netReleasable)}</div>
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                          <div className="rounded-xl border bg-white px-3 py-2">
                            <div className="text-gray-500">Hold</div>
                            <div className="font-bold text-gray-900">{money(balances.hold)}</div>
                          </div>
                          <div className="rounded-xl border bg-white px-3 py-2">
                            <div className="text-gray-500">Available</div>
                            <div className="font-bold text-gray-900">{money(grossAvailable)}</div>
                          </div>
                          <div className="rounded-xl border bg-white px-3 py-2">
                            <div className="text-gray-500">Deduction</div>
                            <div className="font-bold text-red-700">{money(deduction)}</div>
                          </div>
                          <div className="rounded-xl border bg-white px-3 py-2">
                            <div className="text-gray-500">Paid</div>
                            <div className="font-bold text-gray-900">{money(balances.paid)}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between border-t p-4">
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

        <div className="lg:col-span-7">
          <div className="overflow-hidden rounded-3xl border bg-white">
            <div className="flex items-center justify-between border-b bg-gray-50 px-5 py-3">
              <div className="text-sm font-semibold text-gray-900">
                Wallet {selectedVendor ? `• ${vendorDisplayName(vendorInfo || selectedVendor)}` : ""}
              </div>

              <div className="flex gap-2">
                <button
                  disabled={!selectedVendor?.vendorId || busy === "payout" || walletSummary.netReleasable <= 0}
                  onClick={onOpenReleasePayout}
                  className="h-9 rounded-xl bg-emerald-600 px-3 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy === "payout" ? "..." : "Release Payout"}
                </button>
                <button
                  disabled={!selectedVendor?.vendorId || busy === "payout_fail"}
                  onClick={onOpenFailPayout}
                  className="h-9 rounded-xl bg-red-600 px-3 text-[12px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {busy === "payout_fail" ? "..." : "Log Payout Failed"}
                </button>
                <button
                  disabled={!selectedVendor?.vendorId}
                  onClick={() => loadWallet(selectedVendor, wPage)}
                  className="h-9 rounded-xl border px-3 text-[12px] font-semibold hover:bg-gray-50 disabled:opacity-60"
                >
                  Refresh
                </button>
              </div>
            </div>

            {!selectedVendor?.vendorId ? (
              <div className="p-6 text-sm text-gray-600">Select a vendor to view wallet.</div>
            ) : (
              <>
                {vendorInfo?.payment ? (
                  <div className="border-b bg-gray-50 p-4">
                    <div className="mb-2 text-sm font-semibold text-gray-900">Payout Details</div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="text-sm">
                        <div className="text-[12px] text-gray-500">Vendor</div>
                        <div className="font-semibold">{vendorDisplayName(vendorInfo)}</div>
                        <div className="text-[12px] text-gray-600">
                          {vendorInfo?.phone || "—"} {vendorInfo?.email ? `• ${vendorInfo.email}` : ""}
                        </div>
                      </div>

                      <div className="text-sm">
                        {vendorInfo.payment.upiId ? (
                          <div>
                            <span className="text-[12px] text-gray-500">UPI</span>
                            <div className="font-semibold">{vendorInfo.payment.upiId}</div>
                          </div>
                        ) : (
                          <div className="text-[12px] text-gray-500">UPI: —</div>
                        )}

                        {vendorInfo.payment.bankAccount ? (
                          <div className="mt-2">
                            <span className="text-[12px] text-gray-500">Bank</span>
                            <div className="font-semibold">{vendorInfo.payment.bankAccount}</div>
                            <div className="text-[12px] text-gray-600">IFSC: {vendorInfo.payment.ifsc || "—"}</div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {vendorInfo.payment.qrImage ? (
                      <img
                        src={safeImgUrl(vendorInfo.payment.qrImage)}
                        alt="QR"
                        className="mt-3 h-36 rounded border bg-white"
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="border-b bg-amber-50 p-4">
                    <div className="text-sm font-semibold text-amber-900">Payout Details Missing</div>
                    <div className="text-[12px] text-amber-800">Vendor has no UPI/Bank/QR details saved.</div>
                  </div>
                )}

                <div className="border-b p-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-3xl border bg-white p-4">
                      <div className="text-sm font-semibold text-gray-700">Hold</div>
                      <div className="mt-2 text-2xl font-extrabold text-gray-900">{money(walletSummary.hold)}</div>
                      <div className="mt-1 text-[12px] text-gray-500">Locked (unlock due)</div>
                      <div className="mt-2 text-[12px] text-gray-700">
                        Unlock due: <b>{money(unlockSummary?.dueHoldAmount || 0)}</b>
                      </div>
                      <div className="mt-1 text-[12px] text-gray-500">
                        Next unlock: <b>{fmtDate(unlockSummary?.nextUnlockAt)}</b>
                      </div>
                    </div>

                    <div className="rounded-3xl border bg-white p-4">
                      <div className="text-sm font-semibold text-gray-700">Gross Available</div>
                      <div className="mt-2 text-2xl font-extrabold text-gray-900">
                        {money(walletSummary.grossAvailable)}
                      </div>
                      <div className="mt-1 text-[12px] text-gray-500">Before deduction cut</div>
                    </div>

                    <div className="rounded-3xl border bg-white p-4">
                      <div className="text-sm font-semibold text-gray-700">Deduction</div>
                      <div className="mt-2 text-2xl font-extrabold text-red-700">{money(walletSummary.deduction)}</div>
                      <div className="mt-1 text-[12px] text-gray-500">Shipping / pending cut</div>
                    </div>

                    <div className="rounded-3xl border bg-emerald-50 p-4">
                      <div className="text-sm font-semibold text-emerald-800">Net Releasable</div>
                      <div className="mt-2 text-2xl font-extrabold text-emerald-700">
                        {money(walletSummary.netReleasable)}
                      </div>
                      <div className="mt-1 text-[12px] text-emerald-700">Actual payout now</div>
                      <div className="mt-2 text-[12px] text-gray-600">Paid till now: {money(walletSummary.paid)}</div>
                    </div>
                  </div>
                </div>

                <div className="border-b p-4">
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
                      className="h-11 rounded-2xl border bg-white px-4 text-sm outline-none focus:border-gray-400"
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
                      className="h-11 rounded-2xl border bg-white px-4 text-sm outline-none focus:border-gray-400"
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

                <div className="border-b">
                  {wLoading ? (
                    <div className="space-y-3 p-5">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-10 animate-pulse rounded-2xl bg-gray-100" />
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
                          {txns.map((t: any, idx: number) => {
                            const when = t?.effectiveAt || t?.createdAt || t?.updatedAt;
                            const st = String(t?.status || "").toUpperCase();
                            const dir = String(t?.direction || "").toUpperCase();
                            const amt = Number(t?.amount || 0);
                            const signed = dir === "DEBIT" ? -Math.abs(amt) : Math.abs(amt);
                            const extra = txnExtraNote(t);

                            return (
                              <tr key={t?._id || t?.idempotencyKey || idx} className="border-b last:border-b-0">
                                <td className="px-5 py-3 text-gray-700">{fmtDateTime(when)}</td>

                                <td className="px-5 py-3">
                                  <div className="font-semibold text-gray-900">{typeLabel(t?.type || "")}</div>
                                  <div className="font-mono text-[11px] text-gray-500">{String(t?.type || "")}</div>
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
                                    className={`inline-flex rounded-xl border px-3 py-1 text-[12px] font-semibold ${badgeClass(
                                      st
                                    )}`}
                                  >
                                    {st || "—"}
                                  </span>
                                </td>

                                <td className="px-5 py-3">
                                  <div className="line-clamp-2 text-[12px] text-gray-800">{t?.note || "—"}</div>
                                  {t?.meta?.reference ? (
                                    <div className="text-[11px] text-gray-500">
                                      Ref: <span className="font-mono">{String(t.meta.reference)}</span>
                                    </div>
                                  ) : null}
                                  {extra ? (
                                    <div className="mt-1 text-[11px] text-gray-500">
                                      {extra.label}: <span className="font-medium text-gray-700">{extra.text}</span>
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      <div className="flex items-center justify-between border-t p-4">
                        <div className="text-sm text-gray-600">
                          Showing current page •{" "}
                          <button onClick={openTxnModal} className="font-semibold text-gray-900 underline underline-offset-4">
                            View loaded txns
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

      {unlockModal.open ? (
        <div className="fixed inset-0 z-80">
          <div className="absolute inset-0 bg-black/40" onClick={() => setUnlockModal({ open: false })} />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl bg-white shadow-xl">
            <div className="border-b px-5 py-4">
              <div className="text-lg font-bold text-gray-900">Run Unlock Job</div>
              <div className="text-[12px] text-gray-600">Moves due HOLD → AVAILABLE.</div>
            </div>

            <div className="space-y-3 p-5">
              <div className="rounded-2xl border bg-gray-50 px-4 py-3 text-sm text-gray-700">
                This will unlock all due hold credits based on unlock date.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setUnlockModal({ open: false })}
                  className="h-10 rounded-xl border px-4 text-sm font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  disabled={busy === "unlock"}
                  onClick={onSubmitUnlock}
                  className="h-10 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                >
                  {busy === "unlock" ? "Running…" : "Run"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {payoutModal.open ? (
        <div className="fixed inset-0 z-80">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPayoutModal({ open: false })} />
          <div className="absolute left-1/2 top-1/2 w-[94%] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl bg-white shadow-xl">
            <div className="border-b px-5 py-4">
              <div className="text-lg font-bold text-gray-900">Release Payout</div>
              <div className="text-[12px] text-gray-600">
                Vendor: <span className="font-semibold">{vendorDisplayName(vendorInfo || selectedVendor)}</span>
              </div>
            </div>

            <div className="space-y-3 p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border bg-gray-50 px-4 py-3">
                  <div className="text-[12px] text-gray-500">Gross Available</div>
                  <div className="font-bold text-gray-900">{money(walletSummary.grossAvailable)}</div>
                </div>
                <div className="rounded-2xl border bg-red-50 px-4 py-3">
                  <div className="text-[12px] text-red-600">Deduction</div>
                  <div className="font-bold text-red-700">{money(walletSummary.deduction)}</div>
                </div>
                <div className="rounded-2xl border bg-emerald-50 px-4 py-3">
                  <div className="text-[12px] text-emerald-700">Net Releasable</div>
                  <div className="font-bold text-emerald-700">{money(walletSummary.netReleasable)}</div>
                </div>
              </div>

              <label className="flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={payoutModal.useFullNet}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setPayoutModal({
                      ...payoutModal,
                      useFullNet: checked,
                      amount: checked ? walletSummary.netReleasable : payoutModal.amount,
                    });
                  }}
                />
                Release full net releasable amount automatically
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Amount (₹)</label>
                  <input
                    value={payoutModal.amount}
                    onChange={(e) => setPayoutModal({ ...payoutModal, amount: Number(e.target.value || 0), useFullNet: false })}
                    className="h-11 w-full rounded-2xl border px-4 text-sm outline-none focus:border-gray-400 disabled:bg-gray-100"
                    type="number"
                    min={1}
                    disabled={payoutModal.useFullNet}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Method</label>
                  <select
                    value={payoutModal.method}
                    onChange={(e) => setPayoutModal({ ...payoutModal, method: e.target.value as any })}
                    className="h-11 w-full rounded-2xl border bg-white px-4 text-sm outline-none focus:border-gray-400"
                  >
                    <option value="UPI">UPI</option>
                    <option value="BANK">BANK</option>
                    <option value="MANUAL">MANUAL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Reference / UTR / TxnId</label>
                <input
                  value={payoutModal.reference}
                  onChange={(e) => setPayoutModal({ ...payoutModal, reference: e.target.value })}
                  className="h-11 w-full rounded-2xl border px-4 text-sm outline-none focus:border-gray-400"
                  placeholder="e.g. UTR123..."
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Note (optional)</label>
                <input
                  value={payoutModal.note}
                  onChange={(e) => setPayoutModal({ ...payoutModal, note: e.target.value })}
                  className="h-11 w-full rounded-2xl border px-4 text-sm outline-none focus:border-gray-400"
                  placeholder="Admin payout release"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setPayoutModal({ open: false })}
                  className="h-10 rounded-xl border px-4 text-sm font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  disabled={busy === "payout" || walletSummary.netReleasable <= 0}
                  onClick={onSubmitPayout}
                  className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy === "payout" ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {failModal.open ? (
        <div className="fixed inset-0 z-80">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFailModal({ open: false })} />
          <div className="absolute left-1/2 top-1/2 w-[94%] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl bg-white shadow-xl">
            <div className="border-b px-5 py-4">
              <div className="text-lg font-bold text-gray-900">Log Payout Failed</div>
              <div className="text-[12px] text-gray-600">
                Vendor: <span className="font-semibold">{vendorDisplayName(vendorInfo || selectedVendor)}</span>
              </div>
            </div>

            <div className="space-y-3 p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Amount (₹)</label>
                  <input
                    value={failModal.amount}
                    onChange={(e) => setFailModal({ ...failModal, amount: Number(e.target.value || 0) })}
                    className="h-11 w-full rounded-2xl border px-4 text-sm outline-none focus:border-gray-400"
                    type="number"
                    min={1}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Method</label>
                  <select
                    value={failModal.method}
                    onChange={(e) => setFailModal({ ...failModal, method: e.target.value as any })}
                    className="h-11 w-full rounded-2xl border bg-white px-4 text-sm outline-none focus:border-gray-400"
                  >
                    <option value="UPI">UPI</option>
                    <option value="BANK">BANK</option>
                    <option value="MANUAL">MANUAL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Reference / UTR / TxnId</label>
                <input
                  value={failModal.reference}
                  onChange={(e) => setFailModal({ ...failModal, reference: e.target.value })}
                  className="h-11 w-full rounded-2xl border px-4 text-sm outline-none focus:border-gray-400"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Reason</label>
                <input
                  value={failModal.reason}
                  onChange={(e) => setFailModal({ ...failModal, reason: e.target.value })}
                  className="h-11 w-full rounded-2xl border px-4 text-sm outline-none focus:border-gray-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setFailModal({ open: false })}
                  className="h-10 rounded-xl border px-4 text-sm font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  disabled={busy === "payout_fail"}
                  onClick={onSubmitFail}
                  className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {busy === "payout_fail" ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {txnModal.open ? (
        <div className="fixed inset-0 z-70">
          <div className="absolute inset-0 bg-black/40" onClick={closeTxnModal} />
          <div className="absolute right-0 top-0 h-full w-full max-w-3xl overflow-y-auto bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
              <div>
                <div className="text-lg font-bold text-gray-900">
                  Transactions • {vendorDisplayName(txnModal.walletData?.vendor || txnModal.vendor)}
                </div>
                <div className="text-[11px] text-gray-500">
                  Hold {money(getWalletSummary(txnModal.walletData).summary.hold)} • Gross Available{" "}
                  {money(getWalletSummary(txnModal.walletData).summary.grossAvailable)} • Deduction{" "}
                  {money(getWalletSummary(txnModal.walletData).summary.deduction)} • Net{" "}
                  {money(getWalletSummary(txnModal.walletData).summary.netReleasable)}
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
                    {(txnModal.txns || []).map((t: any, idx: number) => {
                      const when = t?.effectiveAt || t?.createdAt || t?.updatedAt;
                      const st = String(t?.status || "").toUpperCase();
                      const dir = String(t?.direction || "").toUpperCase();
                      const amt = Number(t?.amount || 0);
                      const signed = dir === "DEBIT" ? -Math.abs(amt) : Math.abs(amt);
                      const extra = txnExtraNote(t);

                      return (
                        <tr key={t?._id || t?.idempotencyKey || idx} className="border-b last:border-b-0">
                          <td className="px-5 py-3 text-gray-700">{fmtDateTime(when)}</td>

                          <td className="px-5 py-3">
                            <div className="font-semibold text-gray-900">{typeLabel(t?.type || "")}</div>
                            <div className="font-mono text-[11px] text-gray-500">{String(t?.type || "")}</div>
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
                            <div className="text-[12px] text-gray-800">{t?.note || "—"}</div>
                            {t?.meta?.reference ? (
                              <div className="text-[11px] text-gray-500">
                                Ref: <span className="font-mono">{String(t.meta.reference)}</span>
                              </div>
                            ) : null}
                            {extra ? (
                              <div className="mt-1 text-[11px] text-gray-500">
                                {extra.label}: <span className="font-medium text-gray-700">{extra.text}</span>
                              </div>
                            ) : null}
                          </td>

                          <td className="px-5 py-3">
                            <div className="break-all font-mono text-[11px] text-gray-700">{t?.idempotencyKey || "—"}</div>
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
