/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { Order } from "../../models/Order.model";
import { applyWalletEffectsForOrder } from "../../services/vendorWallet.service";

const toStr = (v: any) => String(v ?? "").trim();

const allowedStatuses = ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
const allowedSubOrderStatuses = ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

const allowedPaymentMethods = ["COD", "ONLINE"] as const;

// ✅ include COD_PENDING_CONFIRMATION (as per Order.model)
const allowedPaymentStatuses = ["PENDING", "PAID", "FAILED", "COD_PENDING_CONFIRMATION"] as const;

function isValidObjectId(id: any) {
  return Types.ObjectId.isValid(String(id || ""));
}

function upper(v: any) {
  return String(v || "").toUpperCase();
}

// ----------------------------------------------------
// GET ADMIN ORDERS (Paginated + Filters)
// ----------------------------------------------------
export const adminGetOrders = async (req: Request, res: Response) => {
  try {
    const q = toStr(req.query.q);
    const status = toStr(req.query.status);
    const paymentMethod = toStr(req.query.paymentMethod);
    const paymentStatus = toStr(req.query.paymentStatus);

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (status && allowedStatuses.includes(status as any)) filter.status = status;

    if (paymentMethod && (allowedPaymentMethods as any).includes(paymentMethod)) {
      filter.paymentMethod = paymentMethod;
    }

    if (paymentStatus && (allowedPaymentStatuses as any).includes(paymentStatus as any)) {
      filter.paymentStatus = paymentStatus;
    }

    if (q) {
      filter.$or = [
        { orderCode: { $regex: q, $options: "i" } },
        { "contact.phone": { $regex: q, $options: "i" } },
        { "contact.name": { $regex: q, $options: "i" } },
        { "pg.orderId": { $regex: q, $options: "i" } },
        { "pg.paymentId": { $regex: q, $options: "i" } },
        { "subOrders.vendorName": { $regex: q, $options: "i" } },
        { "subOrders.soldBy": { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      Order.find(filter)
.populate({ path: "items.productId", select: "title variants colors galleryImages featureImage ship ownerType vendorId" })
.populate({ path: "subOrders.items.productId", select: "title variants colors galleryImages featureImage ship ownerType vendorId" })
        .select(
          [
            "orderCode",
            "userId",
            "items",
            "subOrders",
            "totals",
            "appliedOffer",
            "contact",
            "address",
            "paymentMethod",
            "paymentStatus",
            "status",
            "pg",
            "cod",
            "shipments",
            "return",
            "refund",
            "ship",
            "createdAt",
            "updatedAt",
          ].join(" ")
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return res.json({
      message: "Admin orders fetched",
      data: { items, page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    console.error("adminGetOrders error:", err);
    return res.status(500).json({
      message: "Failed to fetch orders",
      error: err?.message || "Unknown error",
    });
  }
};

// ----------------------------------------------------
// UPDATE STATUS (Parent OR SubOrder)
// ----------------------------------------------------
export const adminUpdateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    if (!isValidObjectId(orderId)) return res.status(400).json({ message: "Invalid orderId" });

    const nextStatus = upper(req.body?.status);
    const subOrderId = toStr(req.body?.subOrderId);

    if (!allowedStatuses.includes(nextStatus as any)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order: any = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const pm = upper(order.paymentMethod || "COD");
    const ps = upper(order.paymentStatus || "PENDING");
    const cur = upper(order.status || "PLACED");

    // -----------------
    // Shared guardrails
    // -----------------

    // ONLINE must be PAID before SHIPPED/DELIVERED
    if (pm === "ONLINE" && ps !== "PAID" && ["SHIPPED", "DELIVERED"].includes(nextStatus)) {
      return res.status(400).json({
        message: "Cannot mark as SHIPPED/DELIVERED until ONLINE payment is PAID",
      });
    }

    // ✅ FIX (ISSUE #1):
    // COD must be "confirmed" before SHIPPED/DELIVERED
    // Do NOT rely on current status === CONFIRMED (because once shipped, status becomes SHIPPED).
    if (pm === "COD") {
      const codConfirmed =
        !!order?.cod?.confirmedAt ||
        ps === "COD_PENDING_CONFIRMATION" ||
        ps === "PAID";

      if (!codConfirmed && ["SHIPPED", "DELIVERED"].includes(nextStatus)) {
        return res.status(400).json({
          message: "Cannot mark SHIPPED/DELIVERED until COD is CONFIRMED",
        });
      }

      // enforce COD confirm via button (only from PLACED)
      if (nextStatus === "CONFIRMED" && cur === "PLACED") {
        return res.status(400).json({ message: "Use Confirm COD button to confirm COD orders." });
      }
    }

    // DELIVERED/CANCELLED lock at parent level
    if (!subOrderId) {
      if (cur === "DELIVERED" && nextStatus !== "DELIVERED") {
        return res.status(400).json({ message: "Delivered order status cannot be changed" });
      }
      if (cur === "CANCELLED" && nextStatus !== "CANCELLED") {
        return res.status(400).json({ message: "Cancelled order status cannot be changed" });
      }
    }

    // -----------------
    // SubOrder update
    // -----------------
    if (subOrderId) {
      if (!isValidObjectId(subOrderId)) {
        return res.status(400).json({ message: "Invalid subOrderId" });
      }

      const subOrders = Array.isArray(order.subOrders) ? order.subOrders : [];
      const so = subOrders.find((x: any) => String(x._id) === String(subOrderId));

      if (!so) return res.status(404).json({ message: "SubOrder not found" });

      const soCur = upper(so.status || "PLACED");

      if (soCur === "DELIVERED" && nextStatus !== "DELIVERED") {
        return res.status(400).json({ message: "Delivered subOrder status cannot be changed" });
      }
      if (soCur === "CANCELLED" && nextStatus !== "CANCELLED") {
        return res.status(400).json({ message: "Cancelled subOrder status cannot be changed" });
      }

      so.status = nextStatus;

      await order.save();
      await applyWalletEffectsForOrder(order);

      const fresh: any = await Order.findById(orderId).lean();
      const soArr = Array.isArray(fresh?.subOrders) ? fresh.subOrders : [];

      const allCancelled = soArr.length > 0 && soArr.every((x: any) => upper(x.status) === "CANCELLED");
      const allDelivered = soArr.length > 0 && soArr.every((x: any) => upper(x.status) === "DELIVERED");
      const anyShipped = soArr.some((x: any) => upper(x.status) === "SHIPPED");
      const anyConfirmed = soArr.some((x: any) => upper(x.status) === "CONFIRMED");

      const parentUpdate: any = {};

      if (allCancelled) parentUpdate.status = "CANCELLED";
      else if (allDelivered) parentUpdate.status = "DELIVERED";
      else if (anyShipped) parentUpdate.status = "SHIPPED";
      else if (anyConfirmed) parentUpdate.status = "CONFIRMED";
      else parentUpdate.status = "PLACED";

      // COD delivered => PAID (only when full order delivered)
      if (pm === "COD" && parentUpdate.status === "DELIVERED") {
        parentUpdate.paymentStatus = "PAID";
      }

      await Order.updateOne({ _id: new Types.ObjectId(orderId) }, { $set: parentUpdate });

      const updated = await Order.findById(orderId).lean();
      return res.json({ message: "SubOrder status updated", data: updated });
    }

    // -----------------
    // Parent update
    // -----------------
    order.status = nextStatus as any;

    // ✅ Sync subOrders with parent status (skip locked)
    if (Array.isArray(order.subOrders) && order.subOrders.length) {
      for (const so of order.subOrders) {
        const soCur = upper(so.status || "PLACED");
        if (soCur === "CANCELLED" || soCur === "DELIVERED") continue;
        so.status = nextStatus;
      }
    }

    // COD delivered => PAID
    if (pm === "COD" && nextStatus === "DELIVERED") {
      order.paymentStatus = "PAID";
    }

    await order.save();

    await applyWalletEffectsForOrder(order);

    return res.json({ message: "Order status updated", data: order });
  } catch (err: any) {
    console.error("adminUpdateOrderStatus error:", err);
    return res.status(500).json({
      message: "Status update failed",
      error: err?.message || "Unknown error",
    });
  }
};

// ----------------------------------------------------
// CONFIRM COD ORDER (Parent + SubOrders)
// ----------------------------------------------------
export const adminConfirmCodOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    if (!isValidObjectId(orderId)) return res.status(400).json({ message: "Invalid orderId" });

    const order: any = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (upper(order.paymentMethod) !== "COD") {
      return res.status(400).json({ message: "Only COD orders can be confirmed here" });
    }

    const cur = upper(order.status);
    if (cur !== "PLACED") {
      return res.status(400).json({
        message: `COD order can be confirmed only from PLACED (current: ${order.status})`,
      });
    }

    const adminId = (req as any)?.admin?._id ? new Types.ObjectId(String((req as any).admin._id)) : null;

    order.status = "CONFIRMED";
    order.paymentStatus = "COD_PENDING_CONFIRMATION";

    order.cod = {
      ...(order.cod || {}),
      confirmedAt: new Date(),
      confirmedBy: adminId,
    };

    if (Array.isArray(order.subOrders) && order.subOrders.length) {
      for (const so of order.subOrders) {
        const soCur = upper(so.status);
        if (soCur === "CANCELLED" || soCur === "DELIVERED") continue;
        so.status = "CONFIRMED";
      }
    }

    await order.save();

    return res.json({ message: "COD order confirmed", data: order });
  } catch (err: any) {
    console.error("adminConfirmCodOrder error:", err);
    return res.status(500).json({
      message: "COD confirm failed",
      error: err?.message || "Unknown error",
    });
  }
};
