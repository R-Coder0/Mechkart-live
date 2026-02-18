/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { VendorWallet } from "../models/VendorWallet.model";

// ---------- utils ----------
const toNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

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

/** =========================
 * ✅ Shipping Markup (same rule)
 * 0.5kg => 60, every next 0.5kg => +30
 * ========================= */
const calcShippingMarkup = (weightKg: any) => {
  const w = Number(weightKg || 0);
  if (!Number.isFinite(w) || w <= 0) return 0;

  const step = 0.5;
  const slabs = Math.ceil(w / step);
  const base = 60;
  const extra = Math.max(0, slabs - 1) * 30;
  return base + extra;
};

function getItemShippingMarkupPerUnit(it: any) {
  // vendor items only
  const ownerType = String(it?.ownerType || "").toUpperCase();
  if (ownerType && ownerType !== "VENDOR") return 0;

  const wKg =
    toNum(it?.ship?.weightKg, NaN) ||
    toNum(it?.shipSnapshot?.weightKg, NaN) ||
    toNum(it?.pricingMeta?.weightKg, NaN) ||
    0;

  return calcShippingMarkup(wKg);
}

/**
 * ✅ Compute vendor-earning for one item:
 * - Order stores salePrice = payable (base + shippingMarkup)
 * - Vendor should earn base only
 * - Offer discount should be applied proportionally on base (not on shipping markup)
 */
function computeVendorNetForItem(it: any) {
  const qty = Math.max(1, toNum(it?.qty, 1));

  // payable unit price stored in order
  const payableUnit =
    toNum(it?.salePrice, NaN) ||
    toNum(it?.unitPrice, NaN) ||
    toNum(it?.price, 0);

  const payableLine = Math.max(0, round2(payableUnit * qty));

  // shipping markup per unit derived from ship.weightKg
  const shipMarkupUnit = getItemShippingMarkupPerUnit(it);
  const shipMarkupLine = Math.max(0, round2(shipMarkupUnit * qty));

  // base line (what vendor should be paid on, before discount)
  const baseLine = Math.max(0, round2(payableLine - shipMarkupLine));

  // offer discount allocated on line (order snapshot)
  const offerDiscount = Math.max(0, toNum(it?.offerDiscount, 0));

  // Allocate discount to base by ratio (base/payable)
  let vendorDiscount = 0;
  if (offerDiscount > 0 && payableLine > 0 && baseLine > 0) {
    vendorDiscount = round2(offerDiscount * (baseLine / payableLine));
  }

  const vendorNet = Math.max(0, round2(baseLine - vendorDiscount));

  return {
    qty,
    payableUnit,
    payableLine,
    shipMarkupUnit,
    shipMarkupLine,
    baseLine,
    offerDiscount,
    vendorDiscount,
    vendorNet,
  };
}

/**
 * ✅ Vendor SubOrder net total (WITHOUT shipping markup)
 * Use subOrder.items (order snapshot) and compute accurately.
 */
function pickVendorSubOrderNet(order: any, so: any) {
  const items = Array.isArray(so?.items) ? so.items : [];
  if (!items.length) return 0;

  return round2(
    items.reduce((sum: number, it: any) => {
      const ownerType = String(it?.ownerType || so?.ownerType || "").toUpperCase();
      // only vendor items should exist in vendor subOrder, but keep safe
      if (ownerType && ownerType !== "VENDOR") return sum;
      const r = computeVendorNetForItem(it);
      return sum + r.vendorNet;
    }, 0)
  );
}

// ---------- wallet core ----------
async function ensureWallet(vendorId: string) {
  const vid = toObjectId(vendorId);
  if (!vid) throw new Error(`Invalid vendorId: ${vendorId}`);

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

  const idempotencyKey = `DELIVERED:${vid.toString()}:${soid.toString()}`;

  const wallet = await ensureWallet(vendorId);

  if (hasTxn(wallet, idempotencyKey)) {
    return { ok: true, already: true };
  }

  (wallet as any).balances.hold = toNum((wallet as any).balances.hold, 0) + amount;

  pushTxn(wallet, {
    idempotencyKey,
    vendorId: vid,
    orderId: oid,
    subOrderId: soid,
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
    const vendorIdRaw =
      so?.vendorId && typeof so.vendorId === "object" && so.vendorId._id ? so.vendorId._id : so?.vendorId;

    const vendorId = vendorIdRaw ? String(vendorIdRaw) : "";

    const ownerType = String(so?.ownerType || "").toUpperCase();
    if (!vendorId) continue;
    if (ownerType && ownerType !== "VENDOR") continue;

    const subOrderId = so?._id ? String(so._id) : "";
    if (!subOrderId) continue;

    const subStatus = String(so?.status || orderStatus || "").toUpperCase();

    // ✅ IMPORTANT: vendor amount WITHOUT shipping markup
    const amt = pickVendorSubOrderNet(order, so);

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
        meta: { source: "applyWalletEffectsForOrder", pricing: "without_shipping_markup" },
      });

      results.push({ subOrderId, action: "DELIVERED_HOLD_CREDIT", amount: amt, ...r });
      continue;
    }

    if (subStatus === "CANCELLED") {
      const r = await walletDeductOnCancelled({
        vendorId,
        orderId,
        subOrderId,
        orderCode,
        amount: amt,
        meta: { source: "applyWalletEffectsForOrder", pricing: "without_shipping_markup" },
      });

      results.push({ subOrderId, action: "CANCEL_DEDUCT", amount: amt, ...r });
      continue;
    }
  }

  return results;
}
