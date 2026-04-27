"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRejectReturn = exports.adminApproveReturn = exports.adminListReturnRequests = void 0;
const mongoose_1 = require("mongoose");
const Order_model_1 = require("../../models/Order.model");
const vendorWallet_service_1 = require("../../services/vendorWallet.service");
const toStr = (v) => String(v ?? "").trim();
const toNum = (v, fb = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
};
const RETURN_STATUSES = [
    "REQUESTED",
    "APPROVED",
    "REJECTED",
    "PICKUP_CREATED",
    "RECEIVED",
    "REFUNDED",
];
function isValidReturnStatus(s) {
    return RETURN_STATUSES.includes(s);
}
function oid(v) {
    return mongoose_1.Types.ObjectId.isValid(String(v)) ? new mongoose_1.Types.ObjectId(String(v)) : null;
}
function idStr(v) {
    if (!v)
        return "";
    if (typeof v === "string")
        return v;
    if (v instanceof mongoose_1.Types.ObjectId)
        return String(v);
    if (v?._id)
        return String(v._id);
    return String(v);
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
function findSubOrderItemByKey(subOrder, pid, vid, ck) {
    const list = Array.isArray(subOrder?.items) ? subOrder.items : [];
    return list.find((it) => {
        const xpid = idStr(it?.productId);
        const xvid = it?.variantId ? idStr(it?.variantId) : "";
        const xck = it?.colorKey ? toStr(it.colorKey).toLowerCase() : "";
        return xpid === pid && xvid === vid && xck === ck;
    });
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
function buildSnapshotFromOrderItem(orderItem) {
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
    const title = pickFirstNonEmpty(orderItem?.title, orderItem?.name, orderItem?.productTitle, orderItem?.productName, orderItem?.snapshot?.title, productObj?.title, productObj?.name);
    const productCode = pickFirstNonEmpty(orderItem?.productCode, orderItem?.sku, orderItem?.code, orderItem?.productSku, orderItem?.snapshot?.productCode, productObj?.productCode, productObj?.sku);
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
function hydrateReturnItem(subOrder, rit) {
    const pid = idStr(rit?.productId);
    const vid = rit?.variantId ? idStr(rit?.variantId) : "";
    const ck = rit?.colorKey ? toStr(rit.colorKey).toLowerCase() : "";
    const matchedOrderItem = findSubOrderItemByKey(subOrder, pid, vid, ck);
    const orderSnap = matchedOrderItem ? buildSnapshotFromOrderItem(matchedOrderItem) : null;
    const qty = Math.max(1, toNum(rit?.qty, 1));
    const unitPrice = toNum(rit?.unitPrice, NaN) ||
        toNum(orderSnap?.unitPrice, NaN) ||
        (toNum(rit?.finalLineTotal, NaN) && qty > 0 ? toNum(rit?.finalLineTotal, 0) / qty : NaN) ||
        0;
    const finalLineTotal = toNum(rit?.finalLineTotal, NaN) ||
        toNum(orderSnap?.finalLineTotal, NaN) ||
        (unitPrice > 0 ? unitPrice * qty : 0);
    return {
        ...rit,
        title: toStr(rit?.title) || orderSnap?.title || null,
        productCode: toStr(rit?.productCode) || orderSnap?.productCode || null,
        image: toStr(rit?.image) || orderSnap?.image || null,
        variantLabel: toStr(rit?.variantLabel) || orderSnap?.variantLabel || null,
        unitPrice: unitPrice || 0,
        finalLineTotal: finalLineTotal || 0,
    };
}
function flattenReturns(order) {
    const out = [];
    const subs = Array.isArray(order?.subOrders) ? order.subOrders : [];
    for (const so of subs) {
        const returns = Array.isArray(so?.returns) ? so.returns : [];
        for (const r of returns) {
            const items = (Array.isArray(r?.items) ? r.items : []).map((it) => hydrateReturnItem(so, it));
            out.push({
                orderId: String(order._id),
                orderCode: order.orderCode,
                userId: order.userId,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                orderStatus: order.status,
                subOrderId: String(so._id),
                subOrderStatus: so.status,
                ownerType: so.ownerType,
                vendorId: so.vendorId || null,
                vendorName: so.vendorName || null,
                soldBy: so.soldBy,
                returnId: String(r._id),
                returnStatus: r.status,
                requestedAt: r.requestedAt,
                approvedAt: r.approvedAt,
                rejectedAt: r.rejectedAt,
                receivedAt: r.receivedAt,
                rejectReason: r.rejectReason || null,
                items,
                reason: r.reason,
                note: r.note || null,
                images: r.images || [],
                bankDetails: r.bankDetails || null,
                handledByRole: r.handledByRole || null,
                handledById: r.handledById || null,
                refund: so.refund || null,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
            });
        }
    }
    return out;
}
const adminListReturnRequests = async (req, res) => {
    try {
        const status = toStr(req.query?.status).toUpperCase();
        const q = toStr(req.query?.q);
        const ownerType = toStr(req.query?.ownerType).toUpperCase();
        const page = Math.max(1, toNum(req.query?.page, 1));
        const limit = Math.min(100, Math.max(10, toNum(req.query?.limit, 20)));
        const skip = (page - 1) * limit;
        const filter = { "subOrders.returns.0": { $exists: true } };
        if (ownerType === "ADMIN" || ownerType === "VENDOR") {
            filter["subOrders.ownerType"] = ownerType;
        }
        if (q) {
            filter.$or = [
                { orderCode: { $regex: q, $options: "i" } },
                { "contact.phone": { $regex: q, $options: "i" } },
                { "contact.name": { $regex: q, $options: "i" } },
            ];
        }
        const candidates = await Order_model_1.Order.find(filter)
            .select([
            "orderCode",
            "userId",
            "contact",
            "address",
            "paymentMethod",
            "paymentStatus",
            "status",
            "subOrders",
            "createdAt",
            "updatedAt",
        ].join(" "))
            .sort({ updatedAt: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        let rows = candidates.flatMap((o) => flattenReturns(o));
        if (status && isValidReturnStatus(status)) {
            rows = rows.filter((r) => String(r.returnStatus || "").toUpperCase() === status);
        }
        rows.sort((a, b) => {
            const ta = a?.requestedAt ? new Date(a.requestedAt).getTime() : 0;
            const tb = b?.requestedAt ? new Date(b.requestedAt).getTime() : 0;
            return tb - ta;
        });
        return res.json({
            message: "Return requests fetched",
            data: {
                items: rows,
                page,
                limit,
                total: rows.length,
                totalPages: 1,
            },
        });
    }
    catch (err) {
        console.error("adminListReturnRequests error:", err);
        return res.status(500).json({
            message: "Failed to fetch return requests",
            error: err?.message || "Unknown error",
        });
    }
};
exports.adminListReturnRequests = adminListReturnRequests;
const adminApproveReturn = async (req, res) => {
    try {
        const { orderId, subOrderId, returnId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(orderId) || !mongoose_1.Types.ObjectId.isValid(subOrderId) || !mongoose_1.Types.ObjectId.isValid(returnId)) {
            return res.status(400).json({ message: "Invalid params" });
        }
        const order = await Order_model_1.Order.findById(orderId);
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        const subOrder = order.subOrders?.id(subOrderId);
        if (!subOrder)
            return res.status(404).json({ message: "SubOrder not found" });
        if (subOrder.ownerType !== "ADMIN") {
            return res.status(403).json({ message: "Vendor returns must be approved by vendor" });
        }
        const ret = subOrder.returns?.id(returnId);
        if (!ret)
            return res.status(404).json({ message: "Return not found" });
        const cur = String(ret.status || "").toUpperCase();
        if (cur !== "REQUESTED") {
            return res.status(400).json({ message: `Return cannot be approved from status: ${cur}` });
        }
        const adminId = oid(req?.admin?._id);
        ret.status = "APPROVED";
        ret.approvedAt = new Date();
        ret.rejectedAt = null;
        ret.rejectReason = null;
        ret.handledByRole = "ADMIN";
        ret.handledById = adminId;
        await order.save();
        const walletSync = await (0, vendorWallet_service_1.applyWalletEffectsForOrder)(order);
        return res.json({
            message: "Return approved (ADMIN subOrder)",
            data: { orderId, subOrderId, returnId, walletSync },
        });
    }
    catch (err) {
        console.error("adminApproveReturn error:", err);
        return res.status(500).json({ message: "Approve failed", error: err?.message || "Unknown error" });
    }
};
exports.adminApproveReturn = adminApproveReturn;
const adminRejectReturn = async (req, res) => {
    try {
        const { orderId, subOrderId, returnId } = req.params;
        const rejectReason = toStr(req.body?.rejectReason || req.body?.reason);
        if (!rejectReason)
            return res.status(400).json({ message: "Reject reason is required" });
        if (!mongoose_1.Types.ObjectId.isValid(orderId) || !mongoose_1.Types.ObjectId.isValid(subOrderId) || !mongoose_1.Types.ObjectId.isValid(returnId)) {
            return res.status(400).json({ message: "Invalid params" });
        }
        const order = await Order_model_1.Order.findById(orderId);
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        const subOrder = order.subOrders?.id(subOrderId);
        if (!subOrder)
            return res.status(404).json({ message: "SubOrder not found" });
        if (subOrder.ownerType !== "ADMIN") {
            return res.status(403).json({ message: "Vendor returns must be rejected by vendor" });
        }
        const ret = subOrder.returns?.id(returnId);
        if (!ret)
            return res.status(404).json({ message: "Return not found" });
        const cur = String(ret.status || "").toUpperCase();
        if (cur !== "REQUESTED") {
            return res.status(400).json({ message: `Return cannot be rejected from status: ${cur}` });
        }
        const adminId = oid(req?.admin?._id);
        ret.status = "REJECTED";
        ret.rejectedAt = new Date();
        ret.rejectReason = rejectReason;
        ret.approvedAt = null;
        ret.handledByRole = "ADMIN";
        ret.handledById = adminId;
        await order.save();
        return res.json({ message: "Return rejected (ADMIN subOrder)", data: { orderId, subOrderId, returnId } });
    }
    catch (err) {
        console.error("adminRejectReturn error:", err);
        return res.status(500).json({ message: "Reject failed", error: err?.message || "Unknown error" });
    }
};
exports.adminRejectReturn = adminRejectReturn;
