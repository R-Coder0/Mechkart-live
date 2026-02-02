/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { VendorWallet } from "../models/VendorWallet.model";

const toNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const toObjectId = (id: any) => {
  try {
    if (!id) return null;
    if (id instanceof Types.ObjectId) return id;
    const s = String(id);
    if (Types.ObjectId.isValid(s)) return new Types.ObjectId(s);
    return null;
  } catch {
    return null;
  }
};

async function ensureWallet(vendorId: string) {
  const vid = toObjectId(vendorId);
  if (!vid) throw new Error("Invalid vendorId");

  let w = await VendorWallet.findOne({ vendorId: vid }).exec();
  if (!w) {
    w = await VendorWallet.create({
      vendorId: vid,
      balances: { hold: 0, available: 0, paid: 0 },
      transactions: [],
      stats: { totalCredits: 0, totalDebits: 0, lastTxnAt: new Date() },
    });
  }

  (w as any).balances = (w as any).balances || { hold: 0, available: 0, paid: 0 };
  (w as any).balances.hold = toNum((w as any).balances.hold, 0);
  (w as any).balances.available = toNum((w as any).balances.available, 0);
  (w as any).balances.paid = toNum((w as any).balances.paid, 0);

  return w;
}

function hasTxn(wallet: any, idempotencyKey: string) {
  const txns = Array.isArray(wallet?.transactions) ? wallet.transactions : [];
  return txns.some((t: any) => String(t?.idempotencyKey) === String(idempotencyKey));
}

function pushTxn(wallet: any, txn: any) {
  wallet.transactions = Array.isArray(wallet.transactions) ? wallet.transactions : [];
  wallet.transactions.unshift({ ...txn, createdAt: txn?.createdAt || new Date() });

  wallet.stats = wallet.stats || {};
  wallet.stats.lastTxnAt = new Date();

  const amt = toNum(txn.amount, 0);
  if (txn.direction === "CREDIT") wallet.stats.totalCredits = toNum(wallet.stats.totalCredits, 0) + amt;
  if (txn.direction === "DEBIT") wallet.stats.totalDebits = toNum(wallet.stats.totalDebits, 0) + amt;
}

/**
 * Admin releases payout from vendor AVAILABLE -> PAID
 * - amount optional: if not provided => full available payout
 * - idempotency:
 *    - reference present => vendor+reference
 *    - else manualKey required (frontend should send uuid)
 */
export async function adminReleaseVendorPayout(opts: {
  vendorId: string;
  amount?: number; // ✅ optional (blank => full available)
  method?: "UPI" | "BANK" | "MANUAL";
  reference?: string; // UTR / TxnId
  manualKey?: string; // ✅ if no reference, send this (uuid)
  note?: string;
  meta?: any;
}) {
  const vendorId = String(opts.vendorId || "").trim();
  if (!vendorId) return { ok: false, reason: "vendorId_required" };

  const vid = toObjectId(vendorId);
  if (!vid) return { ok: false, reason: "vendorId_invalid" };

  const method = (opts.method || "MANUAL").toUpperCase() as any;
  const reference = String(opts.reference || "").trim();
  const manualKey = String(opts.manualKey || "").trim();

  // ✅ load wallet first to compute full payout if amount not provided
  const w = await ensureWallet(vendorId);
  const availableBefore = toNum((w as any).balances.available, 0);

  const amt =
    opts.amount === undefined || opts.amount === null || (typeof opts.amount === "string" && !String(opts.amount).trim())
      ? availableBefore
      : Math.max(0, toNum(opts.amount, 0));

  if (amt <= 0) return { ok: false, reason: "amount_invalid" };

  if (availableBefore < amt) {
    return {
      ok: false,
      reason: "insufficient_available",
      meta: { available: availableBefore, requested: amt },
    };
  }

  // ✅ idempotency: prefer reference; else require manualKey (ui uuid)
  const idempotencyKey = reference
    ? `PAYOUT:${vid.toString()}:${reference}`
    : manualKey
      ? `PAYOUT:${vid.toString()}:${manualKey}`
      : "";

  if (!idempotencyKey) {
    return {
      ok: false,
      reason: "idempotency_required",
      message: "reference or manualKey is required to avoid duplicate payouts",
    };
  }

  if (hasTxn(w, idempotencyKey)) {
    return { ok: true, already: true, idempotencyKey, balances: (w as any).balances };
  }

  // ✅ apply balances
  (w as any).balances.available = availableBefore - amt;
  (w as any).balances.paid = toNum((w as any).balances.paid, 0) + amt;

  const txn = {
    idempotencyKey,
    vendorId: vid,
    orderId: null,
    subOrderId: null,
    orderCode: "",

    type: "PAYOUT_RELEASED",
    direction: "DEBIT",
    status: "PAID",
    amount: amt,
    currency: "INR",

    effectiveAt: new Date(),
    unlockAt: null,

    note: opts.note || "Payout released by admin",
    meta: {
      method,
      reference: reference || "",
      ...(opts.meta || {}),
    },
  };

  pushTxn(w, txn);
  await w.save();

  return {
    ok: true,
    idempotencyKey,
    balances: (w as any).balances,
    txn: { type: txn.type, amount: txn.amount, method, reference: reference || null },
  };
}

/**
 * Optional: mark payout failed (no balance change) - only log
 * - idempotency: prefer reference; else manualKey required
 */
export async function adminLogPayoutFailed(opts: {
  vendorId: string;
  amount: number;
  method?: "UPI" | "BANK" | "MANUAL";
  reference?: string;
  manualKey?: string; // ✅ if no reference, send uuid
  reason?: string;
  meta?: any;
}) {
  const vendorId = String(opts.vendorId || "").trim();
  const amt = Math.max(0, toNum(opts.amount, 0));
  if (!vendorId) return { ok: false, reason: "vendorId_required" };
  if (amt <= 0) return { ok: false, reason: "amount_invalid" };

  const vid = toObjectId(vendorId);
  if (!vid) return { ok: false, reason: "vendorId_invalid" };

  const reference = String(opts.reference || "").trim();
  const manualKey = String(opts.manualKey || "").trim();
  const method = (opts.method || "MANUAL").toUpperCase() as any;

  const idempotencyKey = reference
    ? `PAYOUT_FAIL:${vid.toString()}:${reference}`
    : manualKey
      ? `PAYOUT_FAIL:${vid.toString()}:${manualKey}`
      : "";

  if (!idempotencyKey) {
    return {
      ok: false,
      reason: "idempotency_required",
      message: "reference or manualKey is required to avoid duplicate failure logs",
    };
  }

  const w = await ensureWallet(vendorId);
  if (hasTxn(w, idempotencyKey)) return { ok: true, already: true, idempotencyKey, balances: (w as any).balances };

  const txn = {
    idempotencyKey,
    vendorId: vid,
    orderId: null,
    subOrderId: null,
    orderCode: "",

    type: "PAYOUT_FAILED",
    direction: "DEBIT",
    status: "FAILED",
    amount: amt,
    currency: "INR",

    effectiveAt: new Date(),
    unlockAt: null,

    note: opts.reason || "Payout failed",
    meta: {
      method,
      reference: reference || "",
      ...(opts.meta || {}),
    },
  };

  pushTxn(w, txn);
  await w.save();

  return {
    ok: true,
    idempotencyKey,
    balances: (w as any).balances,
    txn: { type: txn.type, amount: txn.amount, method, reference: reference || null, reason: opts.reason || null },
  };
}
