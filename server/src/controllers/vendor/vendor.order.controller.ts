/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { Order } from "../../models/Order.model";
import { shiprocketGenerateLabel } from "../../services/shiprocket.service";

// helpers
const toStr = (v: any) => String(v ?? "").trim();
const toNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const firstNonEmptyString = (...values: any[]) => {
  for (const value of values) {
    const text = toStr(value);
    if (text) return text;
  }
  return "";
};

function hydrateShiprocketShipment(shipment: any) {
  if (!shipment?.shiprocket) return shipment;

  const sr = shipment.shiprocket || {};
  const rawAwb = sr?.raw?.awb || {};
  const awb = firstNonEmptyString(
    sr?.awb,
    rawAwb?.awb_code,
    rawAwb?.awb,
    rawAwb?.response?.data?.awb_code,
    rawAwb?.response?.data?.awb,
    rawAwb?.data?.awb_code,
    rawAwb?.data?.awb,
    rawAwb?.response?.awb_code,
    rawAwb?.response?.awb
  );

  const labelUrl = firstNonEmptyString(
    sr?.labelUrl,
    sr?.raw?.label?.label_url,
    sr?.raw?.label?.data?.label_url
  );

  return {
    ...shipment,
    shiprocket: {
      ...sr,
      awb: awb || null,
      labelUrl: labelUrl || null,
    },
  };
}

function hydrateOrderShipmentData(order: any) {
  const subOrders = Array.isArray(order?.subOrders)
    ? order.subOrders.map((so: any) => ({
        ...so,
        shipment: so?.shipment ? hydrateShiprocketShipment(so.shipment) : so?.shipment ?? null,
      }))
    : [];

  const shipments = Array.isArray(order?.shipments)
    ? order.shipments.map((shipment: any) => hydrateShiprocketShipment(shipment))
    : [];

  return {
    ...order,
    subOrders,
    shipments,
  };
}

function sanitizeCustomerContactForVendor(order: any) {
  return {
    ...order,
    contact: order?.contact
      ? {
          ...order.contact,
          phone: null,
        }
      : order?.contact ?? null,
    address: order?.address
      ? {
          ...order.address,
          phone: null,
        }
      : order?.address ?? null,
  };
}

const getVendorId = (req: Request) =>
  (req as any)?.vendor?._id || (req as any)?.vendorId;


/* =========================
   SHIPPING CALC
========================= */

const calcShippingMarkup = (weightKg: any) => {
  const w = Number(weightKg || 0);
  if (!Number.isFinite(w) || w <= 0) return 0;

  const step = 0.5;
  const slabs = Math.ceil(w / step);
  const base = 60;
  const extra = Math.max(0, slabs - 1) * 30;

  return base + extra;
};


/* =========================
   SEARCH HELPERS
========================= */

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


/* =========================
   VENDOR VIEW TRANSFORM
========================= */

function applyVendorPriceViewToOrder(order: any, vendorObjectId: Types.ObjectId) {
  const hydratedOrder = sanitizeCustomerContactForVendor(hydrateOrderShipmentData(order));

  const subOrdersAll = Array.isArray(hydratedOrder?.subOrders) ? hydratedOrder.subOrders : [];

  const vendorSubs = subOrdersAll.filter(
    (so: any) => String(so?.vendorId || "") === String(vendorObjectId)
  );

  const patchedSubs = vendorSubs.map((so: any) => {

    const items = Array.isArray(so?.items) ? so.items : [];

    const patchedItems = items.map((it: any) => {

      const qty = Math.max(1, toNum(it?.qty, 1));

      const payableSale = toNum(it?.salePrice, 0);
      const payableMrp = toNum(it?.mrp, 0);

      const weightKg = it?.ship?.weightKg ?? 0;

      const shipMarkupUnit = calcShippingMarkup(weightKg);

      const baseSale = Math.max(0, payableSale - shipMarkupUnit);
      const baseMrp = Math.max(0, payableMrp - shipMarkupUnit);

      const payableLine =
        toNum(it?.finalLineTotal, NaN) ||
        Math.max(0, payableSale * qty);

      const baseLine =
        Math.max(0, payableLine - shipMarkupUnit * qty);

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


  /* =========================
     FIXED SHIPMENT FILTER
  ========================= */

  const shipmentsAll = Array.isArray(hydratedOrder?.shipments)
    ? hydratedOrder.shipments
    : [];

  const vendorSubIds = patchedSubs.map((x: any) =>
    String(x._id)
  );

  const vendorShipments = shipmentsAll.filter((sh: any) => {

    const byVendor =
      String(sh?.vendorId || "") === String(vendorObjectId);

    const bySub =
      vendorSubIds.includes(String(sh?.subOrderId || ""));

    // ✅ NEW fallback (admin shipment)
    const orderLevel =
      !sh?.vendorId && !sh?.subOrderId;

    return byVendor || bySub || orderLevel;

  });

  return {
    ...hydratedOrder,
    subOrders: patchedSubs,
    shipments: vendorShipments,
  };
}


/* =========================
   LIST VENDOR ORDERS
========================= */

export const vendorFetchOrders = async (req: Request, res: Response) => {

  try {

    const vendorId = getVendorId(req);

    if (!vendorId)
      return res.status(401).json({ message: "Unauthorized" });

    const vendorObjectId =
      new Types.ObjectId(String(vendorId));

    const q = toStr((req.query as any)?.q);

    const status =
      toStr((req.query as any)?.status).toUpperCase();

    const paymentMethod =
      toStr((req.query as any)?.paymentMethod).toUpperCase();

    const paymentStatus =
      toStr((req.query as any)?.paymentStatus).toUpperCase();

    const page = Math.max(
      1,
      toNum((req.query as any)?.page, 1)
    );

    const limit = Math.min(
      50,
      Math.max(1, toNum((req.query as any)?.limit, 20))
    );

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
        subOrders: {
          $elemMatch: {
            vendorId: vendorObjectId,
            status,
          },
        },
      });
    }


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
              cond: {
                $eq: ["$$so.vendorId", vendorObjectId],
              },
            },
          },

          shipments: 1,
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

    const totalPages =
      Math.max(1, Math.ceil(total / limit));


    const items = rawItems.map((o: any) =>
      applyVendorPriceViewToOrder(o, vendorObjectId)
    );


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

    return res
      .status(500)
      .json({ message: e?.message || "Server error" });

  }
};


/* =========================
   GET ORDER DETAILS
========================= */

export const vendorGetOrderById = async (req: Request, res: Response) => {

  try {

    const vendorId = getVendorId(req);

    if (!vendorId)
      return res.status(401).json({ message: "Unauthorized" });

    const vendorObjectId =
      new Types.ObjectId(String(vendorId));

    const orderId = toStr(req.params.orderId);

    if (!Types.ObjectId.isValid(orderId))
      return res
        .status(400)
        .json({ message: "Invalid order id" });


    const order = await Order.findById(orderId)
      .populate({
        path: "subOrders.items.productId",
        select:
          "title productCode variants colors featureImage galleryImages",
      })
      .lean();


    if (!order)
      return res.status(404).json({ message: "Order not found" });


    const scoped =
      applyVendorPriceViewToOrder(order, vendorObjectId);


    return res.json({
      data: scoped,
    });

  } catch (e: any) {

    console.error("vendorGetOrderById error:", e);

    return res
      .status(500)
      .json({ message: e?.message || "Server error" });

  }
};


/* =========================
   VENDOR TRACKING
========================= */

export const vendorGetOrderTracking = async (req: Request, res: Response) => {

  try {

    const vendorId = getVendorId(req);

    if (!vendorId)
      return res.status(401).json({ message: "Unauthorized" });

    const vendorObjectId =
      new Types.ObjectId(String(vendorId));

    const orderId = toStr(req.params.orderId);

    if (!Types.ObjectId.isValid(orderId))
      return res
        .status(400)
        .json({ message: "Invalid order id" });


    const order = hydrateOrderShipmentData(await Order.findById(orderId).lean());

    if (!order)
      return res.status(404).json({ message: "Order not found" });


    const subOrdersAll =
      Array.isArray((order as any).subOrders)
        ? (order as any).subOrders
        : [];

    const vendorSubs = subOrdersAll.filter(
      (so: any) =>
        String(so?.vendorId || "") ===
        String(vendorObjectId)
    );

    if (!vendorSubs.length)
      return res.status(403).json({ message: "Forbidden" });


    const vendorSubIds = vendorSubs.map((x: any) =>
      String(x._id)
    );

    const shipmentsAll =
      Array.isArray((order as any).shipments)
        ? (order as any).shipments
        : [];


    const shipments = shipmentsAll.filter((sh: any) => {

      const byVendor =
        String(sh?.vendorId || "") ===
        String(vendorObjectId);

      const bySub =
        vendorSubIds.includes(
          String(sh?.subOrderId || "")
        );

      const orderLevel =
        !sh?.vendorId && !sh?.subOrderId;

      return byVendor || bySub || orderLevel;

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

    return res
      .status(500)
      .json({ message: e?.message || "Server error" });

  }
};

/* =========================
   GENERATE / GET LABEL
========================= */

export const vendorGenerateOrderLabel = async (req: Request, res: Response) => {
  try {
    const vendorId = getVendorId(req);

    if (!vendorId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const vendorObjectId = new Types.ObjectId(String(vendorId));
    const orderId = toStr(req.params.orderId);
    const shipmentIdParam = toStr(req.params.shipmentId);

    if (!Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const order: any = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const subOrdersAll = Array.isArray(order?.subOrders) ? order.subOrders : [];
    const vendorSubs = subOrdersAll.filter(
      (so: any) => String(so?.vendorId || "") === String(vendorObjectId)
    );

    if (!vendorSubs.length) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const vendorSubIds = new Set(vendorSubs.map((so: any) => String(so?._id || "")));
    const shipmentsAll = Array.isArray(order?.shipments) ? order.shipments : [];

    let targetShipment =
      vendorSubs
        .map((so: any) => so?.shipment)
        .find((sh: any) => {
          const sid = Number(sh?.shiprocket?.shipmentId ?? 0);
          return sid > 0 && String(sid) === shipmentIdParam;
        }) || null;

    if (!targetShipment) {
      targetShipment =
        shipmentsAll.find((sh: any) => {
          const sid = Number(sh?.shiprocket?.shipmentId ?? 0);
          const belongsToVendor =
            String(sh?.vendorId || "") === String(vendorObjectId) ||
            vendorSubIds.has(String(sh?.subOrderId || ""));

          return belongsToVendor && sid > 0 && String(sid) === shipmentIdParam;
        }) || null;
    }

    if (!targetShipment) {
      return res.status(404).json({ message: "Shipment not found for this vendor" });
    }

    const shipmentId = Number(targetShipment?.shiprocket?.shipmentId ?? 0);
    const awb = toStr(targetShipment?.shiprocket?.awb);
    const existingLabelUrl = toStr(targetShipment?.shiprocket?.labelUrl);

    if (existingLabelUrl) {
      return res.json({
        message: "Label already available",
        data: {
          shipmentId,
          awb: awb || null,
          labelUrl: existingLabelUrl,
        },
      });
    }

    if (!shipmentId) {
      return res.status(400).json({ message: "Shipment id missing" });
    }

    const labelResp = await shiprocketGenerateLabel({ shipment_id: [shipmentId] });
    const labelUrl = toStr(labelResp?.label_url || labelResp?.data?.label_url);

    if (!labelUrl) {
      return res.status(502).json({ message: "Shiprocket did not return a label URL" });
    }

    await Order.updateOne(
      { _id: new Types.ObjectId(orderId), "subOrders.shipment.shiprocket.shipmentId": shipmentId },
      {
        $set: {
          "subOrders.$.shipment.shiprocket.labelUrl": labelUrl,
          "subOrders.$.shipment.updatedAt": new Date(),
        },
      }
    );

    return res.json({
      message: "Label generated",
      data: {
        shipmentId,
        awb: awb || null,
        labelUrl,
      },
    });
  } catch (e: any) {
    console.error("vendorGenerateOrderLabel error:", e);

    return res
      .status(e?.status || 500)
      .json({ message: e?.message || "Label generation failed", error: e?.payload || null });
  }
};
