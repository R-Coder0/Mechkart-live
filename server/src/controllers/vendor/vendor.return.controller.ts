/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { Order } from "../../models/Order.model";
import { applyWalletEffectsForOrder } from "../../services/vendorWallet.service";

const toStr = (v: any) => String(v ?? "").trim();

/* =========================
 * Approve Return (Vendor)
 * ========================= */
// POST /api/vendor/orders/:orderId/suborders/:subOrderId/returns/:returnId/approve
export const approveReturnByVendor = async (req: Request, res: Response) => {
  try {
    const vendorId = (req as any)?.vendor?._id;
    if (!vendorId) return res.status(401).json({ message: "Unauthorized" });

    const { orderId, subOrderId, returnId } = req.params;

    if (
      !Types.ObjectId.isValid(orderId) ||
      !Types.ObjectId.isValid(subOrderId) ||
      !Types.ObjectId.isValid(returnId)
    ) {
      return res.status(400).json({ message: "Invalid parameters" });
    }

    const order: any = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const subOrder = order.subOrders.id(subOrderId);
    if (!subOrder) return res.status(404).json({ message: "SubOrder not found" });

    if (subOrder.ownerType !== "VENDOR" || toStr(subOrder.vendorId) !== toStr(vendorId)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const ret = subOrder.returns.id(returnId);
    if (!ret) return res.status(404).json({ message: "Return not found" });

    if (ret.status !== "REQUESTED") {
      return res.status(400).json({ message: "Return already processed" });
    }

    ret.status = "APPROVED";
    ret.approvedAt = new Date();
    ret.handledByRole = "VENDOR";
    ret.handledById = vendorId;

    await order.save();

    const walletSync = await applyWalletEffectsForOrder(order);

    return res.json({
      message: "Return approved successfully",
      data: {
        orderId,
        subOrderId,
        returnId,
        walletSync,
      },
    });
  } catch (err: any) {
    console.error("approveReturnByVendor error:", err);
    return res.status(500).json({ message: "Failed to approve return" });
  }
};

/* =========================
 * Reject Return (Vendor)
 * ========================= */
// POST /api/vendor/orders/:orderId/suborders/:subOrderId/returns/:returnId/reject
export const rejectReturnByVendor = async (req: Request, res: Response) => {
  try {
    const vendorId = (req as any)?.vendor?._id;
    if (!vendorId) return res.status(401).json({ message: "Unauthorized" });

    const { orderId, subOrderId, returnId } = req.params;
    const rejectReason = toStr(req.body?.rejectReason);

    if (!rejectReason) {
      return res.status(400).json({ message: "Reject reason is required" });
    }

    if (
      !Types.ObjectId.isValid(orderId) ||
      !Types.ObjectId.isValid(subOrderId) ||
      !Types.ObjectId.isValid(returnId)
    ) {
      return res.status(400).json({ message: "Invalid parameters" });
    }

    const order: any = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const subOrder = order.subOrders.id(subOrderId);
    if (!subOrder) return res.status(404).json({ message: "SubOrder not found" });

    if (subOrder.ownerType !== "VENDOR" || toStr(subOrder.vendorId) !== toStr(vendorId)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const ret = subOrder.returns.id(returnId);
    if (!ret) return res.status(404).json({ message: "Return not found" });

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
  } catch (err: any) {
    console.error("rejectReturnByVendor error:", err);
    return res.status(500).json({ message: "Failed to reject return" });
  }
}