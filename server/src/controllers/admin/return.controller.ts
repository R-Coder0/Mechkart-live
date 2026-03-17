/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { Order } from "../../models/Order.model";

const toStr = (v: any) => String(v ?? "").trim();
const toNum = (v: any, fb = 0) => {
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
] as const;

function isValidReturnStatus(s: string) {
  return (RETURN_STATUSES as readonly string[]).includes(s);
}

function oid(v: any) {
  return Types.ObjectId.isValid(String(v)) ? new Types.ObjectId(String(v)) : null;
}

/**
 * Flatten subOrders returns for admin list
 */
function flattenReturns(order: any) {
  const out: any[] = [];
  const subs = Array.isArray(order?.subOrders) ? order.subOrders : [];

  for (const so of subs) {
    const returns = Array.isArray(so?.returns) ? so.returns : [];
    for (const r of returns) {
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

        items: r.items || [],
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

/**
 * GET /api/admin/returns?status=REQUESTED&q=...&ownerType=VENDOR|ADMIN&page=&limit=
 * Returns flattened list of all subOrder returns.
 */
export const adminListReturnRequests = async (req: Request, res: Response) => {
  try {
    const status = toStr((req.query as any)?.status).toUpperCase();
    const q = toStr((req.query as any)?.q);
    const ownerType = toStr((req.query as any)?.ownerType).toUpperCase(); // ADMIN | VENDOR

    const page = Math.max(1, toNum((req.query as any)?.page, 1));
    const limit = Math.min(100, Math.max(10, toNum((req.query as any)?.limit, 20)));
    const skip = (page - 1) * limit;

    // Base filter: must have at least one return in any subOrder
    const filter: any = { "subOrders.returns.0": { $exists: true } };

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

    // Pull candidate orders, then flatten + status filter in memory
    // (keeps implementation simple + stable)
    const candidates = await Order.find(filter)
      .select(
        [
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
        ].join(" ")
      )
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    let rows = candidates.flatMap((o: any) => flattenReturns(o));

    if (status && isValidReturnStatus(status)) {
      rows = rows.filter((r) => String(r.returnStatus || "").toUpperCase() === status);
    }

    // sort by requestedAt desc
    rows.sort((a, b) => {
      const ta = a?.requestedAt ? new Date(a.requestedAt).getTime() : 0;
      const tb = b?.requestedAt ? new Date(b.requestedAt).getTime() : 0;
      return tb - ta;
    });

    // meta count (approx: based on candidate page). for true total, do separate aggregate later.
    // Minimal stable: return page slice only.
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
  } catch (err: any) {
    console.error("adminListReturnRequests error:", err);
    return res.status(500).json({
      message: "Failed to fetch return requests",
      error: err?.message || "Unknown error",
    });
  }
};

/**
 * POST /api/admin/orders/:orderId/suborders/:subOrderId/returns/:returnId/approve
 * Admin can approve ONLY if subOrder.ownerType === ADMIN
 */
export const adminApproveReturn = async (req: Request, res: Response) => {
  try {
    const { orderId, subOrderId, returnId } = req.params;

    if (!Types.ObjectId.isValid(orderId) || !Types.ObjectId.isValid(subOrderId) || !Types.ObjectId.isValid(returnId)) {
      return res.status(400).json({ message: "Invalid params" });
    }

    const order: any = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const subOrder = order.subOrders?.id(subOrderId);
    if (!subOrder) return res.status(404).json({ message: "SubOrder not found" });

    if (subOrder.ownerType !== "ADMIN") {
      return res.status(403).json({ message: "Vendor returns must be approved by vendor" });
    }

    const ret = subOrder.returns?.id(returnId);
    if (!ret) return res.status(404).json({ message: "Return not found" });

    const cur = String(ret.status || "").toUpperCase();
    if (cur !== "REQUESTED") {
      return res.status(400).json({ message: `Return cannot be approved from status: ${cur}` });
    }

    const adminId = oid((req as any)?.admin?._id);

    ret.status = "APPROVED";
    ret.approvedAt = new Date();
    ret.rejectedAt = null;
    ret.rejectReason = null;

    ret.handledByRole = "ADMIN";
    ret.handledById = adminId;

    await order.save();

    return res.json({ message: "Return approved (ADMIN subOrder)", data: { orderId, subOrderId, returnId } });
  } catch (err: any) {
    console.error("adminApproveReturn error:", err);
    return res.status(500).json({ message: "Approve failed", error: err?.message || "Unknown error" });
  }
};

/**
 * POST /api/admin/orders/:orderId/suborders/:subOrderId/returns/:returnId/reject
 * Admin can reject ONLY if subOrder.ownerType === ADMIN
 */
export const adminRejectReturn = async (req: Request, res: Response) => {
  try {
    const { orderId, subOrderId, returnId } = req.params;
    const rejectReason = toStr(req.body?.rejectReason || req.body?.reason);

    if (!rejectReason) return res.status(400).json({ message: "Reject reason is required" });

    if (!Types.ObjectId.isValid(orderId) || !Types.ObjectId.isValid(subOrderId) || !Types.ObjectId.isValid(returnId)) {
      return res.status(400).json({ message: "Invalid params" });
    }

    const order: any = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const subOrder = order.subOrders?.id(subOrderId);
    if (!subOrder) return res.status(404).json({ message: "SubOrder not found" });

    if (subOrder.ownerType !== "ADMIN") {
      return res.status(403).json({ message: "Vendor returns must be rejected by vendor" });
    }

    const ret = subOrder.returns?.id(returnId);
    if (!ret) return res.status(404).json({ message: "Return not found" });

    const cur = String(ret.status || "").toUpperCase();
    if (cur !== "REQUESTED") {
      return res.status(400).json({ message: `Return cannot be rejected from status: ${cur}` });
    }

    const adminId = oid((req as any)?.admin?._id);

    ret.status = "REJECTED";
    ret.rejectedAt = new Date();
    ret.rejectReason = rejectReason;

    ret.approvedAt = null;

    ret.handledByRole = "ADMIN";
    ret.handledById = adminId;

    await order.save();

    return res.json({ message: "Return rejected (ADMIN subOrder)", data: { orderId, subOrderId, returnId } });
  } catch (err: any) {
    console.error("adminRejectReturn error:", err);
    return res.status(500).json({ message: "Reject failed", error: err?.message || "Unknown error" });
  }
};