"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderTracking = void 0;
const mongoose_1 = require("mongoose");
const Order_model_1 = require("../../models/Order.model");
const shiprocket_service_1 = require("../../services/shiprocket.service");
const getUserId = (req) => req.user?._id;
const toStr = (v) => String(v ?? "").trim();
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
    return {
        ...shipment,
        shiprocket: {
            ...sr,
            awb: awb || null,
        },
    };
}
/**
 * GET /users/orders/:orderId/tracking
 * Returns order + shipments + (optional) live tracking from Shiprocket (by AWB)
 */
const getOrderTracking = async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const { orderId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(orderId))
            return res.status(400).json({ message: "Invalid orderId" });
        const order = await Order_model_1.Order.findOne({ _id: new mongoose_1.Types.ObjectId(orderId), userId: new mongoose_1.Types.ObjectId(userId) })
            .select("orderCode status paymentMethod paymentStatus shipments subOrders createdAt updatedAt")
            .lean();
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        const shipmentsFromRoot = Array.isArray(order.shipments) ? order.shipments : [];
        const shipmentsFromSubOrders = Array.isArray(order.subOrders)
            ? order.subOrders
                .map((so) => so?.shipment)
                .filter((shipment) => shipment && shipment?.shiprocket?.shipmentId)
            : [];
        const shipments = (shipmentsFromRoot.length ? shipmentsFromRoot : shipmentsFromSubOrders).map((shipment) => hydrateShiprocketShipment(shipment));
        // ✅ OPTIONAL: Live tracking fetch for each shipment that has AWB
        // (Later we can cache, or move to webhook updates)
        const enriched = await Promise.all(shipments.map(async (s) => {
            const awb = toStr(s?.shiprocket?.awb);
            if (!awb)
                return s;
            try {
                const tr = await (0, shiprocket_service_1.shiprocketTrackByAwb)(awb);
                return {
                    ...s,
                    shiprocket: {
                        ...(s.shiprocket || {}),
                        tracking: tr,
                    },
                };
            }
            catch (e) {
                // Don't fail endpoint if tracking API fails
                return s;
            }
        }));
        return res.json({
            message: "Tracking fetched",
            data: {
                orderId: order._id,
                orderCode: order.orderCode,
                status: order.status,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                shipments: enriched,
                createdAt: order.createdAt,
            },
        });
    }
    catch (err) {
        console.error("getOrderTracking error:", err);
        return res.status(500).json({ message: "Tracking fetch failed", error: err?.message || "Unknown error" });
    }
};
exports.getOrderTracking = getOrderTracking;
