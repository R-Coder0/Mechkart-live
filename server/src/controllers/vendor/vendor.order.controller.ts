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

function buildSearchQuery(qRaw: string) {
  const q = toStr(qRaw);
  if (!q) return null;

  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(safe, "i");

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
 * ✅ Transform vendor subOrders items to show WITHOUT shipping
 * - mrp/salePrice => baseMrp/baseSalePrice from pricingMeta
 * - baseLineTotal => baseSalePrice * qty
 * - finalLineTotal => baseLineTotal - offerDiscount
 */
function transformVendorSubOrders(subOrders: any[]) {
  const out = (Array.isArray(subOrders) ? subOrders : []).map((so: any) => {
    const items = Array.isArray(so?.items) ? so.items : [];

    const newItems = items.map((it: any) => {
      const qty = toNum(it?.qty, 1) || 1;

      const baseMrp = toNum(it?.pricingMeta?.baseMrp ?? it?.mrp, 0);
      const baseSalePrice = toNum(it?.pricingMeta?.baseSalePrice ?? it?.salePrice ?? baseMrp, baseMrp);

      const offerDiscount = toNum(it?.offerDiscount, 0);

      const baseLineTotal = Math.round(baseSalePrice * qty * 100) / 100;
      const finalLineTotal = Math.max(
        0,
        Math.round((baseLineTotal - offerDiscount) * 100) / 100
      );

      return {
        ...it,

        // ✅ override shown prices (WITHOUT shipping)
        mrp: baseMrp,
        salePrice: baseSalePrice,

        // ✅ keep shipping separately for reference
        shippingMarkup: toNum(it?.pricingMeta?.shippingMarkup, 0),
        weightKg: toNum(it?.pricingMeta?.weightKg, 0),

        baseLineTotal,
        finalLineTotal,
      };
    });

    const subtotal = Math.round(newItems.reduce((s: number, x: any) => s + toNum(x.finalLineTotal, 0), 0) * 100) / 100;

    return {
      ...so,
      items: newItems,

      // ✅ override vendor totals WITHOUT shipping
      subtotal,
      shipping: 0,
      total: subtotal,
    };
  });

  return out;
}

/**
 * ✅ Filter shipments for vendor only (by vendorId OR by subOrderId)
 */
function filterVendorShipments(order: any, vendorObjectId: Types.ObjectId, vendorSubOrders: any[]) {
  const shipmentsAll = Array.isArray(order?.shipments) ? order.shipments : [];
  const vendorSubIds = vendorSubOrders.map((x: any) => String(x?._id));

  return shipmentsAll.filter((sh: any) => {
    const byVendor = String(sh?.vendorId || "") === String(vendorObjectId);
    const bySub = vendorSubIds.includes(String(sh?.subOrderId || ""));
    return byVendor || bySub;
  });
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
    const status = toStr((req.query as any)?.status).toUpperCase();
    const paymentMethod = toStr((req.query as any)?.paymentMethod).toUpperCase();
    const paymentStatus = toStr((req.query as any)?.paymentStatus).toUpperCase();

    const page = Math.max(1, toNum((req.query as any)?.page, 1));
    const limit = Math.min(50, Math.max(1, toNum((req.query as any)?.limit, 20)));
    const skip = (page - 1) * limit;

    // base match: order contains vendor subOrder
    const filter: any = {
      "subOrders.vendorId": vendorObjectId,
    };

    const search = buildSearchQuery(q);
    if (search) Object.assign(filter, search);

    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    // status filter: match either parent OR vendor subOrder
    if (status) {
      filter.$or = filter.$or || [];
      filter.$or.push({ status });
      filter.$or.push({ subOrders: { $elemMatch: { vendorId: vendorObjectId, status } } });
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          [
            "orderCode",
            "status",
            "paymentMethod",
            "paymentStatus",
            "totals",
            "contact",
            "address",
            "pg",
            "cod",
            "subOrders",
            "shipments",
            "return",
            "refund",
            "createdAt",
            "updatedAt",
          ].join(" ")
        )
        .lean(),
      Order.countDocuments(filter),
    ]);

    // scope results to vendor
    const items = (orders || []).map((order: any) => {
      const subOrdersAll = Array.isArray(order?.subOrders) ? order.subOrders : [];
      const vendorSubs = subOrdersAll.filter((so: any) => String(so?.vendorId || "") === String(vendorObjectId));

      const vendorSubsTransformed = transformVendorSubOrders(vendorSubs);
      const vendorShipments = filterVendorShipments(order, vendorObjectId, vendorSubsTransformed);

      // ✅ optional: vendorTotals from vendor subOrders
      const vendorSubtotal = Math.round(
        vendorSubsTransformed.reduce((s: number, so: any) => s + toNum(so?.subtotal, 0), 0) * 100
      ) / 100;

      return {
        ...order,
        subOrders: vendorSubsTransformed,
        shipments: vendorShipments,

        // ✅ vendor-centric totals (WITHOUT shipping)
        vendorTotals: {
          subtotal: vendorSubtotal,
          shipping: 0,
          grandTotal: vendorSubtotal,
        },
      };
    });

    return res.json({
      data: {
        items,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
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
        select: "title productCode variants colors featureImage galleryImages ship ownerType vendorId",
      })
      .lean();

    if (!order) return res.status(404).json({ message: "Order not found" });

    const subOrdersAll = Array.isArray((order as any).subOrders) ? (order as any).subOrders : [];
    const vendorSubs = subOrdersAll.filter(
      (so: any) => String(so?.vendorId || "") === String(vendorObjectId)
    );

    if (!vendorSubs.length) return res.status(403).json({ message: "Forbidden" });

    const vendorSubsTransformed = transformVendorSubOrders(vendorSubs);
    const vendorShipments = filterVendorShipments(order, vendorObjectId, vendorSubsTransformed);

    const vendorSubtotal = Math.round(
      vendorSubsTransformed.reduce((s: number, so: any) => s + toNum(so?.subtotal, 0), 0) * 100
    ) / 100;

    return res.json({
      data: {
        ...(order as any),
        subOrders: vendorSubsTransformed,
        shipments: vendorShipments,
        vendorTotals: {
          subtotal: vendorSubtotal,
          shipping: 0,
          grandTotal: vendorSubtotal,
        },
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

    const order = await Order.findById(orderId).select("orderCode status paymentMethod paymentStatus createdAt shipments subOrders").lean();
    if (!order) return res.status(404).json({ message: "Order not found" });

    const subOrdersAll = Array.isArray((order as any).subOrders) ? (order as any).subOrders : [];
    const vendorSubs = subOrdersAll.filter(
      (so: any) => String(so?.vendorId || "") === String(vendorObjectId)
    );
    if (!vendorSubs.length) return res.status(403).json({ message: "Forbidden" });

    const vendorShipments = filterVendorShipments(order, vendorObjectId, vendorSubs);

    return res.json({
      data: {
        orderId: String((order as any)._id),
        orderCode: (order as any).orderCode,
        status: (order as any).status,
        paymentMethod: (order as any).paymentMethod,
        paymentStatus: (order as any).paymentStatus,
        createdAt: (order as any).createdAt,
        shipments: vendorShipments,
      },
    });
  } catch (e: any) {
    console.error("vendorGetOrderTracking error:", e);
    return res.status(500).json({ message: e?.message || "Server error" });
  }
};
