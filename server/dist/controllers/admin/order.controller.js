"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminUpdateOrderStatus = exports.adminGetOrders = void 0;
const mongoose_1 = require("mongoose");
const Order_model_1 = require("../../models/Order.model");
const toStr = (v) => String(v ?? "").trim();
const allowedStatuses = ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];
const adminGetOrders = async (req, res) => {
    try {
        const q = toStr(req.query.q); // search: orderCode / contact phone / name
        const status = toStr(req.query.status); // filter
        const payment = toStr(req.query.paymentMethod); // COD/ONLINE
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(10, Number(req.query.limit || 20)));
        const skip = (page - 1) * limit;
        const filter = {};
        if (status && allowedStatuses.includes(status))
            filter.status = status;
        if (payment && ["COD", "ONLINE"].includes(payment))
            filter.paymentMethod = payment;
        if (q) {
            filter.$or = [
                { orderCode: { $regex: q, $options: "i" } },
                { "contact.phone": { $regex: q, $options: "i" } },
                { "contact.name": { $regex: q, $options: "i" } },
            ];
        }
        const [items, total] = await Promise.all([
            Order_model_1.Order.find(filter)
                .populate({
                path: "items.productId",
                select: "title variants", // bas itna hi enough
            })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Order_model_1.Order.countDocuments(filter),
        ]);
        return res.json({
            message: "Admin orders fetched",
            data: {
                items,
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (err) {
        console.error("adminGetOrders error:", err);
        return res.status(500).json({ message: "Failed to fetch orders", error: err?.message || "Unknown error" });
    }
};
exports.adminGetOrders = adminGetOrders;
const adminUpdateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(orderId))
            return res.status(400).json({ message: "Invalid orderId" });
        const nextStatus = toStr(req.body?.status);
        if (!allowedStatuses.includes(nextStatus)) {
            return res.status(400).json({ message: "Invalid status" });
        }
        const order = await Order_model_1.Order.findById(orderId);
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        order.status = nextStatus;
        await order.save();
        return res.json({ message: "Order status updated", data: order });
    }
    catch (err) {
        console.error("adminUpdateOrderStatus error:", err);
        return res.status(500).json({ message: "Status update failed", error: err?.message || "Unknown error" });
    }
};
exports.adminUpdateOrderStatus = adminUpdateOrderStatus;
