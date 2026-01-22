/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { Order } from "../../models/Order.model";

const toStr = (v: any) => String(v ?? "").trim();

const RETURN_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "PICKUP_CREATED",
  "RECEIVED",
  "REFUNDED",
] as const;

function isValidReturnStatus(s: string) {
  return (RETURN_STATUSES as readonly string[]).includes(s);
}

// GET /api/admin/returns?status=REQUESTED&q=...
export const adminListReturnRequests = async (req: Request, res: Response) => {
  try {
    const status = toStr(req.query.status).toUpperCase();
    const q = toStr(req.query.q);

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const filter: any = { return: { $ne: null } };

    if (status && isValidReturnStatus(status)) {
      filter["return.status"] = status;
    }

    if (q) {
      filter.$or = [
        { orderCode: { $regex: q, $options: "i" } },
        { "contact.phone": { $regex: q, $options: "i" } },
        { "contact.name": { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      Order.find(filter)
        .select(
          [
            "orderCode",
            "userId",
            "contact",
            "address",
            "items",
            "totals",
            "paymentMethod",
            "paymentStatus",
            "status",
            "return",
            "refund",
            "createdAt",
            "updatedAt",
          ].join(" ")
        )
        .sort({ "return.requestedAt": -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return res.json({
      message: "Return requests fetched",
      data: {
        items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    console.error("adminListReturnRequests error:", err);
    return res.status(500).json({
      message: "Failed to fetch return requests",
      error: err?.message || "Unknown error",
    });
  }
};

// POST /api/admin/returns/:orderId/approve
export const adminApproveReturn = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    if (!Types.ObjectId.isValid(orderId)) return res.status(400).json({ message: "Invalid orderId" });

    const order: any = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (!order.return) return res.status(400).json({ message: "No return request found on this order" });

    const cur = String(order.return.status || "").toUpperCase();
    if (cur !== "REQUESTED") {
      return res.status(400).json({ message: `Return cannot be approved from status: ${cur}` });
    }

    const adminId = (req as any)?.admin?._id ? new Types.ObjectId(String((req as any).admin._id)) : null;

    order.return.status = "APPROVED";
    order.return.approvedAt = new Date();
    order.return.approvedBy = adminId;

    // If admin approves after rejection earlier, clear reject reason (safe)
    order.return.rejectedAt = null;
    order.return.rejectReason = null;

    await order.save();
    return res.json({ message: "Return approved", data: order });
  } catch (err: any) {
    console.error("adminApproveReturn error:", err);
    return res.status(500).json({ message: "Approve failed", error: err?.message || "Unknown error" });
  }
};

// POST /api/admin/returns/:orderId/reject
export const adminRejectReturn = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    if (!Types.ObjectId.isValid(orderId)) return res.status(400).json({ message: "Invalid orderId" });

    const rejectReason = toStr(req.body?.reason);
    if (!rejectReason) return res.status(400).json({ message: "Reject reason is required" });

    const order: any = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (!order.return) return res.status(400).json({ message: "No return request found on this order" });

    const cur = String(order.return.status || "").toUpperCase();
    if (cur !== "REQUESTED") {
      return res.status(400).json({ message: `Return cannot be rejected from status: ${cur}` });
    }

    order.return.status = "REJECTED";
    order.return.rejectedAt = new Date();
    order.return.rejectReason = rejectReason;

    // If rejecting, clear approve fields (safe)
    order.return.approvedAt = null;
    order.return.approvedBy = null;

    await order.save();
    return res.json({ message: "Return rejected", data: order });
  } catch (err: any) {
    console.error("adminRejectReturn error:", err);
    return res.status(500).json({ message: "Reject failed", error: err?.message || "Unknown error" });
  }
};
