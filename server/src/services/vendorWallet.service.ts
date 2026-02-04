/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { VendorWallet } from "../models/VendorWallet.model";

// ---------- utils ----------
const toNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const toObjectId = (id: any) => {
  try {
    if (!id) return null;
    // already ObjectId
    if (id instanceof Types.ObjectId) return id;
    // valid string -> ObjectId
    const s = String(id);
    if (Types.ObjectId.isValid(s)) return new Types.ObjectId(s);
    return null;
  } catch {
    return null;
  }
};

function calcItemsTotal(items: any[]) {
  const arr = Array.isArray(items) ? items : [];
  return arr.reduce((sum, it) => {
    const qty = Math.max(1, Number(it?.qty || 1));

    const line =
      Number(it?.finalLineTotal ?? NaN) ||
      Number(it?.lineTotal ?? NaN) ||
      Number(it?.total ?? NaN) ||
      Number(it?.amount ?? NaN);

    if (Number.isFinite(line) && line > 0) return sum + line;

    const unit =
      Number(it?.finalPrice ?? NaN) ||
      Number(it?.salePrice ?? NaN) ||
      Number(it?.price ?? NaN) ||
      Number(it?.unitPrice ?? NaN);

    if (Number.isFinite(unit) && unit > 0) return sum + unit * qty;

    return sum;
  }, 0);
}

function pickSubOrderTotal(order: any, so: any) {
  const direct =
    toNum(so?.total, NaN) ||
    toNum(so?.grandTotal, NaN) ||
    (toNum(so?.subtotal, NaN) + toNum(so?.shipping, 0));

  if (Number.isFinite(direct) && direct > 0) return direct;

  const computed = calcItemsTotal(so?.items || []);
  if (computed > 0) return computed;

  const totals = order?.totals || {};
  return (
    toNum(totals?.grandTotal, NaN) ||
    toNum(totals?.total, NaN) ||
    toNum(totals?.subtotal, NaN) ||
    toNum(order?.totalAmount, 0)
  );
}

// ---------- wallet core ----------
async function ensureWallet(vendorId: string) {
  const vid = toObjectId(vendorId);
  if (!vid) throw new Error(`Invalid vendorId: ${vendorId}`);

  // ✅ schema me vendorId ObjectId hai
  let w = await VendorWallet.findOne({ vendorId: vid }).exec();

  if (!w) {
    w = await VendorWallet.create({
      vendorId: vid,
      balances: { hold: 0, available: 0, paid: 0 },
      transactions: [],
      stats: { totalCredits: 0, totalDebits: 0, lastTxnAt: new Date() },
    });
  }

  // normalize balances if missing
  // (safe even if doc already has)
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
  wallet.transactions.unshift({
    ...txn,
    createdAt: txn?.createdAt || new Date(),
  });

  wallet.stats = wallet.stats || {};
  wallet.stats.lastTxnAt = new Date();

  const amt = toNum(txn.amount, 0);
  if (txn.direction === "CREDIT") wallet.stats.totalCredits = toNum(wallet.stats.totalCredits, 0) + amt;
  if (txn.direction === "DEBIT") wallet.stats.totalDebits = toNum(wallet.stats.totalDebits, 0) + amt;
}

// ✅ STEP-1: DELIVERED => HOLD CREDIT
export async function walletCreditHoldOnDelivered(opts: {
  vendorId: string;
  orderId: string;
  subOrderId: string;
  orderCode?: string;
  amount: number;
  deliveredAt?: Date;
  unlockAt?: Date;
  meta?: any;
}) {
  const { vendorId, orderId, subOrderId } = opts;

  const amount = Math.max(0, toNum(opts.amount, 0));
  if (!vendorId || !orderId || !subOrderId) return { ok: false, reason: "missing_ids" };
  if (amount <= 0) return { ok: false, reason: "amount_zero" };

  const vid = toObjectId(vendorId);
  const oid = toObjectId(orderId);
  const soid = toObjectId(subOrderId);

  if (!vid || !oid || !soid) return { ok: false, reason: "invalid_objectid" };

  // ✅ include vendorId to avoid unique-index collisions
  const idempotencyKey = `DELIVERED:${vid.toString()}:${soid.toString()}`;

  const wallet = await ensureWallet(vendorId);

  if (hasTxn(wallet, idempotencyKey)) {
    return { ok: true, already: true };
  }

  (wallet as any).balances.hold = toNum((wallet as any).balances.hold, 0) + amount;

  pushTxn(wallet, {
    idempotencyKey,
    vendorId: vid,        // ✅ schema expects ObjectId
    orderId: oid,         // ✅ schema expects ObjectId
    subOrderId: soid,     // ✅ schema expects ObjectId
    orderCode: opts.orderCode || "",

    type: "DELIVERED_HOLD_CREDIT",
    direction: "CREDIT",
    status: "HOLD",
    amount,

    effectiveAt: opts.deliveredAt || new Date(),
    unlockAt: opts.unlockAt || new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),

    meta: opts.meta || {},
  });

  await wallet.save();
  return { ok: true };
}

// ✅ STEP-1: CANCELLED => DEBIT (hold first, then available)
export async function walletDeductOnCancelled(opts: {
  vendorId: string;
  orderId: string;
  subOrderId: string;
  orderCode?: string;
  amount: number;
  meta?: any;
}) {
  const { vendorId, orderId, subOrderId } = opts;

  const amount = Math.max(0, toNum(opts.amount, 0));
  if (!vendorId || !orderId || !subOrderId) return { ok: false, reason: "missing_ids" };
  if (amount <= 0) return { ok: false, reason: "amount_zero" };

  const vid = toObjectId(vendorId);
  const oid = toObjectId(orderId);
  const soid = toObjectId(subOrderId);

  if (!vid || !oid || !soid) return { ok: false, reason: "invalid_objectid" };

  const idempotencyKey = `CANCEL:${vid.toString()}:${soid.toString()}`;

  const wallet = await ensureWallet(vendorId);

  if (hasTxn(wallet, idempotencyKey)) {
    return { ok: true, already: true };
  }

  const beforeHold = toNum((wallet as any).balances?.hold, 0);
  const beforeAvail = toNum((wallet as any).balances?.available, 0);

  let remaining = amount;
  let fromHold = 0;
  let fromAvail = 0;
  let recovery = 0;

  if (beforeHold > 0) {
    fromHold = Math.min(beforeHold, remaining);
    (wallet as any).balances.hold = beforeHold - fromHold;
    remaining -= fromHold;
  }

  if (remaining > 0 && beforeAvail > 0) {
    fromAvail = Math.min(beforeAvail, remaining);
    (wallet as any).balances.available = beforeAvail - fromAvail;
    remaining -= fromAvail;
  }

  if (remaining > 0) {
    // paid ho chuka / insufficient balance => recovery bucket
    recovery = remaining;
    remaining = 0;
  }

  pushTxn(wallet, {
    idempotencyKey,
    vendorId: vid,
    orderId: oid,
    subOrderId: soid,
    orderCode: opts.orderCode || "",

    type: "CANCEL_DEDUCT",
    direction: "DEBIT",
    status: "REVERSED",
    amount,

    effectiveAt: new Date(),
    unlockAt: null,

    meta: {
      fromHold,
      fromAvail,
      recovery,
      ...(opts.meta || {}),
    },
  });

  await wallet.save();
  return { ok: true, meta: { fromHold, fromAvail, recovery } };
}

// ✅ helper: apply wallet effects for an order (process vendor subOrders only)
export async function applyWalletEffectsForOrder(order: any) {
  const subOrders = Array.isArray(order?.subOrders) ? order.subOrders : [];
  const orderId = String(order?._id || "");
  const orderCode = String(order?.orderCode || "");
  const orderStatus = String(order?.status || "").toUpperCase();

  const results: any[] = [];

  for (const so of subOrders) {
// ✅ vendorId can be ObjectId OR populated object { _id: ... }
const vendorIdRaw = (so?.vendorId && typeof so.vendorId === "object" && so.vendorId._id)
  ? so.vendorId._id
  : so?.vendorId;

const vendorId = vendorIdRaw ? String(vendorIdRaw) : "";

// ✅ ownerType optional — don’t block if missing
const ownerType = String(so?.ownerType || "").toUpperCase();
if (!vendorId) continue;
if (ownerType && ownerType !== "VENDOR") continue;

const subOrderId = so?._id ? String(so._id) : "";
if (!subOrderId) continue;

    const subStatus = String(so?.status || orderStatus || "").toUpperCase();

    const amt = pickSubOrderTotal(order, so);

    if (subStatus === "DELIVERED") {
      const deliveredAt = order?.updatedAt ? new Date(order.updatedAt) : new Date();
      const unlockAt = new Date(deliveredAt.getTime() + 10 * 24 * 60 * 60 * 1000);

      const r = await walletCreditHoldOnDelivered({
        vendorId,
        orderId,
        subOrderId,
        orderCode,
        amount: amt,
        deliveredAt,
        unlockAt,
        meta: { source: "applyWalletEffectsForOrder" },
      });

      results.push({ subOrderId, action: "DELIVERED_HOLD_CREDIT", ...r });
      continue;
    }

    if (subStatus === "CANCELLED") {
      const r = await walletDeductOnCancelled({
        vendorId,
        orderId,
        subOrderId,
        orderCode,
        amount: amt,
        meta: { source: "applyWalletEffectsForOrder" },
      });

      results.push({ subOrderId, action: "CANCEL_DEDUCT", ...r });
      continue;
    }
  }

  return results;
}
