/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { Order } from "../../models/Order.model";

// helpers
const toStr = (v: any) => String(v ?? "").trim();
const toNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

// ✅ get vendorId from middleware (assumed: verifyVendor)
const getVendorId = (req: Request) => (req as any)?.vendor?._id || (req as any)?.vendorId;

function buildSearchMatch(qRaw: string) {
  const q = toStr(qRaw);
  if (!q) return null;

  // allow search by: orderCode, name, phone, razorpay ids
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  return {
    $or: [
      { orderCode: rx },
      { "contact.name": rx },
      { "contact.phone": rx },
      { "address.fullName": rx },
      { "address.phone": rx },
      { "pg.orderId": rx },
      { "pg.paymentId": rx },
    ],
  };
}

/**
 * ✅ List vendor orders (paginated)
 * Returns ONLY vendor's subOrders + vendor relevant shipments.
 *
 * GET /api/vendor/orders?q=&status=&paymentMethod=&paymentStatus=&page=&limit=
 */
export const vendorFetchOrders = async (req: Request, res: Response) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(401).json({ message: "Unauthorized" });

    const vendorObjectId = new Types.ObjectId(String(vendorId));

    const q = toStr((req.query as any)?.q);
    const status = toStr((req.query as any)?.status).toUpperCase(); // optional
    const paymentMethod = toStr((req.query as any)?.paymentMethod).toUpperCase(); // COD/ONLINE
    const paymentStatus = toStr((req.query as any)?.paymentStatus).toUpperCase(); // PENDING/PAID/FAILED

    const page = Math.max(1, toNum((req.query as any)?.page, 1));
    const limit = Math.min(50, Math.max(1, toNum((req.query as any)?.limit, 20)));
    const skip = (page - 1) * limit;

    // ✅ base match: order must contain vendor subOrder
    const match: any = {
      "subOrders.vendorId": vendorObjectId,
    };

    const searchMatch = buildSearchMatch(q);
    if (searchMatch) Object.assign(match, searchMatch);

    if (paymentMethod) match.paymentMethod = paymentMethod;
    if (paymentStatus) match.paymentStatus = paymentStatus;

    // status filter:
    // - if provided, match either order.status OR any subOrder.status for this vendor
    if (status) {
      match.$or = match.$or || [];
      match.$or.push({ status });
      match.$or.push({
        subOrders: {
          $elemMatch: { vendorId: vendorObjectId, status },
        },
      });
    }

    // ✅ Aggregate: filter subOrders to ONLY vendor + filter shipments to ONLY vendor
    const pipeline: any[] = [
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          orderCode: 1,
          status: 1,
          paymentMethod: 1,
          paymentStatus: 1,
          totals: 1,
          totalAmount: 1,
          createdAt: 1,
          updatedAt: 1,

          contact: 1,
          address: 1,
          pg: 1,
          cod: 1,

          // ✅ only vendor subOrders
          subOrders: {
            $filter: {
              input: "$subOrders",
              as: "so",
              cond: { $eq: ["$$so.vendorId", vendorObjectId] },
            },
          },

          // ✅ only vendor shipments (by vendorId OR by subOrderId in vendor's subOrders)
          shipments: 1,

          // return/refund pass-through (for now)
          return: 1,
          refund: 1,
        },
      },
      {
        $addFields: {
          // keep only vendor shipments
          shipments: {
            $filter: {
              input: "$shipments",
              as: "sh",
              cond: {
                $or: [
                  { $eq: ["$$sh.vendorId", vendorObjectId] },
                  // sometimes shipment has subOrderId; match with vendor subOrders
                  {
                    $in: [
                      "$$sh.subOrderId",
                      {
                        $map: {
                          input: "$subOrders",
                          as: "so",
                          in: "$$so._id",
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          meta: [{ $count: "total" }],
        },
      },
    ];

    const out = await Order.aggregate(pipeline);

    const items = out?.[0]?.items || [];
    const total = out?.[0]?.meta?.[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.json({
      data: {
        items,
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (e: any) {
    console.error("vendorFetchOrders error:", e);
    return res.status(500).json({ message: e?.message || "Server error" });
  }
};

/**
 * ✅ Vendor order details (scoped)
 * GET /api/vendor/orders/:orderId
 * returns only vendor subOrders + vendor shipments
 */
export const vendorGetOrderById = async (req: Request, res: Response) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(401).json({ message: "Unauthorized" });

    const vendorObjectId = new Types.ObjectId(String(vendorId));
    const orderId = toStr(req.params.orderId);

    if (!Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    // ✅ load order with populate (so UI can show variant from product.variants)
    const order = await Order.findById(orderId)
      .populate({
        path: "subOrders.items.productId",
        select: "title productCode variants colors featureImage galleryImages",
      })
      .lean();

    if (!order) return res.status(404).json({ message: "Order not found" });

    // ✅ ensure vendor has access
    const subOrdersAll = Array.isArray((order as any).subOrders) ? (order as any).subOrders : [];
    const vendorSubs = subOrdersAll.filter(
      (so: any) => String(so?.vendorId || "") === String(vendorObjectId)
    );

    if (!vendorSubs.length) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // ✅ filter shipments for vendor
    const shipmentsAll = Array.isArray((order as any).shipments) ? (order as any).shipments : [];
    const vendorSubIds = vendorSubs.map((x: any) => String(x._id));
    const vendorShipments = shipmentsAll.filter((sh: any) => {
      const byVendor = String(sh?.vendorId || "") === String(vendorObjectId);
      const bySub = vendorSubIds.includes(String(sh?.subOrderId || ""));
      return byVendor || bySub;
    });

    const scoped = {
      ...(order as any),
      subOrders: vendorSubs,
      shipments: vendorShipments,
      // return/refund pass-through as asked (UI column only for now)
      return: (order as any).return || null,
      refund: (order as any).refund || null,
    };

    return res.json({ data: scoped });
  } catch (e: any) {
    console.error("vendorGetOrderById error:", e);
    return res.status(500).json({ message: e?.message || "Server error" });
  }
};

/**
 * ✅ Vendor tracking (optional but useful)
 * GET /api/vendor/orders/:orderId/tracking
 * returns only vendor shipments tracking data
 */
export const vendorGetOrderTracking = async (req: Request, res: Response) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(401).json({ message: "Unauthorized" });

    const vendorObjectId = new Types.ObjectId(String(vendorId));
    const orderId = toStr(req.params.orderId);

    if (!Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });

    // ensure vendor has access
    const subOrdersAll = Array.isArray((order as any).subOrders) ? (order as any).subOrders : [];
    const vendorSubs = subOrdersAll.filter(
      (so: any) => String(so?.vendorId || "") === String(vendorObjectId)
    );
    if (!vendorSubs.length) return res.status(403).json({ message: "Forbidden" });

    const vendorSubIds = vendorSubs.map((x: any) => String(x._id));
    const shipmentsAll = Array.isArray((order as any).shipments) ? (order as any).shipments : [];

    const shipments = shipmentsAll.filter((sh: any) => {
      const byVendor = String(sh?.vendorId || "") === String(vendorObjectId);
      const bySub = vendorSubIds.includes(String(sh?.subOrderId || ""));
      return byVendor || bySub;
    });

    return res.json({
      data: {
        orderId: String((order as any)._id),
        orderCode: (order as any).orderCode,
        status: (order as any).status,
        paymentMethod: (order as any).paymentMethod,
        paymentStatus: (order as any).paymentStatus,
        createdAt: (order as any).createdAt,
        shipments,
      },
    });
  } catch (e: any) {
    console.error("vendorGetOrderTracking error:", e);
    return res.status(500).json({ message: e?.message || "Server error" });
  }
};
