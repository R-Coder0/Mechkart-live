"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReturnRequest = exports.createReturnRequest = void 0;
const mongoose_1 = require("mongoose");
const Order_model_1 = require("../../models/Order.model");
const toStr = (v) => String(v ?? "").trim();
const toNum = (v, fb = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
};
const RETURN_WINDOW_DAYS = Number(process.env.RETURN_WINDOW_DAYS || 7);
/* =========================
 * Helpers
 * ========================= */
const idStr = (v) => {
    if (!v)
        return "";
    if (typeof v === "string")
        return v;
    if (v instanceof mongoose_1.Types.ObjectId)
        return String(v);
    if (v?._id)
        return String(v._id);
    return String(v);
};
function isWithinReturnWindow(deliveredAt) {
    if (!deliveredAt)
        return false;
    const t = new Date(deliveredAt).getTime();
    if (!Number.isFinite(t))
        return false;
    const now = Date.now();
    const days = (now - t) / (1000 * 60 * 60 * 24);
    return days <= RETURN_WINDOW_DAYS;
}
function normalizeBankDetails(input) {
    const b = input || {};
    return {
        accountHolderName: toStr(b.accountHolderName),
        accountNumber: toStr(b.accountNumber),
        ifsc: toStr(b.ifsc).toUpperCase(),
        bankName: toStr(b.bankName) || null,
        upiId: toStr(b.upiId) || null,
    };
}
function validateCodBankDetails(bank) {
    if (!bank)
        return "Bank details are required for COD returns.";
    if (!toStr(bank.accountHolderName))
        return "Account holder name is required.";
    if (!toStr(bank.accountNumber))
        return "Account number is required.";
    if (!toStr(bank.ifsc))
        return "IFSC is required.";
    return null;
}
function buildItemMap(subOrders) {
    const map = new Map();
    for (const so of subOrders || []) {
        for (const it of so.items || []) {
            const pid = idStr(it.productId);
            const vid = it.variantId ? idStr(it.variantId) : "";
            const ck = it.colorKey ? toStr(it.colorKey).toLowerCase() : "";
            const key = `${pid}__${vid}__${ck}`;
            if (!map.has(key)) {
                map.set(key, { subOrder: so, orderedQty: 0, returnedQty: 0 });
            }
            map.get(key).orderedQty += Math.max(1, toNum(it.qty, 1));
            for (const ret of so.returns || []) {
                if (ret.status === "REJECTED")
                    continue;
                for (const rit of ret.items || []) {
                    const rpid = idStr(rit.productId);
                    const rvid = rit.variantId ? idStr(rit.variantId) : "";
                    const rck = rit.colorKey ? toStr(rit.colorKey).toLowerCase() : "";
                    const rkey = `${rpid}__${rvid}__${rck}`;
                    if (rkey === key) {
                        map.get(key).returnedQty += Math.max(0, toNum(rit.qty, 0));
                    }
                }
            }
        }
    }
    return map;
}
function parseItems(rawItems) {
    if (Array.isArray(rawItems))
        return rawItems;
    if (typeof rawItems === "string" && rawItems.trim()) {
        try {
            const parsed = JSON.parse(rawItems);
            return Array.isArray(parsed) ? parsed : [];
        }
        catch {
            return null;
        }
    }
    return [];
}
function parseBankDetails(raw) {
    if (!raw)
        return null;
    if (typeof raw === "string" && raw.trim()) {
        try {
            return JSON.parse(raw);
        }
        catch {
            return "__INVALID__";
        }
    }
    return raw;
}
/* =========================
 * Return item snapshot helpers
 * ========================= */
function findSubOrderItemByKey(subOrder, pid, vid, ck) {
    const list = Array.isArray(subOrder?.items) ? subOrder.items : [];
    return list.find((it) => {
        const xpid = idStr(it?.productId);
        const xvid = it?.variantId ? idStr(it.variantId) : "";
        const xck = it?.colorKey ? toStr(it.colorKey).toLowerCase() : "";
        return xpid === pid && xvid === vid && xck === ck;
    });
}
function pickFirstNonEmpty(...vals) {
    for (const v of vals) {
        const s = toStr(v);
        if (s)
            return s;
    }
    return "";
}
function pickFirstImage(...vals) {
    for (const v of vals) {
        if (Array.isArray(v)) {
            const first = v.find((x) => toStr(x));
            if (first)
                return toStr(first);
            continue;
        }
        const s = toStr(v);
        if (s)
            return s;
    }
    return "";
}
function findVariantSnapshot(productObj, variantId) {
    if (!productObj || !variantId)
        return null;
    const arr = Array.isArray(productObj?.variants) ? productObj.variants : [];
    return arr.find((x) => String(x?._id) === String(variantId)) || null;
}
function findColorSnapshot(productObj, colorKey) {
    if (!productObj || !colorKey)
        return null;
    const arr = Array.isArray(productObj?.colors) ? productObj.colors : [];
    return (arr.find((x) => toStr(x?.name).toLowerCase() === toStr(colorKey).toLowerCase()) ||
        null);
}
function pickReturnItemSnapshot(orderItem) {
    const productObj = orderItem?.productId && typeof orderItem.productId === "object"
        ? orderItem.productId
        : orderItem?.product && typeof orderItem.product === "object"
            ? orderItem.product
            : null;
    const variantObj = (orderItem?.variantId && typeof orderItem.variantId === "object" ? orderItem.variantId : null) ||
        orderItem?.selectedVariant ||
        findVariantSnapshot(productObj, orderItem?.variantId);
    const colorObj = findColorSnapshot(productObj, orderItem?.colorKey);
    const qty = Math.max(1, toNum(orderItem?.qty, 1));
    const title = pickFirstNonEmpty(orderItem?.title, orderItem?.name, orderItem?.productTitle, orderItem?.productName, orderItem?.snapshot?.title, orderItem?.snapshot?.name, productObj?.title, productObj?.name);
    const productCode = pickFirstNonEmpty(orderItem?.productCode, orderItem?.sku, orderItem?.code, orderItem?.productSku, orderItem?.snapshot?.productCode, orderItem?.snapshot?.sku, productObj?.productCode, productObj?.sku);
    const image = pickFirstImage(orderItem?.image, orderItem?.featureImage, orderItem?.snapshot?.image, orderItem?.selectedVariant?.image, orderItem?.selectedVariant?.images, colorObj?.images, variantObj?.images, productObj?.featureImage, productObj?.galleryImages);
    const variantLabel = pickFirstNonEmpty(orderItem?.variantLabel, orderItem?.variantName, orderItem?.variantText, orderItem?.variantSnapshot?.label, orderItem?.variantSnapshot?.comboText, orderItem?.variantSnapshot?.size, orderItem?.variantSnapshot?.weight, orderItem?.selectedVariant?.label, orderItem?.selectedVariant?.comboText, orderItem?.selectedVariant?.size, orderItem?.selectedVariant?.weight, variantObj?.label, variantObj?.comboText, variantObj?.size, variantObj?.weight);
    const unitPrice = toNum(orderItem?.finalUnitPrice, NaN) ||
        toNum(orderItem?.unitFinalPrice, NaN) ||
        toNum(orderItem?.finalPrice, NaN) ||
        toNum(orderItem?.salePrice, NaN) ||
        toNum(orderItem?.price, NaN) ||
        toNum(orderItem?.unitPrice, NaN) ||
        toNum(orderItem?.pricingMeta?.finalUnitPrice, NaN) ||
        toNum(orderItem?.pricingMeta?.salePrice, NaN) ||
        toNum(orderItem?.pricingMeta?.baseSalePrice, NaN) ||
        0;
    const finalLineTotal = toNum(orderItem?.finalLineTotal, NaN) ||
        toNum(orderItem?.lineTotal, NaN) ||
        toNum(orderItem?.baseLineTotal, NaN) ||
        toNum(orderItem?.amount, NaN) ||
        (unitPrice > 0 ? unitPrice * qty : 0);
    return {
        title: title || null,
        productCode: productCode || null,
        image: image || null,
        variantLabel: variantLabel || null,
        unitPrice: unitPrice || 0,
        finalLineTotal: finalLineTotal || 0,
    };
}
/* =========================
 * POST Return Request (Vendor-wise split)
 * ========================= */
// POST /api/users/orders/:orderId/return-request
const createReturnRequest = async (req, res) => {
    try {
        const userId = req?.user?._id;
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const { orderId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(orderId))
            return res.status(400).json({ message: "Invalid orderId" });
        const reason = toStr(req.body?.reason);
        const note = toStr(req.body?.note);
        if (!reason)
            return res.status(400).json({ message: "Return reason is required" });
        const order = await Order_model_1.Order.findOne({
            _id: new mongoose_1.Types.ObjectId(orderId),
            userId: new mongoose_1.Types.ObjectId(String(userId)),
        });
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        if (!Array.isArray(order.subOrders) || !order.subOrders.length)
            return res.status(400).json({ message: "Invalid order structure" });
        const rawItems = req.body?.items;
        const bodyItems = parseItems(rawItems);
        if (bodyItems === null) {
            return res.status(400).json({ message: "Invalid items format" });
        }
        if (!bodyItems.length) {
            return res
                .status(400)
                .json({ message: "Select at least one item for return" });
        }
        const itemMap = buildItemMap(order.subOrders);
        const vendorBuckets = new Map();
        for (const r of bodyItems) {
            const pid = idStr(r?.productId);
            const vid = r?.variantId ? idStr(r.variantId) : "";
            const ck = r?.colorKey ? toStr(r.colorKey).toLowerCase() : "";
            if (!pid || !mongoose_1.Types.ObjectId.isValid(pid)) {
                return res.status(400).json({ message: "Invalid return item" });
            }
            const key = `${pid}__${vid}__${ck}`;
            const entry = itemMap.get(key);
            if (!entry)
                return res.status(400).json({ message: "Invalid return item" });
            const availableQty = entry.orderedQty - entry.returnedQty;
            const reqQty = Math.max(1, toNum(r?.qty, 1));
            if (reqQty > availableQty)
                return res
                    .status(400)
                    .json({ message: "Return qty exceeds allowed qty" });
            const soId = String(entry.subOrder._id);
            if (!vendorBuckets.has(soId))
                vendorBuckets.set(soId, []);
            const matchedOrderItem = findSubOrderItemByKey(entry.subOrder, pid, vid, ck);
            const snap = matchedOrderItem ? pickReturnItemSnapshot(matchedOrderItem) : null;
            const unitPrice = snap?.unitPrice || 0;
            const lineTotal = snap?.finalLineTotal && reqQty > 0 && matchedOrderItem?.qty
                ? (snap.finalLineTotal / Math.max(1, toNum(matchedOrderItem.qty, 1))) * reqQty
                : unitPrice > 0
                    ? unitPrice * reqQty
                    : 0;
            vendorBuckets.get(soId).push({
                productId: new mongoose_1.Types.ObjectId(pid),
                qty: reqQty,
                variantId: vid && mongoose_1.Types.ObjectId.isValid(vid) ? new mongoose_1.Types.ObjectId(vid) : null,
                colorKey: ck || null,
                title: snap?.title || null,
                productCode: snap?.productCode || null,
                image: snap?.image || null,
                variantLabel: snap?.variantLabel || null,
                unitPrice: unitPrice || 0,
                finalLineTotal: lineTotal || 0,
            });
        }
        const pm = String(order.paymentMethod || "").toUpperCase();
        let bankDetails = null;
        if (pm === "COD") {
            const parsed = parseBankDetails(req.body?.bankDetails);
            if (parsed === "__INVALID__") {
                return res.status(400).json({ message: "Invalid bankDetails format" });
            }
            bankDetails = normalizeBankDetails(parsed);
            const bankErr = validateCodBankDetails(bankDetails);
            if (bankErr)
                return res.status(400).json({ message: bankErr });
        }
        for (const [soId, items] of vendorBuckets.entries()) {
            const subOrder = order.subOrders.id(soId);
            if (!subOrder)
                return res.status(400).json({ message: "SubOrder not found" });
            if (subOrder.status !== "DELIVERED")
                return res
                    .status(400)
                    .json({ message: "Only delivered items can be returned" });
            const deliveredAt = subOrder.shipment?.updatedAt || order.updatedAt;
            if (!isWithinReturnWindow(deliveredAt))
                return res.status(400).json({ message: "Return window expired" });
            const active = (subOrder.returns || []).find((r) => r.status !== "REJECTED" && r.status !== "REFUNDED");
            if (active)
                return res.status(409).json({
                    message: "Return already active for this vendor",
                });
            subOrder.returns.push({
                requestedAt: new Date(),
                reason,
                note: note || null,
                images: [],
                bankDetails: bankDetails || null,
                items,
                status: "REQUESTED",
                handledByRole: null,
                handledById: null,
                approvedAt: null,
                rejectedAt: null,
                rejectReason: null,
                receivedAt: null,
                returnShipment: null,
            });
        }
        await order.save();
        return res.json({ message: "Return request submitted successfully" });
    }
    catch (err) {
        console.error("createReturnRequest error:", err);
        return res.status(500).json({
            message: "Return request failed",
            error: err?.message || "Unknown error",
        });
    }
};
exports.createReturnRequest = createReturnRequest;
/* =========================
 * GET Return Requests (User View)
 * ========================= */
// GET /api/users/orders/:orderId/return-request
const getReturnRequest = async (req, res) => {
    try {
        const userId = req?.user?._id;
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const { orderId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(orderId))
            return res.status(400).json({ message: "Invalid orderId" });
        const order = await Order_model_1.Order.findOne({
            _id: new mongoose_1.Types.ObjectId(orderId),
            userId: new mongoose_1.Types.ObjectId(String(userId)),
        }, {
            subOrders: 1,
            orderCode: 1,
            paymentMethod: 1,
            status: 1,
            updatedAt: 1,
            createdAt: 1,
        }).lean();
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        return res.json({
            message: "Return requests",
            data: order.subOrders || [],
        });
    }
    catch (err) {
        console.error("getReturnRequest error:", err);
        return res.status(500).json({
            message: "Failed",
            error: err?.message || "Unknown error",
        });
    }
};
exports.getReturnRequest = getReturnRequest;
