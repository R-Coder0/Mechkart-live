"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletCreditHoldOnDelivered = walletCreditHoldOnDelivered;
exports.walletDeductOnCancelled = walletDeductOnCancelled;
exports.walletDeductOnReturned = walletDeductOnReturned;
exports.applyWalletEffectsForOrder = applyWalletEffectsForOrder;
/* eslint-disable @typescript-eslint/no-explicit-any */
const mongoose_1 = require("mongoose");
const VendorWallet_model_1 = require("../models/VendorWallet.model");
// ---------- utils ----------
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
const idStr = (v) => {
    if (!v)
        return "";
    if (typeof v === "string")
        return v;
    if (v instanceof mongoose_1.Types.ObjectId)
        return String(v);
    if (typeof v === "object" && v._id)
        return String(v._id);
    return String(v);
};
const strLower = (v) => String(v ?? "").trim().toLowerCase();
/** =========================
 * ✅ Shipping Markup
 * Rule:
 * - 500gm ya usse kam => 60
 * - uske baad har 500gm => +30
 * ========================= */
const calcShippingMarkup = (weightKg) => {
    const w = Number(weightKg || 0);
    if (!Number.isFinite(w) || w <= 0)
        return 0;
    if (w <= 0.5)
        return 60;
    const extraWeight = w - 0.5;
    const extraSlabs = Math.ceil(extraWeight / 0.5);
    return 60 + extraSlabs * 30;
};
function getItemShippingMarkupPerUnit(it) {
    const ownerType = String(it?.ownerType || "").toUpperCase();
    if (ownerType && ownerType !== "VENDOR")
        return 0;
    const wKg = toNum(it?.ship?.weightKg, NaN) ||
        toNum(it?.shipSnapshot?.weightKg, NaN) ||
        toNum(it?.pricingMeta?.weightKg, NaN) ||
        0;
    return calcShippingMarkup(wKg);
}
/**
 * Compute vendor-earning for one item:
 * - salePrice = payable (base + shippingMarkup)
 * - vendor earning = base only
 * - offer discount allocated proportionally on base
 */
function computeVendorNetForItem(it) {
    const qty = Math.max(1, toNum(it?.qty, 1));
    const payableUnit = toNum(it?.salePrice, NaN) ||
        toNum(it?.unitPrice, NaN) ||
        toNum(it?.price, 0);
    const payableLine = Math.max(0, round2(payableUnit * qty));
    const shipMarkupUnit = getItemShippingMarkupPerUnit(it);
    const shipMarkupLine = Math.max(0, round2(shipMarkupUnit * qty));
    const baseLine = Math.max(0, round2(payableLine - shipMarkupLine));
    const offerDiscount = Math.max(0, toNum(it?.offerDiscount, 0));
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
function pickVendorSubOrderAmounts(_order, so) {
    const items = Array.isArray(so?.items) ? so.items : [];
    if (!items.length) {
        return {
            vendorNet: 0,
            shipping: 0,
            payable: 0,
        };
    }
    return items.reduce((acc, it) => {
        const ownerType = String(it?.ownerType || so?.ownerType || "").toUpperCase();
        if (ownerType && ownerType !== "VENDOR")
            return acc;
        const r = computeVendorNetForItem(it);
        acc.vendorNet += r.vendorNet;
        acc.shipping += r.shipMarkupLine;
        acc.payable += r.payableLine;
        return acc;
    }, { vendorNet: 0, shipping: 0, payable: 0 });
}
function normalizeBalances(wallet) {
    wallet.balances = wallet.balances || { hold: 0, available: 0, paid: 0, deduction: 0 };
    wallet.balances.hold = toNum(wallet.balances.hold, 0);
    wallet.balances.available = toNum(wallet.balances.available, 0);
    wallet.balances.paid = toNum(wallet.balances.paid, 0);
    wallet.balances.deduction = toNum(wallet.balances.deduction, 0);
    return wallet.balances;
}
// ---------- wallet core ----------
async function ensureWallet(vendorId) {
    const vid = toObjectId(vendorId);
    if (!vid)
        throw new Error(`Invalid vendorId: ${vendorId}`);
    let w = await VendorWallet_model_1.VendorWallet.findOne({ vendorId: vid }).exec();
    if (!w) {
        w = await VendorWallet_model_1.VendorWallet.create({
            vendorId: vid,
            balances: { hold: 0, available: 0, paid: 0, deduction: 0 },
            transactions: [],
            stats: { totalCredits: 0, totalDebits: 0, lastTxnAt: new Date() },
        });
    }
    normalizeBalances(w);
    return w;
}
function hasTxn(wallet, idempotencyKey) {
    const txns = Array.isArray(wallet?.transactions) ? wallet.transactions : [];
    return txns.some((t) => String(t?.idempotencyKey) === String(idempotencyKey));
}
function pushTxn(wallet, txn) {
    wallet.transactions = Array.isArray(wallet.transactions) ? wallet.transactions : [];
    wallet.transactions.unshift({
        ...txn,
        createdAt: txn?.createdAt || new Date(),
    });
    wallet.stats = wallet.stats || {};
    wallet.stats.lastTxnAt = new Date();
    const amt = toNum(txn.amount, 0);
    if (txn.direction === "CREDIT")
        wallet.stats.totalCredits = toNum(wallet.stats.totalCredits, 0) + amt;
    if (txn.direction === "DEBIT")
        wallet.stats.totalDebits = toNum(wallet.stats.totalDebits, 0) + amt;
}
// STEP-1: DELIVERED => HOLD CREDIT
async function walletCreditHoldOnDelivered(opts) {
    const { vendorId, orderId, subOrderId } = opts;
    const amount = Math.max(0, toNum(opts.amount, 0));
    if (!vendorId || !orderId || !subOrderId)
        return { ok: false, reason: "missing_ids" };
    if (amount <= 0)
        return { ok: false, reason: "amount_zero" };
    const vid = toObjectId(vendorId);
    const oid = toObjectId(orderId);
    const soid = toObjectId(subOrderId);
    if (!vid || !oid || !soid)
        return { ok: false, reason: "invalid_objectid" };
    const idempotencyKey = `DELIVERED:${vid.toString()}:${soid.toString()}`;
    const wallet = await ensureWallet(vendorId);
    normalizeBalances(wallet);
    if (hasTxn(wallet, idempotencyKey)) {
        return { ok: true, already: true };
    }
    wallet.balances.hold = round2(toNum(wallet.balances.hold, 0) + amount);
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
        currency: "INR",
        effectiveAt: opts.deliveredAt || new Date(),
        unlockAt: opts.unlockAt || new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        meta: opts.meta || {},
    });
    await wallet.save();
    return { ok: true };
}
async function reverseVendorAmountAndAddDeduction(opts) {
    const { vendorId, orderId, subOrderId } = opts;
    const amount = Math.max(0, toNum(opts.amount, 0));
    const deductionAmount = Math.max(0, toNum(opts.deductionAmount, 0));
    if (!vendorId || !orderId || !subOrderId)
        return { ok: false, reason: "missing_ids" };
    if (amount <= 0 && deductionAmount <= 0)
        return { ok: false, reason: "amount_zero" };
    const vid = toObjectId(vendorId);
    const oid = toObjectId(orderId);
    const soid = toObjectId(subOrderId);
    if (!vid || !oid || !soid)
        return { ok: false, reason: "invalid_objectid" };
    const wallet = await ensureWallet(vendorId);
    normalizeBalances(wallet);
    if (hasTxn(wallet, opts.idempotencyKey)) {
        return { ok: true, already: true };
    }
    let fromHold = 0;
    let shortfall = 0;
    const beforeHold = toNum(wallet.balances.hold, 0);
    if (amount > 0) {
        fromHold = Math.min(beforeHold, amount);
        wallet.balances.hold = round2(beforeHold - fromHold);
        shortfall = round2(amount - fromHold);
    }
    if (deductionAmount > 0) {
        wallet.balances.deduction = round2(toNum(wallet.balances.deduction, 0) + deductionAmount);
    }
    pushTxn(wallet, {
        idempotencyKey: opts.idempotencyKey,
        vendorId: vid,
        orderId: oid,
        subOrderId: soid,
        orderCode: opts.orderCode || "",
        type: opts.type,
        direction: "DEBIT",
        status: "REVERSED",
        amount: round2(amount),
        currency: "INR",
        effectiveAt: new Date(),
        unlockAt: null,
        meta: {
            vendorReverseAmount: amount,
            deductionAmount,
            fromHold,
            shortfall,
            ...(opts.meta || {}),
        },
    });
    await wallet.save();
    return {
        ok: true,
        meta: {
            fromHold,
            shortfall,
            deductionAdded: deductionAmount,
        },
    };
}
// CANCELLED => base reverse only. Shipping is not charged to vendor because the order was not delivered.
async function walletDeductOnCancelled(opts) {
    const vid = toObjectId(opts.vendorId);
    const soid = toObjectId(opts.subOrderId);
    if (!vid || !soid)
        return { ok: false, reason: "invalid_objectid" };
    return reverseVendorAmountAndAddDeduction({
        vendorId: opts.vendorId,
        orderId: opts.orderId,
        subOrderId: opts.subOrderId,
        orderCode: opts.orderCode,
        amount: opts.amount,
        deductionAmount: 0,
        idempotencyKey: `CANCEL:${vid.toString()}:${soid.toString()}`,
        type: "CANCEL_DEDUCT",
        meta: opts.meta,
    });
}
// RETURNED => base reverse + shipping deduction add
async function walletDeductOnReturned(opts) {
    const vid = toObjectId(opts.vendorId);
    const soid = toObjectId(opts.subOrderId);
    const rid = toObjectId(opts.returnId);
    if (!vid || !soid || !rid)
        return { ok: false, reason: "invalid_objectid" };
    return reverseVendorAmountAndAddDeduction({
        vendorId: opts.vendorId,
        orderId: opts.orderId,
        subOrderId: opts.subOrderId,
        orderCode: opts.orderCode,
        amount: opts.amount,
        deductionAmount: opts.deductionAmount || 0,
        idempotencyKey: `RETURN:${vid.toString()}:${soid.toString()}:${rid.toString()}`,
        type: "RETURN_DEDUCT",
        meta: {
            returnId: rid,
            ...(opts.meta || {}),
        },
    });
}
function isReturnApprovedLike(ret, subOrder) {
    const st = String(ret?.status || ret?.returnStatus || "").toUpperCase();
    const refundSt = String(ret?.refundStatus || subOrder?.refund?.status || "").toUpperCase();
    return (st === "APPROVED" ||
        st === "RECEIVED" ||
        st === "RETURN_APPROVED" ||
        st === "REFUND_APPROVED" ||
        st === "REFUNDED" ||
        refundSt === "APPROVED" ||
        refundSt === "PROCESSED" ||
        refundSt === "REFUNDED");
}
function pickReturnItems(ret, subOrder) {
    if (Array.isArray(ret?.items) && ret.items.length)
        return ret.items;
    if (Array.isArray(ret?.products) && ret.products.length)
        return ret.products;
    if (Array.isArray(ret?.returnItems) && ret.returnItems.length)
        return ret.returnItems;
    if (!ret?.items && !ret?.products && !ret?.returnItems) {
        if (Array.isArray(subOrder?.items) && subOrder.items.length)
            return subOrder.items;
    }
    return [];
}
function findMatchingSubOrderItem(subOrder, raw) {
    const items = Array.isArray(subOrder?.items) ? subOrder.items : [];
    if (!items.length)
        return null;
    const rawPid = idStr(raw?.productId);
    const rawVid = idStr(raw?.variantId);
    const rawCk = strLower(raw?.colorKey);
    let found = items.find((it) => {
        return (rawPid &&
            idStr(it?.productId) === rawPid &&
            idStr(it?.variantId) === rawVid &&
            strLower(it?.colorKey) === rawCk);
    });
    if (found)
        return found;
    found = items.find((it) => {
        return rawPid && idStr(it?.productId) === rawPid && idStr(it?.variantId) === rawVid;
    });
    if (found)
        return found;
    found = items.find((it) => {
        return rawPid && idStr(it?.productId) === rawPid;
    });
    if (found)
        return found;
    return null;
}
function buildReturnComputeItem(raw, matchedOrderItem, subOrder) {
    const source = matchedOrderItem || raw || {};
    const orderQty = Math.max(1, toNum(source?.qty, 1));
    const returnQty = Math.max(1, toNum(raw?.qty, NaN) ||
        toNum(raw?.quantity, NaN) ||
        toNum(raw?.returnQty, NaN) ||
        1);
    const safeQty = Math.min(orderQty, returnQty);
    return {
        ...source,
        qty: safeQty,
        ownerType: source?.ownerType || subOrder?.ownerType || "VENDOR",
        productId: source?.productId || raw?.productId,
        variantId: source?.variantId || raw?.variantId,
        colorKey: source?.colorKey || raw?.colorKey,
        salePrice: toNum(source?.salePrice, NaN) ||
            toNum(source?.unitPrice, NaN) ||
            toNum(source?.price, NaN) ||
            toNum(raw?.salePrice, NaN) ||
            toNum(raw?.unitPrice, NaN) ||
            toNum(raw?.price, 0),
        price: toNum(source?.price, NaN) ||
            toNum(source?.unitPrice, NaN) ||
            toNum(source?.salePrice, NaN) ||
            toNum(raw?.price, NaN) ||
            toNum(raw?.unitPrice, NaN) ||
            toNum(raw?.salePrice, 0),
        unitPrice: toNum(source?.unitPrice, NaN) ||
            toNum(source?.salePrice, NaN) ||
            toNum(source?.price, NaN) ||
            toNum(raw?.unitPrice, NaN) ||
            toNum(raw?.salePrice, NaN) ||
            toNum(raw?.price, 0),
        offerDiscount: toNum(source?.offerDiscount, NaN) ||
            toNum(raw?.offerDiscount, NaN) ||
            0,
        ship: source?.ship || raw?.ship,
        shipSnapshot: source?.shipSnapshot || raw?.shipSnapshot,
        pricingMeta: source?.pricingMeta || raw?.pricingMeta,
    };
}
function computeReturnAmountsFromReturn(ret, so) {
    const items = pickReturnItems(ret, so);
    if (!items.length)
        return { vendorNet: 0, shipping: 0, payable: 0 };
    return items.reduce((acc, raw) => {
        const matchedOrderItem = findMatchingSubOrderItem(so, raw);
        const it = buildReturnComputeItem(raw, matchedOrderItem, so);
        const r = computeVendorNetForItem(it);
        acc.vendorNet += r.vendorNet;
        acc.shipping += r.shipMarkupLine;
        acc.payable += r.payableLine;
        return acc;
    }, { vendorNet: 0, shipping: 0, payable: 0 });
}
// helper: apply wallet effects for an order (process vendor subOrders only)
async function applyWalletEffectsForOrder(order) {
    const subOrders = Array.isArray(order?.subOrders) ? order.subOrders : [];
    const orderId = String(order?._id || "");
    const orderCode = String(order?.orderCode || "");
    const orderStatus = String(order?.status || "").toUpperCase();
    const results = [];
    for (const so of subOrders) {
        const vendorIdRaw = so?.vendorId && typeof so.vendorId === "object" && so.vendorId._id ? so.vendorId._id : so?.vendorId;
        const vendorId = vendorIdRaw ? String(vendorIdRaw) : "";
        const ownerType = String(so?.ownerType || "").toUpperCase();
        if (!vendorId)
            continue;
        if (ownerType && ownerType !== "VENDOR")
            continue;
        const subOrderId = so?._id ? String(so._id) : "";
        if (!subOrderId)
            continue;
        const subStatus = String(so?.status || orderStatus || "").toUpperCase();
        const amounts = pickVendorSubOrderAmounts(order, so);
        const vendorAmt = round2(amounts.vendorNet);
        const shippingAmt = round2(amounts.shipping);
        // 1) returns first
        const returns = Array.isArray(so?.returns) ? so.returns : [];
        let hasApprovedReturn = false;
        for (const ret of returns) {
            if (!isReturnApprovedLike(ret, so))
                continue;
            hasApprovedReturn = true;
            const returnId = ret?._id ? String(ret._id) : "";
            if (!returnId)
                continue;
            const retAmounts = computeReturnAmountsFromReturn(ret, so);
            const returnVendorAmt = round2(retAmounts.vendorNet);
            const returnShippingAmt = round2(retAmounts.shipping);
            if (returnVendorAmt <= 0 && returnShippingAmt <= 0) {
                results.push({
                    subOrderId,
                    returnId,
                    action: "RETURN_DEDUCT_SKIPPED",
                    reason: "return_amount_zero",
                    returnStatus: String(ret?.status || ret?.returnStatus || ""),
                });
                continue;
            }
            const r = await walletDeductOnReturned({
                vendorId,
                orderId,
                subOrderId,
                returnId,
                orderCode,
                amount: returnVendorAmt,
                deductionAmount: returnShippingAmt,
                meta: {
                    source: "applyWalletEffectsForOrder",
                    pricing: "without_shipping_markup",
                    shippingAmount: returnShippingAmt,
                    payableAmount: round2(retAmounts.payable),
                    returnStatus: String(ret?.status || ret?.returnStatus || ""),
                    refundStatus: String(ret?.refundStatus || so?.refund?.status || ""),
                },
            });
            results.push({
                subOrderId,
                returnId,
                action: "RETURN_DEDUCT",
                amount: returnVendorAmt,
                deductionAmount: returnShippingAmt,
                ...r,
            });
        }
        // approved/refunded return ho chuka hai to delivered credit dobara mat chalao
        if (hasApprovedReturn) {
            continue;
        }
        // 2) cancelled
        if (subStatus === "CANCELLED") {
            const r = await walletDeductOnCancelled({
                vendorId,
                orderId,
                subOrderId,
                orderCode,
                amount: vendorAmt,
                deductionAmount: 0,
                meta: {
                    source: "applyWalletEffectsForOrder",
                    pricing: "without_shipping_markup",
                    shippingAmount: shippingAmt,
                    shippingDeductionAmount: 0,
                    payableAmount: round2(amounts.payable),
                },
            });
            results.push({
                subOrderId,
                action: "CANCEL_DEDUCT",
                amount: vendorAmt,
                deductionAmount: 0,
                ...r,
            });
            continue;
        }
        // 3) delivered
        if (subStatus === "DELIVERED") {
            const deliveredAt = order?.updatedAt ? new Date(order.updatedAt) : new Date();
            const unlockAt = new Date(deliveredAt.getTime() + 10 * 24 * 60 * 60 * 1000);
            const r = await walletCreditHoldOnDelivered({
                vendorId,
                orderId,
                subOrderId,
                orderCode,
                amount: vendorAmt,
                deliveredAt,
                unlockAt,
                meta: {
                    source: "applyWalletEffectsForOrder",
                    pricing: "without_shipping_markup",
                    shippingAmount: shippingAmt,
                    payableAmount: round2(amounts.payable),
                },
            });
            results.push({
                subOrderId,
                action: "DELIVERED_HOLD_CREDIT",
                amount: vendorAmt,
                ...r,
            });
            continue;
        }
    }
    return results;
}
