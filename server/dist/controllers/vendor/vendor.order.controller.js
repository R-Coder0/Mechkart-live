"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorGenerateOrderLabel = exports.vendorGetOrderTracking = exports.vendorGetOrderById = exports.vendorFetchOrders = void 0;
const mongoose_1 = require("mongoose");
const Order_model_1 = require("../../models/Order.model");
const shiprocket_service_1 = require("../../services/shiprocket.service");
// helpers
const toStr = (v) => String(v ?? "").trim();
const toNum = (v, fb = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
};
const firstNonEmptyString = (...values) => {
    for (const value of values) {
        const text = toStr(value);
        if (text)
            return text;
    }
    return "";
};
function hydrateShiprocketShipment(shipment) {
    if (!shipment?.shiprocket)
        return shipment;
    const sr = shipment.shiprocket || {};
    const rawAwb = sr?.raw?.awb || {};
    const awb = firstNonEmptyString(sr?.awb, rawAwb?.awb_code, rawAwb?.awb, rawAwb?.response?.data?.awb_code, rawAwb?.response?.data?.awb, rawAwb?.data?.awb_code, rawAwb?.data?.awb, rawAwb?.response?.awb_code, rawAwb?.response?.awb);
    const labelUrl = firstNonEmptyString(sr?.labelUrl, sr?.raw?.label?.label_url, sr?.raw?.label?.data?.label_url);
    return {
        ...shipment,
        shiprocket: {
            ...sr,
            awb: awb || null,
            labelUrl: labelUrl || null,
        },
    };
}
function hydrateOrderShipmentData(order) {
    const subOrders = Array.isArray(order?.subOrders)
        ? order.subOrders.map((so) => ({
            ...so,
            shipment: so?.shipment ? hydrateShiprocketShipment(so.shipment) : so?.shipment ?? null,
        }))
        : [];
    const shipments = Array.isArray(order?.shipments)
        ? order.shipments.map((shipment) => hydrateShiprocketShipment(shipment))
        : [];
    return {
        ...order,
        subOrders,
        shipments,
    };
}
function sanitizeCustomerContactForVendor(order) {
    return {
        ...order,
        contact: order?.contact
            ? {
                ...order.contact,
                phone: null,
            }
            : order?.contact ?? null,
        address: order?.address
            ? {
                ...order.address,
                phone: null,
            }
            : order?.address ?? null,
    };
}
const getVendorId = (req) => req?.vendor?._id || req?.vendorId;
/* =========================
   SHIPPING CALC
========================= */
const calcShippingMarkup = (weightKg) => {
    const w = Number(weightKg || 0);
    if (!Number.isFinite(w) || w <= 0)
        return 0;
    const step = 0.5;
    const slabs = Math.ceil(w / step);
    const base = 60;
    const extra = Math.max(0, slabs - 1) * 30;
    return base + extra;
};
/* =========================
   SEARCH HELPERS
========================= */
function escapeRegex(input) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function buildSearchMatch(qRaw) {
    const q = toStr(qRaw);
    if (!q)
        return null;
    const rx = new RegExp(escapeRegex(q), "i");
    return {
        $or: [
            { orderCode: rx },
            { "contact.name": rx },
            { "contact.phone": rx },
            { "address.fullName": rx },
            { "address.phone": rx },
            { "pg.orderId": rx },
            { "pg.paymentId": rx },
        ],
    };
}
/* =========================
   VENDOR VIEW TRANSFORM
========================= */
function applyVendorPriceViewToOrder(order, vendorObjectId) {
    const hydratedOrder = sanitizeCustomerContactForVendor(hydrateOrderShipmentData(order));
    const subOrdersAll = Array.isArray(hydratedOrder?.subOrders) ? hydratedOrder.subOrders : [];
    const vendorSubs = subOrdersAll.filter((so) => String(so?.vendorId || "") === String(vendorObjectId));
    const patchedSubs = vendorSubs.map((so) => {
        const items = Array.isArray(so?.items) ? so.items : [];
        const patchedItems = items.map((it) => {
            const qty = Math.max(1, toNum(it?.qty, 1));
            const payableSale = toNum(it?.salePrice, 0);
            const payableMrp = toNum(it?.mrp, 0);
            const weightKg = it?.ship?.weightKg ?? 0;
            const shipMarkupUnit = calcShippingMarkup(weightKg);
            const baseSale = Math.max(0, payableSale - shipMarkupUnit);
            const baseMrp = Math.max(0, payableMrp - shipMarkupUnit);
            const payableLine = toNum(it?.finalLineTotal, NaN) ||
                Math.max(0, payableSale * qty);
            const baseLine = Math.max(0, payableLine - shipMarkupUnit * qty);
            return {
                ...it,
                vendorPricing: {
                    shippingMarkupUnit: shipMarkupUnit,
                    weightKg: toNum(weightKg, 0),
                    baseMrp,
                    baseSalePrice: baseSale,
                    baseLineTotal: baseSale * qty,
                    baseFinalLineTotal: baseLine,
                },
            };
        });
        const vendorSubtotal = patchedItems.reduce((sum, it) => {
            const v = toNum(it?.vendorPricing?.baseFinalLineTotal, NaN);
            if (Number.isFinite(v))
                return sum + v;
            return sum;
        }, 0);
        return {
            ...so,
            items: patchedItems,
            vendorTotals: {
                subtotal: Math.round(vendorSubtotal * 100) / 100,
                shipping: 0,
                total: Math.round(vendorSubtotal * 100) / 100,
            },
        };
    });
    /* =========================
       FIXED SHIPMENT FILTER
    ========================= */
    const shipmentsAll = Array.isArray(hydratedOrder?.shipments)
        ? hydratedOrder.shipments
        : [];
    const vendorSubIds = patchedSubs.map((x) => String(x._id));
    const vendorShipments = shipmentsAll.filter((sh) => {
        const byVendor = String(sh?.vendorId || "") === String(vendorObjectId);
        const bySub = vendorSubIds.includes(String(sh?.subOrderId || ""));
        // ✅ NEW fallback (admin shipment)
        const orderLevel = !sh?.vendorId && !sh?.subOrderId;
        return byVendor || bySub || orderLevel;
    });
    return {
        ...hydratedOrder,
        subOrders: patchedSubs,
        shipments: vendorShipments,
    };
}
/* =========================
   LIST VENDOR ORDERS
========================= */
const vendorFetchOrders = async (req, res) => {
    try {
        const vendorId = getVendorId(req);
        if (!vendorId)
            return res.status(401).json({ message: "Unauthorized" });
        const vendorObjectId = new mongoose_1.Types.ObjectId(String(vendorId));
        const q = toStr(req.query?.q);
        const status = toStr(req.query?.status).toUpperCase();
        const paymentMethod = toStr(req.query?.paymentMethod).toUpperCase();
        const paymentStatus = toStr(req.query?.paymentStatus).toUpperCase();
        const page = Math.max(1, toNum(req.query?.page, 1));
        const limit = Math.min(50, Math.max(1, toNum(req.query?.limit, 20)));
        const skip = (page - 1) * limit;
        const match = {
            "subOrders.vendorId": vendorObjectId,
        };
        const searchMatch = buildSearchMatch(q);
        if (searchMatch)
            Object.assign(match, searchMatch);
        if (paymentMethod)
            match.paymentMethod = paymentMethod;
        if (paymentStatus)
            match.paymentStatus = paymentStatus;
        if (status) {
            match.$or = match.$or || [];
            match.$or.push({ status });
            match.$or.push({
                subOrders: {
                    $elemMatch: {
                        vendorId: vendorObjectId,
                        status,
                    },
                },
            });
        }
        const pipeline = [
            { $match: match },
            { $sort: { createdAt: -1 } },
            {
                $project: {
                    orderCode: 1,
                    status: 1,
                    paymentMethod: 1,
                    paymentStatus: 1,
                    totals: 1,
                    totalAmount: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    contact: 1,
                    address: 1,
                    pg: 1,
                    cod: 1,
                    subOrders: {
                        $filter: {
                            input: "$subOrders",
                            as: "so",
                            cond: {
                                $eq: ["$$so.vendorId", vendorObjectId],
                            },
                        },
                    },
                    shipments: 1,
                },
            },
            {
                $facet: {
                    items: [{ $skip: skip }, { $limit: limit }],
                    meta: [{ $count: "total" }],
                },
            },
        ];
        const out = await Order_model_1.Order.aggregate(pipeline);
        const rawItems = out?.[0]?.items || [];
        const total = out?.[0]?.meta?.[0]?.total || 0;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const items = rawItems.map((o) => applyVendorPriceViewToOrder(o, vendorObjectId));
        return res.json({
            data: {
                items,
                page,
                limit,
                total,
                totalPages,
            },
        });
    }
    catch (e) {
        console.error("vendorFetchOrders error:", e);
        return res
            .status(500)
            .json({ message: e?.message || "Server error" });
    }
};
exports.vendorFetchOrders = vendorFetchOrders;
/* =========================
   GET ORDER DETAILS
========================= */
const vendorGetOrderById = async (req, res) => {
    try {
        const vendorId = getVendorId(req);
        if (!vendorId)
            return res.status(401).json({ message: "Unauthorized" });
        const vendorObjectId = new mongoose_1.Types.ObjectId(String(vendorId));
        const orderId = toStr(req.params.orderId);
        if (!mongoose_1.Types.ObjectId.isValid(orderId))
            return res
                .status(400)
                .json({ message: "Invalid order id" });
        const order = await Order_model_1.Order.findById(orderId)
            .populate({
            path: "subOrders.items.productId",
            select: "title productCode variants colors featureImage galleryImages",
        })
            .lean();
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        const scoped = applyVendorPriceViewToOrder(order, vendorObjectId);
        return res.json({
            data: scoped,
        });
    }
    catch (e) {
        console.error("vendorGetOrderById error:", e);
        return res
            .status(500)
            .json({ message: e?.message || "Server error" });
    }
};
exports.vendorGetOrderById = vendorGetOrderById;
/* =========================
   VENDOR TRACKING
========================= */
const vendorGetOrderTracking = async (req, res) => {
    try {
        const vendorId = getVendorId(req);
        if (!vendorId)
            return res.status(401).json({ message: "Unauthorized" });
        const vendorObjectId = new mongoose_1.Types.ObjectId(String(vendorId));
        const orderId = toStr(req.params.orderId);
        if (!mongoose_1.Types.ObjectId.isValid(orderId))
            return res
                .status(400)
                .json({ message: "Invalid order id" });
        const order = hydrateOrderShipmentData(await Order_model_1.Order.findById(orderId).lean());
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        const subOrdersAll = Array.isArray(order.subOrders)
            ? order.subOrders
            : [];
        const vendorSubs = subOrdersAll.filter((so) => String(so?.vendorId || "") ===
            String(vendorObjectId));
        if (!vendorSubs.length)
            return res.status(403).json({ message: "Forbidden" });
        const vendorSubIds = vendorSubs.map((x) => String(x._id));
        const shipmentsAll = Array.isArray(order.shipments)
            ? order.shipments
            : [];
        const shipments = shipmentsAll.filter((sh) => {
            const byVendor = String(sh?.vendorId || "") ===
                String(vendorObjectId);
            const bySub = vendorSubIds.includes(String(sh?.subOrderId || ""));
            const orderLevel = !sh?.vendorId && !sh?.subOrderId;
            return byVendor || bySub || orderLevel;
        });
        return res.json({
            data: {
                orderId: String(order._id),
                orderCode: order.orderCode,
                status: order.status,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                createdAt: order.createdAt,
                shipments,
            },
        });
    }
    catch (e) {
        console.error("vendorGetOrderTracking error:", e);
        return res
            .status(500)
            .json({ message: e?.message || "Server error" });
    }
};
exports.vendorGetOrderTracking = vendorGetOrderTracking;
/* =========================
   GENERATE / GET LABEL
========================= */
const vendorGenerateOrderLabel = async (req, res) => {
    try {
        const vendorId = getVendorId(req);
        if (!vendorId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const vendorObjectId = new mongoose_1.Types.ObjectId(String(vendorId));
        const orderId = toStr(req.params.orderId);
        const shipmentIdParam = toStr(req.params.shipmentId);
        if (!mongoose_1.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: "Invalid order id" });
        }
        const order = await Order_model_1.Order.findById(orderId).lean();
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        const subOrdersAll = Array.isArray(order?.subOrders) ? order.subOrders : [];
        const vendorSubs = subOrdersAll.filter((so) => String(so?.vendorId || "") === String(vendorObjectId));
        if (!vendorSubs.length) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const vendorSubIds = new Set(vendorSubs.map((so) => String(so?._id || "")));
        const shipmentsAll = Array.isArray(order?.shipments) ? order.shipments : [];
        let targetShipment = vendorSubs
            .map((so) => so?.shipment)
            .find((sh) => {
            const sid = Number(sh?.shiprocket?.shipmentId ?? 0);
            return sid > 0 && String(sid) === shipmentIdParam;
        }) || null;
        if (!targetShipment) {
            targetShipment =
                shipmentsAll.find((sh) => {
                    const sid = Number(sh?.shiprocket?.shipmentId ?? 0);
                    const belongsToVendor = String(sh?.vendorId || "") === String(vendorObjectId) ||
                        vendorSubIds.has(String(sh?.subOrderId || ""));
                    return belongsToVendor && sid > 0 && String(sid) === shipmentIdParam;
                }) || null;
        }
        if (!targetShipment) {
            return res.status(404).json({ message: "Shipment not found for this vendor" });
        }
        const shipmentId = Number(targetShipment?.shiprocket?.shipmentId ?? 0);
        const awb = toStr(targetShipment?.shiprocket?.awb);
        const existingLabelUrl = toStr(targetShipment?.shiprocket?.labelUrl);
        if (existingLabelUrl) {
            return res.json({
                message: "Label already available",
                data: {
                    shipmentId,
                    awb: awb || null,
                    labelUrl: existingLabelUrl,
                },
            });
        }
        if (!shipmentId) {
            return res.status(400).json({ message: "Shipment id missing" });
        }
        const labelResp = await (0, shiprocket_service_1.shiprocketGenerateLabel)({ shipment_id: [shipmentId] });
        const labelUrl = toStr(labelResp?.label_url || labelResp?.data?.label_url);
        if (!labelUrl) {
            return res.status(502).json({ message: "Shiprocket did not return a label URL" });
        }
        await Order_model_1.Order.updateOne({ _id: new mongoose_1.Types.ObjectId(orderId), "subOrders.shipment.shiprocket.shipmentId": shipmentId }, {
            $set: {
                "subOrders.$.shipment.shiprocket.labelUrl": labelUrl,
                "subOrders.$.shipment.updatedAt": new Date(),
            },
        });
        return res.json({
            message: "Label generated",
            data: {
                shipmentId,
                awb: awb || null,
                labelUrl,
            },
        });
    }
    catch (e) {
        console.error("vendorGenerateOrderLabel error:", e);
        return res
            .status(e?.status || 500)
            .json({ message: e?.message || "Label generation failed", error: e?.payload || null });
    }
};
exports.vendorGenerateOrderLabel = vendorGenerateOrderLabel;
