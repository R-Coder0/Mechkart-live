"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectReturnByVendor = exports.approveReturnByVendor = void 0;
const mongoose_1 = require("mongoose");
const Order_model_1 = require("../../models/Order.model");
const vendorWallet_service_1 = require("../../services/vendorWallet.service");
const toStr = (v) => String(v ?? "").trim();
/* =========================
 * Approve Return (Vendor)
 * ========================= */
// POST /api/vendor/orders/:orderId/suborders/:subOrderId/returns/:returnId/approve
const approveReturnByVendor = async (req, res) => {
    try {
        const vendorId = req?.vendor?._id;
        if (!vendorId)
            return res.status(401).json({ message: "Unauthorized" });
        const { orderId, subOrderId, returnId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(orderId) ||
            !mongoose_1.Types.ObjectId.isValid(subOrderId) ||
            !mongoose_1.Types.ObjectId.isValid(returnId)) {
            return res.status(400).json({ message: "Invalid parameters" });
        }
        const order = await Order_model_1.Order.findById(orderId);
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        const subOrder = order.subOrders.id(subOrderId);
        if (!subOrder)
            return res.status(404).json({ message: "SubOrder not found" });
        if (subOrder.ownerType !== "VENDOR" || toStr(subOrder.vendorId) !== toStr(vendorId)) {
            return res.status(403).json({ message: "Not allowed" });
        }
        const ret = subOrder.returns.id(returnId);
        if (!ret)
            return res.status(404).json({ message: "Return not found" });
        if (ret.status !== "REQUESTED") {
            return res.status(400).json({ message: "Return already processed" });
        }
        ret.status = "APPROVED";
        ret.approvedAt = new Date();
        ret.handledByRole = "VENDOR";
        ret.handledById = vendorId;
        await order.save();
        const walletSync = await (0, vendorWallet_service_1.applyWalletEffectsForOrder)(order);
        return res.json({
            message: "Return approved successfully",
            data: {
                orderId,
                subOrderId,
                returnId,
                walletSync,
            },
        });
    }
    catch (err) {
        console.error("approveReturnByVendor error:", err);
        return res.status(500).json({ message: "Failed to approve return" });
    }
};
exports.approveReturnByVendor = approveReturnByVendor;
/* =========================
 * Reject Return (Vendor)
 * ========================= */
// POST /api/vendor/orders/:orderId/suborders/:subOrderId/returns/:returnId/reject
const rejectReturnByVendor = async (req, res) => {
    try {
        const vendorId = req?.vendor?._id;
        if (!vendorId)
            return res.status(401).json({ message: "Unauthorized" });
        const { orderId, subOrderId, returnId } = req.params;
        const rejectReason = toStr(req.body?.rejectReason);
        if (!rejectReason) {
            return res.status(400).json({ message: "Reject reason is required" });
        }
        if (!mongoose_1.Types.ObjectId.isValid(orderId) ||
            !mongoose_1.Types.ObjectId.isValid(subOrderId) ||
            !mongoose_1.Types.ObjectId.isValid(returnId)) {
            return res.status(400).json({ message: "Invalid parameters" });
        }
        const order = await Order_model_1.Order.findById(orderId);
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        const subOrder = order.subOrders.id(subOrderId);
        if (!subOrder)
            return res.status(404).json({ message: "SubOrder not found" });
        if (subOrder.ownerType !== "VENDOR" || toStr(subOrder.vendorId) !== toStr(vendorId)) {
            return res.status(403).json({ message: "Not allowed" });
        }
        const ret = subOrder.returns.id(returnId);
        if (!ret)
            return res.status(404).json({ message: "Return not found" });
        if (ret.status !== "REQUESTED") {
            return res.status(400).json({ message: "Return already processed" });
        }
        ret.status = "REJECTED";
        ret.rejectedAt = new Date();
        ret.rejectReason = rejectReason;
        ret.handledByRole = "VENDOR";
        ret.handledById = vendorId;
        await order.save();
        return res.json({ message: "Return rejected successfully" });
    }
    catch (err) {
        console.error("rejectReturnByVendor error:", err);
        return res.status(500).json({ message: "Failed to reject return" });
    }
};
exports.rejectReturnByVendor = rejectReturnByVendor;
