/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

// ✅ vendor token
const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("vendor_token");
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

async function vendorFetchWallet(params: { type?: string; status?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams();
  if (params.type) qs.set("type", params.type);
  if (params.status) qs.set("status", params.status);
  qs.set("page", String(params.page || 1));
  qs.set("limit", String(params.limit || 20));

  const token = getToken();
  const res = await fetch(`${API_BASE}/vendors/wallet?${qs.toString()}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Failed to load wallet");
  return json?.data ?? json;
}

type Txn = any;
type ModalState = { open: boolean; txn: Txn | null };

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

export default function VendorWalletPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  // ✅ match backend response shape
  const [data, setData] = useState<any>({
    vendorId: "",
    wallet: { balances: { hold: 0, available: 0, paid: 0 }, stats: {} },
    transactions: [],
    page: 1,
    limit,
    totalTxns: 0,
    totalPages: 1,
  });

  const [modal, setModal] = useState<ModalState>({ open: false, txn: null });

const items: Txn[] =
  Array.isArray(data?.txns) ? data.txns :
  Array.isArray(data?.transactions) ? data.transactions :
  [];

  const totalPages = Number(data?.totalPages || 1);

  const load = async (nextPage = 1) => {
    try {
      setLoading(true);
      setError(null);

      const resp = await vendorFetchWallet({ type, status, page: nextPage, limit });
      setData(resp);
      setPage(resp.page || nextPage);
    } catch (e: any) {
      setError(e?.message || "Failed to load wallet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summaryText = useMemo(() => {
   const total = Number(data?.totalTxns ?? data?.total ?? 0);

    return `${total} transaction(s)`;
  }, [data?.total, data?.totalTxns]);

const balances =
  data?.balances ||
  data?.wallet?.balances ||
  { hold: 0, available: 0, paid: 0 };


  const openTxn = (txn: Txn) => setModal({ open: true, txn });
  const closeTxn = () => setModal({ open: false, txn: null });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor · Wallet</h1>
          <p className="text-sm text-gray-600">{summaryText}</p>
        </div>

        <div className="flex gap-2">
          <Link href="/vendors" className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50">
            Vendor Home
          </Link>
          <button onClick={() => load(page)} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
            Refresh
          </button>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm font-semibold text-gray-700">Hold Balance</div>
          <div className="mt-2 text-3xl font-extrabold text-gray-900">{money(balances.hold)}</div>
          <div className="mt-1 text-[12px] text-gray-500">Locked amount (unlock after 10 days)</div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm font-semibold text-gray-700">Available Balance</div>
          <div className="mt-2 text-3xl font-extrabold text-gray-900">{money(balances.available)}</div>
          <div className="mt-1 text-[12px] text-gray-500">Eligible for payout</div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm font-semibold text-gray-700">Paid</div>
          <div className="mt-2 text-3xl font-extrabold text-gray-900">{money(balances.paid)}</div>
          <div className="mt-1 text-[12px] text-gray-500">Already paid by admin</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 rounded-3xl border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <select value={type} onChange={(e) => setType(e.target.value)} className="h-11 rounded-2xl border px-4 text-sm outline-none focus:border-gray-400 bg-white">
            <option value="">All Types</option>
            {TYPE_OPTIONS.filter(Boolean).map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-2xl border px-4 text-sm outline-none focus:border-gray-400 bg-white">
            <option value="">All Status</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <button type="button" onClick={() => load(1)} className="h-11 rounded-2xl bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-black">
            Apply
          </button>

          <button
            type="button"
            onClick={() => {
              setType("");
              setStatus("");
              setTimeout(() => load(1), 0);
            }}
            className="h-11 rounded-2xl border px-4 text-sm font-semibold hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {/* Table */}
      <div className="mt-6 rounded-3xl border bg-white overflow-hidden">
        <div className="border-b bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-900">Transactions</div>

        {loading ? (
          <div className="p-5 space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 rounded-2xl bg-gray-100 animate-pulse" />)}</div>
        ) : items.length ? (
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
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {items.map((t: any, idx: number) => {
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
                        {t?.subOrderId ? <div className="text-[11px] text-gray-500">Sub: {String(t.subOrderId).slice(-8)}</div> : null}
                      </td>

                      <td className="px-5 py-3">
                        <div className={`font-extrabold ${signed < 0 ? "text-red-700" : "text-emerald-700"}`}>
                          {signed < 0 ? "-" : "+"}
                          {money(Math.abs(signed))}
                        </div>
                        <div className="text-[11px] text-gray-500">{dir || "—"}</div>
                      </td>

                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-xl border px-3 py-1 text-[12px] font-semibold ${badgeClass(st)}`}>{st || "—"}</span>
                      </td>

                      <td className="px-5 py-3">
                        <div className="text-gray-800 text-[12px] line-clamp-2">{t?.note || "—"}</div>
                        {t?.meta?.reference ? (
                          <div className="text-[11px] text-gray-500">
                            Ref: <span className="font-mono">{String(t.meta.reference)}</span>
                          </div>
                        ) : null}
                      </td>

                      <td className="px-5 py-3">
                        <button onClick={() => openTxn(t)} className="h-9 rounded-xl border px-3 text-[12px] font-semibold hover:bg-gray-50">
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-gray-600">No transactions found.</div>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Page <span className="font-semibold text-gray-900">{page}</span> of <span className="font-semibold text-gray-900">{totalPages}</span>
        </div>

        <div className="flex gap-2">
          <button disabled={loading || page <= 1} onClick={() => load(page - 1)} className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">
            Prev
          </button>
          <button disabled={loading || page >= totalPages} onClick={() => load(page + 1)} className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">
            Next
          </button>
        </div>
      </div>

      {/* Txn Modal */}
      {modal.open ? (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={closeTxn} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 z-10 border-b bg-white px-5 py-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-gray-900">Transaction</div>
                <div className="text-[11px] text-gray-500 font-mono">{modal.txn?.idempotencyKey || "—"}</div>
              </div>
              <button onClick={closeTxn} className="h-9 rounded-xl border px-3 text-sm font-semibold hover:bg-gray-50">
                Close
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-2xl border p-4">
                <div className="text-sm font-semibold text-gray-900">Summary</div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[11px] text-gray-500">Type</div>
                    <div className="font-semibold text-gray-900">{typeLabel(modal.txn?.type || "")}</div>
                  </div>

                  <div>
                    <div className="text-[11px] text-gray-500">Status</div>
                    <div className="font-semibold text-gray-900">{String(modal.txn?.status || "—")}</div>
                  </div>

                  <div>
                    <div className="text-[11px] text-gray-500">Order</div>
                    <div className="font-semibold text-gray-900">{modal.txn?.orderCode || "—"}</div>
                  </div>

                  <div>
                    <div className="text-[11px] text-gray-500">Amount</div>
                    <div className="font-extrabold text-gray-900">{money(modal.txn?.amount || 0)}</div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-[11px] text-gray-500">Effective At</div>
                    <div className="font-semibold text-gray-900">{fmtDateTime(modal.txn?.effectiveAt)}</div>
                  </div>

                  {modal.txn?.unlockAt ? (
                    <div className="col-span-2">
                      <div className="text-[11px] text-gray-500">Unlock At</div>
                      <div className="font-semibold text-gray-900">{fmtDateTime(modal.txn?.unlockAt)}</div>
                    </div>
                  ) : null}
                </div>

                {modal.txn?.note ? (
                  <div className="mt-3 text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Note:</span> {String(modal.txn.note)}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border p-4">
                <div className="text-sm font-semibold text-gray-900">Meta</div>
                <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-3 text-[12px] text-gray-800">
                  {JSON.stringify(modal.txn?.meta || {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
