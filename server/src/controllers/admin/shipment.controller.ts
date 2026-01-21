/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { Order } from "../../models/Order.model";
import {
  shiprocketCreateOrder,
  shiprocketGenerateAwb,
  shiprocketCheckServiceability,
  shiprocketFormatOrderDate,
} from "../../services/shiprocket.service";

const toStr = (v: any) => String(v ?? "").trim();
const toNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

// ✅ IMPORTANT: pickup location name must match Shiprocket dashboard pickup location NAME
const SHIPROCKET_PICKUP_LOCATION = process.env.SHIPROCKET_PICKUP_LOCATION || "Primary";

// ✅ Your default pickup (single-vendor now)
// Later in multivendor: pickup will come from vendor profile
const DEFAULT_PICKUP = {
  name: process.env.SHIP_PICKUP_NAME || "Mechkart",
  phone: process.env.SHIP_PICKUP_PHONE || "9999999999",
  address: process.env.SHIP_PICKUP_ADDRESS || "Your pickup address",
  city: process.env.SHIP_PICKUP_CITY || "Gurugram",
  state: process.env.SHIP_PICKUP_STATE || "Haryana",
  pincode: process.env.SHIP_PICKUP_PINCODE || "122001",
};

const DEFAULT_DIM = {
  length: Number(process.env.SHIP_LENGTH_CM || 20),
  breadth: Number(process.env.SHIP_BREADTH_CM || 15),
  height: Number(process.env.SHIP_HEIGHT_CM || 10),
  weight: Number(process.env.SHIP_WEIGHT_KG || 0.5),
};

// small helpers
const safeKey = (v: any) =>
  String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9\-]/g, "")
    .slice(0, 12);

const shortId = (v: any, len = 6) => {
  const s = String(v ?? "");
  return s ? s.slice(-len) : "";
};

export const adminCreateShiprocketShipment = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    if (!Types.ObjectId.isValid(orderId)) return res.status(400).json({ message: "Invalid orderId" });

    const order: any = await Order.findById(orderId).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });

    // ✅ Only confirmed orders can be shipped
    if (String(order.status) !== "CONFIRMED") {
      return res.status(400).json({
        message: "Order must be CONFIRMED before creating shipment",
      });
    }

    // ✅ Payment guard
    if (String(order.paymentMethod) === "ONLINE" && String(order.paymentStatus) !== "PAID") {
      return res.status(400).json({ message: "ONLINE order must be PAID before shipping" });
    }

    // ✅ Prevent duplicate shipment (single-vendor now)
    const existing = (order.shipments || []).find(
      (s: any) =>
        String(s?.provider || "").toUpperCase() === "SHIPROCKET" &&
        (s?.shiprocket?.awb || s?.shiprocket?.shipmentId)
    );
    if (existing) {
      return res.status(409).json({
        message: "Shipment already created for this order",
        data: existing,
      });
    }

    const ship = order.address || {};
    const contact = order.contact || {};
    const items = Array.isArray(order.items) ? order.items : [];

    // ✅ Basic required validations (avoid Shiprocket 422)
    const deliveryPincode = toStr(ship.pincode);
    const deliveryCity = toStr(ship.city);
    const deliveryState = toStr(ship.state);
    const deliveryPhone = toStr(ship.phone || contact.phone);

    if (!deliveryPincode || deliveryPincode.length !== 6) {
      return res.status(400).json({ message: "Invalid delivery pincode in order address" });
    }
    if (!deliveryPhone || deliveryPhone.length < 10) {
      return res.status(400).json({ message: "Invalid delivery phone in order address" });
    }
    if (!deliveryCity || !deliveryState) {
      return res.status(400).json({ message: "Delivery city/state missing in order address" });
    }
    if (!toStr(ship.addressLine1)) {
      return res.status(400).json({ message: "Delivery addressLine1 missing" });
    }
    if (!items.length) {
      return res.status(400).json({ message: "Order items missing" });
    }

    // ✅ Build shiprocket order_items
    // IMPORTANT: Shiprocket requires SKU unique within same order.
    // We will make SKU unique by adding variantId/colorKey suffix.
    const usedSkus = new Set<string>();

    const order_items = items.map((it: any, idx: number) => {
      const units = Math.max(1, toNum(it.qty, 1));
      const selling = Math.max(1, toNum(it.salePrice, 0) || toNum(it.mrp, 0) || 1);

      const baseSku = toStr(it.productCode) || `SKU-${idx + 1}`;

      // stable suffix per variant/color
      const vSuffix = it?.variantId ? `V${shortId(it.variantId, 6)}` : "VNA";
      const cSuffix = it?.colorKey ? `C${safeKey(it.colorKey)}` : "";

      let sku = `${baseSku}-${vSuffix}${cSuffix ? "-" + cSuffix : ""}`;

      // final collision-proof fallback (if still repeated for any reason)
      if (usedSkus.has(sku)) sku = `${sku}-${idx + 1}`;
      usedSkus.add(sku);

      return {
        name: toStr(it.title) || `Item ${idx + 1}`,
        sku, // ✅ UNIQUE now
        units,
        selling_price: selling,
        discount: 0,
        tax: 0,
        hsn: "",
      };
    });

    // ✅ Compute sub_total from items (prevents 422 mismatch)
    const sub_total = order_items.reduce(
      (sum: number, it: any) => sum + Number(it.selling_price || 0) * Number(it.units || 1),
      0
    );

    const codFlag = String(order.paymentMethod) === "COD" ? 1 : 0;

    // ✅ Serviceability (optional)
    let courier_company_id: number | null = null;
    try {
      const svc = await shiprocketCheckServiceability({
        pickup_postcode: String(DEFAULT_PICKUP.pincode),
        delivery_postcode: String(deliveryPincode),
        weight: DEFAULT_DIM.weight,
        cod: codFlag as 0 | 1,
      });

      const companies =
        svc?.data?.available_courier_companies || svc?.available_courier_companies || [];

      if (Array.isArray(companies) && companies.length) {
        courier_company_id = Number(companies[0].courier_company_id || null);
      }
    } catch {
      courier_company_id = null;
    }

    // ✅ Create shiprocket order payload
    const srOrderPayload: any = {
      order_id: String(order.orderCode || order._id),
      order_date: shiprocketFormatOrderDate(new Date(order.createdAt || Date.now())),

      pickup_location: SHIPROCKET_PICKUP_LOCATION,

      billing_customer_name: toStr(ship.fullName || contact.name || "Customer"),
      billing_last_name: "",
      billing_address: toStr(ship.addressLine1 || ""),
      billing_address_2: toStr(ship.addressLine2 || ""),
      billing_city: toStr(deliveryCity),
      billing_pincode: toStr(deliveryPincode),
      billing_state: toStr(deliveryState),
      billing_country: "India",
      billing_email: toStr(contact.email || "no-reply@mechkart.in"),
      billing_phone: toStr(deliveryPhone),

      shipping_is_billing: true,

      order_items,
      payment_method: codFlag ? "COD" : "Prepaid",
      sub_total,

      length: DEFAULT_DIM.length,
      breadth: DEFAULT_DIM.breadth,
      height: DEFAULT_DIM.height,
      weight: DEFAULT_DIM.weight,
    };

    const srCreateResp = await shiprocketCreateOrder(srOrderPayload);

    const sr_order_id = srCreateResp?.order_id || srCreateResp?.orderId || null;
    const shipment_id = srCreateResp?.shipment_id || srCreateResp?.shipmentId || null;

    if (!shipment_id) {
      return res.status(500).json({
        message: "Shiprocket order created but shipment_id missing",
        error: "shipment_id missing",
        raw: srCreateResp,
      });
    }

    // ✅ Generate AWB (if courier chosen)
    let awbResp: any = null;
    let awb: string | null = null;

    if (courier_company_id) {
      awbResp = await shiprocketGenerateAwb({
        shipment_id: Number(shipment_id),
        courier_id: Number(courier_company_id),
      });
      awb = awbResp?.awb_code || awbResp?.awb || null;
    }

    // ✅ Save shipment snapshot to Order
    const shipmentDoc = {
      provider: "SHIPROCKET", // ✅ keep uppercase for UI check
      vendorId: null,
      items: items.map((it: any) => ({
        productId: it.productId,
        qty: it.qty,
        variantId: it.variantId || null,
        colorKey: it.colorKey || null,
      })),
      pickup: {
        name: DEFAULT_PICKUP.name,
        phone: DEFAULT_PICKUP.phone,
        pincode: DEFAULT_PICKUP.pincode,
        state: DEFAULT_PICKUP.state,
        city: DEFAULT_PICKUP.city,
        addressLine1: DEFAULT_PICKUP.address,
        addressLine2: "",
      },
      shiprocket: {
        orderId: sr_order_id ? String(sr_order_id) : null,
        shipmentId: Number(shipment_id),
        awb: awb ? String(awb) : null,
        courierName: null,
        courierCompanyId: courier_company_id ? Number(courier_company_id) : null,
        labelUrl: null,
        manifestUrl: null,
        invoiceUrl: null,
        pickupScheduledAt: null,
        tracking: null,
        raw: { create: srCreateResp, awb: awbResp, payload: srOrderPayload },
      },
      status: awb ? "AWB_ASSIGNED" : "CREATED",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await Order.updateOne(
      { _id: new Types.ObjectId(orderId) },
      {
        $push: { shipments: shipmentDoc },
        $set: { status: "SHIPPED" },
      }
    );

    // ✅ IMPORTANT: populate here so UI gets product info consistently
    const fresh = await Order.findById(orderId)
      .populate({
        path: "items.productId",
        select: "title variants colors galleryImages featureImage",
      })
      .lean();

    return res.json({
      message: "Shipment created",
      data: fresh,
    });
  } catch (err: any) {
    console.error("adminCreateShiprocketShipment error:", err);
    console.error("Shiprocket status:", err?.status);
    console.error("Shiprocket payload:", err?.payload);

    return res.status(err?.status || 500).json({
      message: err?.message || "Shipment create failed",
      error: err?.payload || err?.message || "Unknown error",
    });
  }
};
