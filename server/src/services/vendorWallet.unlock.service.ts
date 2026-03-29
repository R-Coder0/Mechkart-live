/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { VendorWallet } from "../models/VendorWallet.model";

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

function normalizeBalances(wallet: any) {
  wallet.balances = wallet.balances || { hold: 0, available: 0, paid: 0, deduction: 0 };
  wallet.balances.hold = toNum(wallet.balances.hold, 0);
  wallet.balances.available = toNum(wallet.balances.available, 0);
  wallet.balances.paid = toNum(wallet.balances.paid, 0);
  wallet.balances.deduction = toNum(wallet.balances.deduction, 0);
  return wallet.balances;
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

export async function unlockDueHoldToAvailable(now = new Date()) {
  const wallets = await VendorWallet.find({
    "transactions.type": "DELIVERED_HOLD_CREDIT",
    "transactions.status": "HOLD",
  }).exec();

  const out: any[] = [];

  for (const wallet of wallets) {
    normalizeBalances(wallet as any);

    const txns = Array.isArray((wallet as any).transactions) ? (wallet as any).transactions : [];
    let changed = false;

    for (const txn of txns) {
      if (String(txn?.type) !== "DELIVERED_HOLD_CREDIT") continue;
      if (String(txn?.status) !== "HOLD") continue;

      const unlockAt = txn?.unlockAt ? new Date(txn.unlockAt) : null;
      if (!unlockAt || unlockAt.getTime() > now.getTime()) continue;

      const amount = Math.max(0, toNum(txn?.amount, 0));
      if (amount <= 0) continue;

      const unlockKey = `UNLOCK:${String(txn?.idempotencyKey || "")}`;
      if (hasTxn(wallet, unlockKey)) {
        txn.status = "AVAILABLE";
        changed = true;
        continue;
      }

      const beforeHold = toNum((wallet as any).balances.hold, 0);
      const moveAmt = Math.min(beforeHold, amount);
      if (moveAmt <= 0) {
        txn.status = "AVAILABLE";
        changed = true;
        continue;
      }

      (wallet as any).balances.hold = round2(beforeHold - moveAmt);
      (wallet as any).balances.available = round2(toNum((wallet as any).balances.available, 0) + moveAmt);

      txn.status = "AVAILABLE";
      txn.unlockedAt = now;

      pushTxn(wallet, {
        idempotencyKey: unlockKey,
        vendorId: txn?.vendorId ? toObjectId(txn.vendorId) : null,
        orderId: txn?.orderId ? toObjectId(txn.orderId) : null,
        subOrderId: txn?.subOrderId ? toObjectId(txn.subOrderId) : null,
        orderCode: txn?.orderCode || "",

        type: "HOLD_TO_AVAILABLE",
        direction: "CREDIT",
        status: "AVAILABLE",
        amount: moveAmt,
        currency: "INR",

        effectiveAt: now,
        unlockAt: null,

        meta: {
          sourceTxnIdempotencyKey: txn?.idempotencyKey || "",
          sourceType: txn?.type || "",
        },
      });

      out.push({
        walletId: String((wallet as any)._id || ""),
        vendorId: String((wallet as any).vendorId || ""),
        amount: moveAmt,
        source: String(txn?.idempotencyKey || ""),
      });

      changed = true;
    }

    if (changed) {
      normalizeBalances(wallet as any);
      await wallet.save();
    }
  }

  return {
    ok: true,
    count: out.length,
    items: out,
  };
}