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

export const adminCreateShiprocketShipment = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    if (!Types.ObjectId.isValid(orderId)) return res.status(400).json({ message: "Invalid orderId" });

    const order: any = await Order.findById(orderId).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });

    // ✅ Only confirmed orders can be shipped
    if (String(order.status) !== "CONFIRMED") {
      return res.status(400).json({ message: "Order must be CONFIRMED before creating shipment" });
    }

    // ✅ Payment guard
    if (String(order.paymentMethod) === "ONLINE" && String(order.paymentStatus) !== "PAID") {
      return res.status(400).json({ message: "ONLINE order must be PAID before shipping" });
    }
    if (String(order.paymentMethod) === "COD" && !order?.cod?.confirmedAt) {
      // if you allow confirmed via status only, you can relax this
      // but recommended to have cod snapshot
      // return res.status(400).json({ message: "COD must be confirmed by admin before shipping" });
    }

    // ✅ Prevent duplicate shipment (single-vendor now)
    const existing = (order.shipments || []).find((s: any) => s?.provider === "SHIPROCKET" && s?.shiprocket?.awb);
    if (existing) {
      return res.status(409).json({ message: "Shipment already created for this order", data: existing });
    }

    const ship = order.address || {};
    const contact = order.contact || {};
    const items = order.items || [];

    // Build shiprocket order_items
    const order_items = items.map((it: any) => ({
      name: toStr(it.title) || "Item",
      sku: toStr(it.productCode) || "SKU",
      units: Number(it.qty || 1),
      selling_price: Number(it.salePrice || 0),
      discount: 0,
      tax: 0,
      hsn: "",
    }));

    const sub_total = Number(order?.totals?.grandTotal ?? order?.totals?.subtotal ?? 0);

    // ✅ Serviceability (optional) - choose first recommended courier
    const codFlag = String(order.paymentMethod) === "COD" ? 1 : 0;

    let courier_company_id: number | null = null;
    try {
      const svc = await shiprocketCheckServiceability({
        pickup_postcode: String(DEFAULT_PICKUP.pincode),
        delivery_postcode: String(ship.pincode),
        weight: DEFAULT_DIM.weight,
        cod: codFlag as 0 | 1,
      });

      const companies = svc?.data?.available_courier_companies || svc?.available_courier_companies || [];
      if (Array.isArray(companies) && companies.length) {
        courier_company_id = Number(companies[0].courier_company_id || companies[0].courier_company_id);
      }
    } catch (e: any) {
      // serviceability fail shouldn't block create; you can still create without courier assignment
      courier_company_id = null;
    }

    // ✅ Create shiprocket order
    const srOrderPayload: any = {
      order_id: String(order.orderCode || order._id),
      order_date: shiprocketFormatOrderDate(new Date(order.createdAt || Date.now())),

      pickup_location: "Primary", // many accounts require configured pickup location name
      billing_customer_name: toStr(ship.fullName || contact.name || "Customer"),
      billing_last_name: "",
      billing_address: toStr(ship.addressLine1 || ""),
      billing_address_2: toStr(ship.addressLine2 || ""),
      billing_city: toStr(ship.city || ""),
      billing_pincode: toStr(ship.pincode || ""),
      billing_state: toStr(ship.state || ""),
      billing_country: "India",
      billing_email: toStr(contact.email || "no-reply@countryhome.in"),
      billing_phone: toStr(ship.phone || contact.phone || ""),

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

    // Shiprocket response typical:
    // { order_id, shipment_id, status, ... }
    const sr_order_id = srCreateResp?.order_id || srCreateResp?.orderId || null;
    const shipment_id = srCreateResp?.shipment_id || srCreateResp?.shipmentId || null;

    if (!shipment_id) {
      return res.status(500).json({
        message: "Shiprocket order created but shipment_id missing",
        error: "shipment_id missing",
        raw: srCreateResp,
      });
    }

    // ✅ Generate AWB (if we have courier)
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
      provider: "SHIPROCKET",
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
        raw: { create: srCreateResp, awb: awbResp },
      },
      status: awb ? "AWB_ASSIGNED" : "CREATED",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await Order.updateOne(
      { _id: new Types.ObjectId(orderId) },
      {
        $push: { shipments: shipmentDoc },
        $set: { status: "SHIPPED" }, // shipping created => shipped
      }
    );

    const fresh = await Order.findById(orderId).lean();

    return res.json({
      message: "Shipment created",
      data: fresh,
    });
  } catch (err: any) {
    console.error("adminCreateShiprocketShipment error:", err);
    return res.status(err?.status || 500).json({
      message: err?.message || "Shipment create failed",
      error: err?.payload || err?.message || "Unknown error",
    });
  }
};
