"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockDueHoldToAvailable = unlockDueHoldToAvailable;
/* eslint-disable @typescript-eslint/no-explicit-any */
const mongoose_1 = require("mongoose");
const VendorWallet_model_1 = require("../models/VendorWallet.model");
const toNum = (v, fb = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
};
const round2 = (n) => Math.round(n * 100) / 100;
const toObjectId = (id) => {
    try {
        if (!id)
            return null;
        if (id instanceof mongoose_1.Types.ObjectId)
            return id;
        const s = String(id);
        if (mongoose_1.Types.ObjectId.isValid(s))
            return new mongoose_1.Types.ObjectId(s);
        return null;
    }
    catch {
        return null;
    }
};
function normalizeBalances(wallet) {
    wallet.balances = wallet.balances || { hold: 0, available: 0, paid: 0, deduction: 0 };
    wallet.balances.hold = toNum(wallet.balances.hold, 0);
    wallet.balances.available = toNum(wallet.balances.available, 0);
    wallet.balances.paid = toNum(wallet.balances.paid, 0);
    wallet.balances.deduction = toNum(wallet.balances.deduction, 0);
    return wallet.balances;
}
function hasTxn(wallet, idempotencyKey) {
    const txns = Array.isArray(wallet?.transactions) ? wallet.transactions : [];
    return txns.some((t) => String(t?.idempotencyKey) === String(idempotencyKey));
}
function pushTxn(wallet, txn) {
    wallet.transactions = Array.isArray(wallet.transactions) ? wallet.transactions : [];
    wallet.transactions.unshift({ ...txn, createdAt: txn?.createdAt || new Date() });
    wallet.stats = wallet.stats || {};
    wallet.stats.lastTxnAt = new Date();
    const amt = toNum(txn.amount, 0);
    if (txn.direction === "CREDIT")
        wallet.stats.totalCredits = toNum(wallet.stats.totalCredits, 0) + amt;
    if (txn.direction === "DEBIT")
        wallet.stats.totalDebits = toNum(wallet.stats.totalDebits, 0) + amt;
}
async function unlockDueHoldToAvailable(now = new Date()) {
    const wallets = await VendorWallet_model_1.VendorWallet.find({
        "transactions.type": "DELIVERED_HOLD_CREDIT",
        "transactions.status": "HOLD",
    }).exec();
    const out = [];
    for (const wallet of wallets) {
        normalizeBalances(wallet);
        const txns = Array.isArray(wallet.transactions) ? wallet.transactions : [];
        let changed = false;
        for (const txn of txns) {
            if (String(txn?.type) !== "DELIVERED_HOLD_CREDIT")
                continue;
            if (String(txn?.status) !== "HOLD")
                continue;
            const unlockAt = txn?.unlockAt ? new Date(txn.unlockAt) : null;
            if (!unlockAt || unlockAt.getTime() > now.getTime())
                continue;
            const amount = Math.max(0, toNum(txn?.amount, 0));
            if (amount <= 0)
                continue;
            const unlockKey = `UNLOCK:${String(txn?.idempotencyKey || "")}`;
            if (hasTxn(wallet, unlockKey)) {
                txn.status = "AVAILABLE";
                changed = true;
                continue;
            }
            const beforeHold = toNum(wallet.balances.hold, 0);
            const moveAmt = Math.min(beforeHold, amount);
            if (moveAmt <= 0) {
                txn.status = "AVAILABLE";
                changed = true;
                continue;
            }
            wallet.balances.hold = round2(beforeHold - moveAmt);
            wallet.balances.available = round2(toNum(wallet.balances.available, 0) + moveAmt);
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
                walletId: String(wallet._id || ""),
                vendorId: String(wallet.vendorId || ""),
                amount: moveAmt,
                source: String(txn?.idempotencyKey || ""),
            });
            changed = true;
        }
        if (changed) {
            normalizeBalances(wallet);
            await wallet.save();
        }
    }
    return {
        ok: true,
        count: out.length,
        items: out,
    };
}
