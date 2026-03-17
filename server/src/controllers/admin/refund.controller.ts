/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import Razorpay from "razorpay";
import { Order } from "../../models/Order.model";

const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

function toStr(v: any) {
  return String(v ?? "").trim();
}

function toNum(v: any, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function oid(v: any) {
  return Types.ObjectId.isValid(String(v)) ? new Types.ObjectId(String(v)) : null;
}

/**
 * Compute refund amount for subOrder based on return items
 * Uses finalLineTotal snapshot
 */
function computeSubOrderRefundAmount(subOrder: any, ret: any) {
  let total = 0;

  const items = Array.isArray(subOrder?.items) ? subOrder.items : [];
  const returnItems = Array.isArray(ret?.items) ? ret.items : [];

  for (const r of returnItems) {
    const pid = String(r.productId);
    const vid = r.variantId ? String(r.variantId) : "";
    const ck = r.colorKey ? String(r.colorKey).toLowerCase() : "";

    const orderItem = items.find((it: any) => {
      const ipid = String(it.productId);
      const ivid = it.variantId ? String(it.variantId) : "";
      const ick = it.colorKey ? String(it.colorKey).toLowerCase() : "";
      return ipid === pid && ivid === vid && ick === ck;
    });

    if (!orderItem) continue;

    const qty = Math.max(1, toNum(r.qty, 1));
    const line = toNum(orderItem.finalLineTotal, orderItem.salePrice * orderItem.qty);

    const unit = line / Math.max(1, toNum(orderItem.qty, 1));

    total += unit * qty;
  }

  return Math.round(total * 100) / 100; // rupees
}

/**
 * POST
 * /api/admin/orders/:orderId/suborders/:subOrderId/returns/:returnId/refund
 */
export const adminProcessRefund = async (req: Request, res: Response) => {
  try {
    const { orderId, subOrderId, returnId } = req.params;

    if (!Types.ObjectId.isValid(orderId) ||
        !Types.ObjectId.isValid(subOrderId) ||
        !Types.ObjectId.isValid(returnId)) {
      return res.status(400).json({ message: "Invalid parameters" });
    }

    const order: any = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const subOrder = order.subOrders?.id(subOrderId);
    if (!subOrder) return res.status(404).json({ message: "SubOrder not found" });

    const ret = subOrder.returns?.id(returnId);
    if (!ret) return res.status(404).json({ message: "Return not found" });

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

    // Compute refund amount for this subOrder
    const refundAmount = computeSubOrderRefundAmount(subOrder, ret);

    if (refundAmount <= 0) {
      return res.status(400).json({ message: "Invalid refund amount" });
    }

    // ========================
    // COD => Manual refund
    // ========================
    if (pm === "COD") {
      subOrder.refund = {
        method: "COD",
        amount: refundAmount,
        status: "PROCESSED",
        provider: "MANUAL",
        reference: null,
        processedAt: new Date(),
        processedByAdminId: oid((req as any)?.admin?._id),
        raw: { note: "Manual COD refund" },
      };

      ret.status = "REFUNDED";

      await order.save();

      return res.json({ message: "COD refund marked processed", amount: refundAmount });
    }

    // ========================
    // ONLINE => Razorpay
    // ========================
    if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
      return res.status(500).json({ message: "Razorpay keys missing" });
    }

    const paymentId = toStr(order?.pg?.paymentId);
    if (!paymentId) {
      return res.status(400).json({ message: "Missing paymentId" });
    }

    const razorpay = new Razorpay({
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
      } as any);

      subOrder.refund = {
        method: "ONLINE",
        amount: refundAmount,
        status: "PROCESSED",
        provider: "RAZORPAY",
        reference: refund?.id || null,
        processedAt: new Date(),
        processedByAdminId: oid((req as any)?.admin?._id),
        raw: refund,
      };

      ret.status = "REFUNDED";

      await order.save();

      return res.json({
        message: "Refund processed",
        amount: refundAmount,
        refundId: refund?.id,
      });

    } catch (err: any) {
      subOrder.refund = {
        method: "ONLINE",
        amount: refundAmount,
        status: "FAILED",
        provider: "RAZORPAY",
        reference: null,
        processedAt: null,
        processedByAdminId: oid((req as any)?.admin?._id),
        raw: err?.response?.data || err,
      };

      await order.save();

      return res.status(400).json({
        message: "Razorpay refund failed",
        error: err?.message || "Unknown error",
      });
    }

  } catch (err: any) {
    console.error("adminProcessRefund error:", err);
    return res.status(500).json({
      message: "Refund failed",
      error: err?.message || "Unknown error",
    });
  }
};