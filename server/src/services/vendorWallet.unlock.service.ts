/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { VendorWallet } from "../models/VendorWallet.model";

const toNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const isObjId = (v: any) => v instanceof Types.ObjectId;

function toObjectId(v: any) {
  try {
    if (!v) return null;
    if (isObjId(v)) return v as Types.ObjectId;
    const s = String(v);
    if (Types.ObjectId.isValid(s)) return new Types.ObjectId(s);
    return null;
  } catch {
    return null;
  }
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
 * Unlock all due HOLD credits -> move to AVAILABLE
 * - find wallets with due txns (transactions.status=HOLD, unlockAt<=now, type=DELIVERED_HOLD_CREDIT)
 * - per wallet: sum due amounts, balances.hold -= sum, balances.available += sum
 * - mark original txns status=AVAILABLE (optional but useful)
 * - add log txn: HOLD_TO_AVAILABLE (idempotent)
 */
export async function unlockDueHoldToAvailable(opts?: {
  limit?: number;          // how many wallets to process per run
  vendorId?: string;       // optional single vendor
  now?: Date;              // injectable for testing
}) {
  const limit = Math.max(1, Math.min(500, Number(opts?.limit ?? 100)));
  const now = opts?.now ?? new Date();

  const vendorObjId = opts?.vendorId ? toObjectId(opts.vendorId) : null;
  if (opts?.vendorId && !vendorObjId) throw new Error("Invalid vendorId");

  const filter: any = {
    "transactions.type": "DELIVERED_HOLD_CREDIT",
    "transactions.status": "HOLD",
    "transactions.unlockAt": { $lte: now },
  };
  if (vendorObjId) filter.vendorId = vendorObjId;

  // We fetch wallets, then process txns inside (safe + simple).
  const wallets = await VendorWallet.find(filter).limit(limit).exec();

  const out = {
    processedWallets: 0,
    unlockedTxns: 0,
    unlockedAmount: 0,
    perWallet: [] as any[],
  };

  for (const w of wallets) {
    const txns = Array.isArray((w as any).transactions) ? (w as any).transactions : [];

    // due txns = HOLD + unlockAt <= now + DELIVERED_HOLD_CREDIT
    const due = txns.filter((t: any) => {
      if (String(t?.type) !== "DELIVERED_HOLD_CREDIT") return false;
      if (String(t?.status) !== "HOLD") return false;
      if (!t?.unlockAt) return false;
      return new Date(t.unlockAt).getTime() <= now.getTime();
    });

    if (!due.length) continue;

    const walletId = String((w as any)._id);
    const vendorId = String((w as any).vendorId);

    let moved = 0;
    let movedCount = 0;

    for (const t of due) {
      const amt = Math.max(0, toNum(t?.amount, 0));
      if (amt <= 0) continue;

      // idempotency per original delivered txn
      const unlockKey = `UNLOCK:${vendorId}:${String(t?.subOrderId || "")}:${String(t?.idempotencyKey || "")}`;

      if (hasTxn(w, unlockKey)) {
        // already unlocked logged, but still ensure original txn status not HOLD (optional)
        t.status = "AVAILABLE";
        continue;
      }

      moved += amt;
      movedCount += 1;

      // mark original delivered txn as available now
      t.status = "AVAILABLE";

      pushTxn(w, {
        idempotencyKey: unlockKey,
        vendorId: toObjectId((w as any).vendorId),
        orderId: toObjectId(t?.orderId),
        subOrderId: toObjectId(t?.subOrderId),
        orderCode: String(t?.orderCode || ""),

        type: "HOLD_TO_AVAILABLE",
        direction: "CREDIT",
        status: "AVAILABLE",
        amount: amt,

        effectiveAt: now,
        unlockAt: null,

        note: "Hold unlocked to available",
        meta: {
          sourceTxnId: String(t?._id || ""),
          sourceIdempotencyKey: String(t?.idempotencyKey || ""),
        },
      });
    }

    if (moved > 0) {
      (w as any).balances = (w as any).balances || { hold: 0, available: 0, paid: 0 };
      const holdBefore = toNum((w as any).balances.hold, 0);
      const availBefore = toNum((w as any).balances.available, 0);

      // safety: never negative
      const holdAfter = Math.max(0, holdBefore - moved);

      (w as any).balances.hold = holdAfter;
      (w as any).balances.available = availBefore + moved;

      await w.save();

      out.processedWallets += 1;
      out.unlockedTxns += movedCount;
      out.unlockedAmount += moved;
      out.perWallet.push({
        walletId,
        vendorId,
        moved,
        movedCount,
      });
    }
  }

  return out;
}
