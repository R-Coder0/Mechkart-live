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

/** =========================
 * Shipping Markup (Vendor-only) — SAME RULE AS CHECKOUT
 * 0.5kg => 60, every next 0.5kg => +30
 * ========================= */
const calcShippingMarkup = (weightKg: any) => {
  const w = Number(weightKg || 0);
  if (!Number.isFinite(w) || w <= 0) return 0;

  const step = 0.5;
  const slabs = Math.ceil(w / step);
  const base = 60;
  const extra = Math.max(0, slabs - 1) * 30;
  return base + extra;
};

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSearchMatch(qRaw: string) {
  const q = toStr(qRaw);
  if (!q) return null;

  const rx = new RegExp(escapeRegex(q), "i");

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
 * ✅ Convert payable(order stored) -> vendorView(without shipping)
 * - order.items/subOrders store payable salePrice (shipping included)
 * - vendor should see baseSalePrice = salePrice - shippingMarkup
 * - vendor finalLineTotal = finalLineTotal - (shippingMarkup * qty)
 */
function applyVendorPriceViewToOrder(order: any, vendorObjectId: Types.ObjectId) {
  const subOrdersAll = Array.isArray(order?.subOrders) ? order.subOrders : [];
  const vendorSubs = subOrdersAll.filter((so: any) => String(so?.vendorId || "") === String(vendorObjectId));

  const patchedSubs = vendorSubs.map((so: any) => {
    const items = Array.isArray(so?.items) ? so.items : [];

    const patchedItems = items.map((it: any) => {
      const qty = Math.max(1, toNum(it?.qty, 1));

      // order saved payable
      const payableSale = toNum(it?.salePrice, 0);
      const payableMrp = toNum(it?.mrp, 0);

      // weight snapshot is in order item: it.ship.weightKg
      const weightKg = it?.ship?.weightKg ?? 0;
      const shipMarkupUnit = calcShippingMarkup(weightKg);

      // base(unit) = payable - markup
      const baseSale = Math.max(0, payableSale - shipMarkupUnit);
      const baseMrp = Math.max(0, payableMrp - shipMarkupUnit);

      // payable line totals
      const payableLine =
        toNum(it?.finalLineTotal, NaN) ||
        Math.max(0, payableSale * qty);

      // vendor line totals (remove shipping part)
      const baseLine = Math.max(0, payableLine - shipMarkupUnit * qty);

      return {
        ...it,
        vendorPricing: {
          shippingMarkupUnit: shipMarkupUnit,
          weightKg: toNum(weightKg, 0),
          baseMrp,
          baseSalePrice: baseSale,
          baseLineTotal: baseSale * qty,
          baseFinalLineTotal: baseLine,
        },
      };
    });

    const vendorSubtotal = patchedItems.reduce((sum: number, it: any) => {
      const v = toNum(it?.vendorPricing?.baseFinalLineTotal, NaN);
      if (Number.isFinite(v)) return sum + v;
      return sum;
    }, 0);

    return {
      ...so,
      items: patchedItems,
      vendorTotals: {
        subtotal: Math.round(vendorSubtotal * 100) / 100,
        shipping: 0,
        total: Math.round(vendorSubtotal * 100) / 100,
      },
    };
  });

  // shipments filter for vendor (same as your logic)
  const shipmentsAll = Array.isArray(order?.shipments) ? order.shipments : [];
  const vendorSubIds = patchedSubs.map((x: any) => String(x._id));

  const vendorShipments = shipmentsAll.filter((sh: any) => {
    const byVendor = String(sh?.vendorId || "") === String(vendorObjectId);
    const bySub = vendorSubIds.includes(String(sh?.subOrderId || ""));
    return byVendor || bySub;
  });

  return {
    ...order,
    subOrders: patchedSubs,
    shipments: vendorShipments,
  };
}

/**
 * ✅ List vendor orders (paginated)
 * Returns ONLY vendor subOrders + vendor relevant shipments.
 *
 * GET /api/vendor/orders?q=&status=&paymentMethod=&paymentStatus=&page=&limit=
 */
export const vendorFetchOrders = async (req: Request, res: Response) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(401).json({ message: "Unauthorized" });

    const vendorObjectId = new Types.ObjectId(String(vendorId));

    const q = toStr((req.query as any)?.q);
    const status = toStr((req.query as any)?.status).toUpperCase();
    const paymentMethod = toStr((req.query as any)?.paymentMethod).toUpperCase();
    const paymentStatus = toStr((req.query as any)?.paymentStatus).toUpperCase();

    const page = Math.max(1, toNum((req.query as any)?.page, 1));
    const limit = Math.min(50, Math.max(1, toNum((req.query as any)?.limit, 20)));
    const skip = (page - 1) * limit;

    const match: any = {
      "subOrders.vendorId": vendorObjectId,
    };

    const searchMatch = buildSearchMatch(q);
    if (searchMatch) Object.assign(match, searchMatch);

    if (paymentMethod) match.paymentMethod = paymentMethod;
    if (paymentStatus) match.paymentStatus = paymentStatus;

    if (status) {
      match.$or = match.$or || [];
      match.$or.push({ status });
      match.$or.push({
        subOrders: { $elemMatch: { vendorId: vendorObjectId, status } },
      });
    }

    // ✅ Aggregate: bring only needed fields + only vendor subOrders
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

          subOrders: {
            $filter: {
              input: "$subOrders",
              as: "so",
              cond: { $eq: ["$$so.vendorId", vendorObjectId] },
            },
          },

          shipments: 1,
          return: 1,
          refund: 1,
        },
      },
      {
        $addFields: {
          shipments: {
            $filter: {
              input: "$shipments",
              as: "sh",
              cond: {
                $or: [
                  { $eq: ["$$sh.vendorId", vendorObjectId] },
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

    const rawItems = out?.[0]?.items || [];
    const total = out?.[0]?.meta?.[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // ✅ POST-PROCESS: apply vendor pricing view (shipping removed)
    const items = rawItems.map((o: any) => applyVendorPriceViewToOrder(o, vendorObjectId));

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

    const order = await Order.findById(orderId)
      .populate({
        path: "subOrders.items.productId",
        select: "title productCode variants colors featureImage galleryImages",
      })
      .lean();

    if (!order) return res.status(404).json({ message: "Order not found" });

    const subOrdersAll = Array.isArray((order as any).subOrders) ? (order as any).subOrders : [];
    const vendorSubs = subOrdersAll.filter(
      (so: any) => String(so?.vendorId || "") === String(vendorObjectId)
    );

    if (!vendorSubs.length) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // ✅ Apply vendor view + shipment filter
    const scoped = applyVendorPriceViewToOrder(order as any, vendorObjectId);

    // return/refund pass-through (you already wanted this)
    return res.json({
      data: {
        ...scoped,
        return: (order as any).return || null,
        refund: (order as any).refund || null,
      },
    });
  } catch (e: any) {
    console.error("vendorGetOrderById error:", e);
    return res.status(500).json({ message: e?.message || "Server error" });
  }
};

/**
 * ✅ Vendor tracking
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
