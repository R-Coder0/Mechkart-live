/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { Order } from "../../models/Order.model";

const toStr = (v: any) => String(v ?? "").trim();

const allowedStatuses = ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
const allowedPaymentMethods = ["COD", "ONLINE"] as const;
const allowedPaymentStatuses = ["PENDING", "PAID", "FAILED"] as const;

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

    if (paymentStatus && (allowedPaymentStatuses as any).includes(paymentStatus)) {
      filter.paymentStatus = paymentStatus;
    }

    if (q) {
      filter.$or = [
        { orderCode: { $regex: q, $options: "i" } },
        { "contact.phone": { $regex: q, $options: "i" } },
        { "contact.name": { $regex: q, $options: "i" } },
        { "pg.orderId": { $regex: q, $options: "i" } },
        { "pg.paymentId": { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      Order.find(filter)
        .populate({
          path: "items.productId",
          select: "title variants colors galleryImages featureImage",
        })
        .select(
          "orderCode userId items totals appliedOffer contact address paymentMethod paymentStatus status pg cod createdAt updatedAt"
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
    return res.status(500).json({ message: "Failed to fetch orders", error: err?.message || "Unknown error" });
  }
};

export const adminUpdateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    if (!Types.ObjectId.isValid(orderId)) return res.status(400).json({ message: "Invalid orderId" });

    const nextStatus = toStr(req.body?.status);
    if (!allowedStatuses.includes(nextStatus as any)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order: any = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const pm = String(order.paymentMethod || "COD").toUpperCase();
    const ps = String(order.paymentStatus || "PENDING").toUpperCase();
    const cur = String(order.status || "PLACED").toUpperCase();

    // ✅ Guardrails
    // 1) ONLINE must be PAID before SHIPPED/DELIVERED
    if (pm === "ONLINE" && ps !== "PAID") {
      if (["SHIPPED", "DELIVERED"].includes(nextStatus)) {
        return res.status(400).json({
          message: "Cannot mark as SHIPPED/DELIVERED until ONLINE payment is PAID",
        });
      }
    }

    // 2) COD must be CONFIRMED before SHIPPED/DELIVERED
    if (pm === "COD" && cur === "PLACED") {
      if (["SHIPPED", "DELIVERED"].includes(nextStatus)) {
        return res.status(400).json({
          message: "Cannot mark SHIPPED/DELIVERED until COD is CONFIRMED",
        });
      }
      // COD confirm dropdown se block (must use confirm-cod)
      if (nextStatus === "CONFIRMED") {
        return res.status(400).json({ message: "Use Confirm COD button to confirm COD orders." });
      }
    }

    // 3) DELIVERED/CANCELLED lock
    if (cur === "DELIVERED" && nextStatus !== "DELIVERED") {
      return res.status(400).json({ message: "Delivered order status cannot be changed" });
    }
    if (cur === "CANCELLED" && nextStatus !== "CANCELLED") {
      return res.status(400).json({ message: "Cancelled order status cannot be changed" });
    }

    // ✅ Apply status
    order.status = nextStatus as any;

    // ✅ IMPORTANT FIX:
    // COD order delivered ⇒ mark paymentStatus as PAID
    if (pm === "COD" && nextStatus === "DELIVERED") {
      order.paymentStatus = "PAID";
    }

    await order.save();

    return res.json({ message: "Order status updated", data: order });
  } catch (err: any) {
    console.error("adminUpdateOrderStatus error:", err);
    return res.status(500).json({ message: "Status update failed", error: err?.message || "Unknown error" });
  }
};

// ✅ NEW: Confirm COD Order
export const adminConfirmCodOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    if (!Types.ObjectId.isValid(orderId)) return res.status(400).json({ message: "Invalid orderId" });

    const order: any = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (String(order.paymentMethod) !== "COD") {
      return res.status(400).json({ message: "Only COD orders can be confirmed here" });
    }

    if (String(order.status) !== "PLACED") {
      return res.status(400).json({
        message: `COD order can be confirmed only from PLACED (current: ${order.status})`,
      });
    }

    const adminId = (req as any)?.admin?._id ? new Types.ObjectId(String((req as any).admin._id)) : null;

    order.status = "CONFIRMED";
    order.cod = { confirmedAt: new Date(), confirmedBy: adminId };

    await order.save();

    return res.json({ message: "COD order confirmed", data: order });
  } catch (err: any) {
    console.error("adminConfirmCodOrder error:", err);
    return res.status(500).json({ message: "COD confirm failed", error: err?.message || "Unknown error" });
  }
};
