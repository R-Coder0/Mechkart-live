/* eslint-disable @typescript-eslint/no-explicit-any */
import { VendorWallet } from "../models/VendorWallet.model";

const toNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

// idempotency for unlock txn
const unlockIdKey = (holdTxnId: any) => `UNLOCK:${String(holdTxnId)}`;

export async function unlockDueHoldToAvailable(opts?: { now?: Date; limit?: number }) {
  const now = opts?.now || new Date();
  const limit = Math.min(500, Math.max(1, Number(opts?.limit || 100)));

  // Find wallets having at least one HOLD txn due
  const wallets = await VendorWallet.find(
    {
      transactions: {
        $elemMatch: {
          status: "HOLD",
          unlockAt: { $ne: null, $lte: now },
          type: "DELIVERED_HOLD_CREDIT",
        },
      },
    },
    { vendorId: 1, balances: 1, transactions: 1, stats: 1 }
  )
    .limit(limit)
    .exec();

  let processedWallets = 0;
  let processedTxns = 0;
  const details: any[] = [];

  for (const w of wallets) {
    const txns = Array.isArray((w as any).transactions) ? (w as any).transactions : [];
    if (!txns.length) continue;

    // already-present unlock txns idempotency set
    const existingKeys = new Set(txns.map((t: any) => String(t?.idempotencyKey || "")));

    let hold = toNum((w as any).balances?.hold, 0);
    let available = toNum((w as any).balances?.available, 0);

    const due = txns.filter(
      (t: any) =>
        String(t?.status) === "HOLD" &&
        String(t?.type) === "DELIVERED_HOLD_CREDIT" &&
        t?.unlockAt &&
        new Date(t.unlockAt).getTime() <= now.getTime()
    );

    if (!due.length) continue;

    let changed = false;
    const moved: any[] = [];

    for (const ht of due) {
      const amt = Math.max(0, toNum(ht?.amount, 0));
      if (amt <= 0) continue;

      const key = unlockIdKey(ht?._id);
      if (existingKeys.has(key)) continue; // already unlocked earlier

      // move balances
      hold = Math.max(0, hold - amt);
      available = available + amt;

      // mark original hold txn as AVAILABLE (optional but useful)
      ht.status = "AVAILABLE";

      // push an unlock txn (AVAILABLE)
      txns.unshift({
        vendorId: (w as any).vendorId,
        orderId: ht?.orderId || null,
        subOrderId: ht?.subOrderId || null,
        orderCode: ht?.orderCode || "",
        type: "HOLD_TO_AVAILABLE",
        status: "AVAILABLE",
        amount: amt,
        direction: "CREDIT",
        currency: ht?.currency || "INR",
        effectiveAt: now,
        unlockAt: null,
        idempotencyKey: key,
        note: "Hold unlocked to available",
        meta: { fromHoldTxnId: String(ht?._id || "") },
      });

      existingKeys.add(key);
      changed = true;
      processedTxns += 1;
      moved.push({ holdTxnId: String(ht?._id || ""), amount: amt, orderCode: ht?.orderCode || "" });
    }

    if (!changed) continue;

    (w as any).balances = (w as any).balances || {};
    (w as any).balances.hold = hold;
    (w as any).balances.available = available;

    (w as any).stats = (w as any).stats || {};
    (w as any).stats.lastTxnAt = now;

    // keep transactions array updated
    (w as any).transactions = txns;

    await w.save();
    processedWallets += 1;

    details.push({ vendorId: String((w as any).vendorId), movedCount: moved.length, moved });
  }

  return { ok: true, now, processedWallets, processedTxns, details };
}
