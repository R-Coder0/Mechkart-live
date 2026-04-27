"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminProcessRefund = void 0;
const mongoose_1 = require("mongoose");
const razorpay_1 = __importDefault(require("razorpay"));
const Order_model_1 = require("../../models/Order.model");
const vendorWallet_service_1 = require("../../services/vendorWallet.service");
const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
function toStr(v) {
    return String(v ?? "").trim();
}
function toNum(v, fb = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
}
function oid(v) {
    return mongoose_1.Types.ObjectId.isValid(String(v)) ? new mongoose_1.Types.ObjectId(String(v)) : null;
}
/**
 * Compute refund amount for subOrder based on return items
 * Uses finalLineTotal snapshot
 */
function computeSubOrderRefundAmount(subOrder, ret) {
    let total = 0;
    const items = Array.isArray(subOrder?.items) ? subOrder.items : [];
    const returnItems = Array.isArray(ret?.items) ? ret.items : [];
    for (const r of returnItems) {
        const pid = String(r.productId);
        const vid = r.variantId ? String(r.variantId) : "";
        const ck = r.colorKey ? String(r.colorKey).toLowerCase() : "";
        const orderItem = items.find((it) => {
            const ipid = String(it.productId);
            const ivid = it.variantId ? String(it.variantId) : "";
            const ick = it.colorKey ? String(it.colorKey).toLowerCase() : "";
            return ipid === pid && ivid === vid && ick === ck;
        });
        if (!orderItem)
            continue;
        const qty = Math.max(1, toNum(r.qty, 1));
        const line = toNum(orderItem.finalLineTotal, orderItem.salePrice * orderItem.qty);
        const unit = line / Math.max(1, toNum(orderItem.qty, 1));
        total += unit * qty;
    }
    return Math.round(total * 100) / 100;
}
/**
 * POST
 * /api/admin/orders/:orderId/suborders/:subOrderId/returns/:returnId/refund
 */
const adminProcessRefund = async (req, res) => {
    try {
        const { orderId, subOrderId, returnId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(orderId) ||
            !mongoose_1.Types.ObjectId.isValid(subOrderId) ||
            !mongoose_1.Types.ObjectId.isValid(returnId)) {
            return res.status(400).json({ message: "Invalid parameters" });
        }
        const order = await Order_model_1.Order.findById(orderId);
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        const subOrder = order.subOrders?.id(subOrderId);
        if (!subOrder)
            return res.status(404).json({ message: "SubOrder not found" });
        const ret = subOrder.returns?.id(returnId);
        if (!ret)
            return res.status(404).json({ message: "Return not found" });
        const retStatus = String(ret.status || "").toUpperCase();
        if (!["APPROVED", "RECEIVED"].includes(retStatus)) {
            return res.status(400).json({
                message: `Refund allowed only after APPROVED/RECEIVED (current: ${retStatus})`,
            });
        }
        if (subOrder.refund?.status === "PROCESSED") {
            return res.status(409).json({ message: "Refund already processed" });
        }
        const pm = String(order.paymentMethod || "").toUpperCase();
        const refundAmount = computeSubOrderRefundAmount(subOrder, ret);
        if (refundAmount <= 0) {
            return res.status(400).json({ message: "Invalid refund amount" });
        }
        // COD => Manual refund
        if (pm === "COD") {
            subOrder.refund = {
                method: "COD",
                amount: refundAmount,
                status: "PROCESSED",
                provider: "MANUAL",
                reference: null,
                processedAt: new Date(),
                processedByAdminId: oid(req?.admin?._id),
                raw: { note: "Manual COD refund" },
            };
            ret.status = "REFUNDED";
            await order.save();
            const walletSync = await (0, vendorWallet_service_1.applyWalletEffectsForOrder)(order);
            return res.json({
                message: "COD refund marked processed",
                amount: refundAmount,
                walletSync,
            });
        }
        // ONLINE => Razorpay
        if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
            return res.status(500).json({ message: "Razorpay keys missing" });
        }
        const paymentId = toStr(order?.pg?.paymentId);
        if (!paymentId) {
            return res.status(400).json({ message: "Missing paymentId" });
        }
        const razorpay = new razorpay_1.default({
            key_id: RZP_KEY_ID,
            key_secret: RZP_KEY_SECRET,
        });
        const amountPaise = Math.round(refundAmount * 100);
        try {
            const refund = await razorpay.payments.refund(paymentId, {
                amount: amountPaise,
                notes: {
                    orderId: String(order._id),
                    subOrderId: String(subOrder._id),
                    returnId: String(ret._id),
                },
            });
            subOrder.refund = {
                method: "ONLINE",
                amount: refundAmount,
                status: "PROCESSED",
                provider: "RAZORPAY",
                reference: refund?.id || null,
                processedAt: new Date(),
                processedByAdminId: oid(req?.admin?._id),
                raw: refund,
            };
            ret.status = "REFUNDED";
            await order.save();
            const walletSync = await (0, vendorWallet_service_1.applyWalletEffectsForOrder)(order);
            return res.json({
                message: "Refund processed",
                amount: refundAmount,
                refundId: refund?.id,
                walletSync,
            });
        }
        catch (err) {
            subOrder.refund = {
                method: "ONLINE",
                amount: refundAmount,
                status: "FAILED",
                provider: "RAZORPAY",
                reference: null,
                processedAt: null,
                processedByAdminId: oid(req?.admin?._id),
                raw: err?.response?.data || err,
            };
            await order.save();
            return res.status(400).json({
                message: "Razorpay refund failed",
                error: err?.message || "Unknown error",
            });
        }
    }
    catch (err) {
        console.error("adminProcessRefund error:", err);
        return res.status(500).json({
            message: "Refund failed",
            error: err?.message || "Unknown error",
        });
    }
};
exports.adminProcessRefund = adminProcessRefund;
