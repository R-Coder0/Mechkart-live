/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { Order } from "../../models/Order.model";
import { Vendor } from "../../models/Vendor.model";
import { Product } from "../../models/Product.model";
import {
  shiprocketCreateOrder,
  shiprocketGenerateAwb,
  shiprocketCheckServiceability,
  shiprocketFormatOrderDate,
  shiprocketCreatePickupLocation,
  shiprocketListPickupLocations,
} from "../../services/shiprocket.service";

const toStr = (v: any) => String(v ?? "").trim();
const toNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const SHIPROCKET_PICKUP_LOCATION = process.env.SHIPROCKET_PICKUP_LOCATION || "Primary"; // admin pickup alias (Shiprocket dashboard name)

const DEFAULT_DIM = {
  length: Number(process.env.SHIP_LENGTH_CM || 20),
  breadth: Number(process.env.SHIP_BREADTH_CM || 15),
  height: Number(process.env.SHIP_HEIGHT_CM || 10),
  weight: Number(process.env.SHIP_WEIGHT_KG || 0.5),
};

// helpers
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

// ---- pickup alias helpers ----
function vendorPickupAlias(vendorId: any) {
  return `VENDOR_${String(vendorId)}`; // stable unique name in Shiprocket dashboard
}

function isAlreadyExistsPickupError(e: any) {
  const msg = String(e?.message || "").toLowerCase();
  const payload = JSON.stringify(e?.payload || {}).toLowerCase();
  return (
    msg.includes("already") ||
    msg.includes("exist") ||
    payload.includes("already") ||
    payload.includes("exist")
  );
}

async function ensureVendorPickupOnShiprocket(vendorDoc: any) {
  const alias = vendorPickupAlias(vendorDoc?._id);

  // Try to avoid duplicate creates
  try {
    const list = await shiprocketListPickupLocations();
    const arr = list?.data || list?.pickup_address_list || list || [];
    if (Array.isArray(arr)) {
      const found = arr.find((x: any) => {
        const pl = toStr(
          x?.pickup_location ||
            x?.pickup_location_name ||
            x?.pickup_location_id ||
            x?.name
        );
        return pl === alias;
      });
      if (found) return alias;
    }
  } catch {
    // ignore list failure
  }

  // Create pickup
  try {
    await shiprocketCreatePickupLocation({
      pickup_location: alias,
      name:
        toStr(vendorDoc?.pickupAddress?.name) ||
        toStr(vendorDoc?.company?.name) ||
        "Vendor",
      email: toStr(vendorDoc?.company?.email) || toStr(vendorDoc?.email) || undefined,
      phone: toStr(vendorDoc?.pickupAddress?.phone) || toStr(vendorDoc?.phone),
      address: toStr(vendorDoc?.pickupAddress?.address),
      address_2: "",
      city: toStr(vendorDoc?.pickupAddress?.city),
      state: toStr(vendorDoc?.pickupAddress?.state),
      country: "India",
      pin_code: toStr(vendorDoc?.pickupAddress?.pincode),
    });
  } catch (e: any) {
    if (!isAlreadyExistsPickupError(e)) throw e;
  }

  return alias;
}

// ---- dimension/weight helpers ----
// ✅ Your Product schema shows ship object: ship.lengthCm, ship.breadthCm, ship.heightCm, ship.weightKg
function extractDimWeightFromProduct(p: any, variantId: any) {
  // variant-level overrides (if you ever add ship fields inside variants)
  if (variantId && Array.isArray(p?.variants)) {
    const v = p.variants.find((x: any) => String(x._id) === String(variantId));
    if (v) {
      const w = toNum(v?.ship?.weightKg ?? v?.weightKg ?? v?.weight ?? 0, 0);
      const l = toNum(v?.ship?.lengthCm ?? v?.lengthCm ?? v?.length ?? 0, 0);
      const b = toNum(v?.ship?.breadthCm ?? v?.breadthCm ?? v?.breadth ?? 0, 0);
      const h = toNum(v?.ship?.heightCm ?? v?.heightCm ?? v?.height ?? 0, 0);

      if (w || l || b || h) {
        return {
          weight: w || DEFAULT_DIM.weight,
          length: l || DEFAULT_DIM.length,
          breadth: b || DEFAULT_DIM.breadth,
          height: h || DEFAULT_DIM.height,
        };
      }
    }
  }

  // ✅ product-level ship object
  const w = toNum(p?.ship?.weightKg ?? p?.weightKg ?? p?.weight ?? 0, 0);
  const l = toNum(p?.ship?.lengthCm ?? p?.lengthCm ?? p?.length ?? 0, 0);
  const b = toNum(p?.ship?.breadthCm ?? p?.breadthCm ?? p?.breadth ?? 0, 0);
  const h = toNum(p?.ship?.heightCm ?? p?.heightCm ?? p?.height ?? 0, 0);

  if (w || l || b || h) {
    return {
      weight: w || DEFAULT_DIM.weight,
      length: l || DEFAULT_DIM.length,
      breadth: b || DEFAULT_DIM.breadth,
      height: h || DEFAULT_DIM.height,
    };
  }

  return { ...DEFAULT_DIM };
}

export const adminCreateShiprocketShipment = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    if (!Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid orderId" });
    }

    const order: any = await Order.findById(orderId).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });

    // guards
    if (String(order.status) !== "CONFIRMED") {
      return res.status(400).json({ message: "Order must be CONFIRMED before creating shipment" });
    }
    if (String(order.paymentMethod) === "ONLINE" && String(order.paymentStatus) !== "PAID") {
      return res.status(400).json({ message: "ONLINE order must be PAID before shipping" });
    }

    const ship = order.address || {};
    const contact = order.contact || {};

    const deliveryPincode = toStr(ship.pincode);
    const deliveryCity = toStr(ship.city);
    const deliveryState = toStr(ship.state);
    const deliveryPhone = toStr(ship.phone || contact.phone);

    if (!deliveryPincode || deliveryPincode.length !== 6) return res.status(400).json({ message: "Invalid delivery pincode" });
    if (!deliveryPhone || deliveryPhone.length < 10) return res.status(400).json({ message: "Invalid delivery phone" });
    if (!deliveryCity || !deliveryState) return res.status(400).json({ message: "Delivery city/state missing" });
    if (!toStr(ship.addressLine1)) return res.status(400).json({ message: "Delivery addressLine1 missing" });

    // ✅ Ship per subOrder
    const subOrders: any[] = Array.isArray(order.subOrders) ? order.subOrders : [];
    if (!subOrders.length) {
      return res.status(400).json({ message: "subOrders missing. Create order split before shipment." });
    }

    // ✅ pending only (no shiprocket shipment yet)
    const pendingSubOrders = subOrders.filter((so: any) => {
      const sr = so?.shipment?.shiprocket;
      return !(sr?.shipmentId || sr?.awb);
    });

    if (!pendingSubOrders.length) {
      return res.status(409).json({ message: "All subOrders already have Shiprocket shipments." });
    }

    // preload vendors
    const vendorIds = pendingSubOrders
      .map((so: any) => (so?.ownerType === "VENDOR" ? String(so.vendorId || "") : ""))
      .filter(Boolean);

    const vendors = vendorIds.length
      ? await Vendor.find({ _id: { $in: vendorIds } }).select("email phone company pickupAddress").lean()
      : [];
    const vendorMap = new Map(vendors.map((v: any) => [String(v._id), v]));

    // preload products for dims
    const allItemRefs: any[] = pendingSubOrders.flatMap((so: any) => (Array.isArray(so.items) ? so.items : []));
    const productIds = Array.from(new Set(allItemRefs.map((it: any) => String(it.productId)).filter(Boolean)));

    const products = productIds.length
      ? await Product.find({ _id: { $in: productIds } })
          .select("variants ship")
          .lean()
      : [];
    const productMap = new Map(products.map((p: any) => [String(p._id), p]));

    const codFlag = String(order.paymentMethod) === "COD" ? 1 : 0;

    const createdResults: any[] = [];

    for (const so of pendingSubOrders) {
      const soItems = Array.isArray(so.items) ? so.items : [];
      if (!soItems.length) continue;

      // pickup alias
      let pickup_location = SHIPROCKET_PICKUP_LOCATION; // admin default
      if (String(so.ownerType) === "VENDOR") {
        const vdoc = vendorMap.get(String(so.vendorId));
        if (!vdoc) throw new Error(`Vendor not found for subOrder vendorId=${String(so.vendorId)}`);
        pickup_location = await ensureVendorPickupOnShiprocket(vdoc);
      }

      // order_items (unique sku)
      const usedSkus = new Set<string>();
      const order_items = soItems.map((it: any, idx: number) => {
        const units = Math.max(1, toNum(it.qty, 1));
        const selling = Math.max(1, toNum(it.salePrice, 0) || toNum(it.mrp, 0) || 1);

        const baseSku = toStr(it.productCode) || `SKU-${idx + 1}`;
        const vSuffix = it?.variantId ? `V${shortId(it.variantId, 6)}` : "VNA";
        const cSuffix = it?.colorKey ? `C${safeKey(it.colorKey)}` : "";

        let sku = `${baseSku}-${vSuffix}${cSuffix ? "-" + cSuffix : ""}`;
        if (usedSkus.has(sku)) sku = `${sku}-${idx + 1}`;
        usedSkus.add(sku);

        return {
          name: toStr(it.title) || `Item ${idx + 1}`,
          sku,
          units,
          selling_price: selling,
          discount: 0,
          tax: 0,
          hsn: "",
        };
      });

      const sub_total = order_items.reduce(
        (sum: number, it: any) => sum + Number(it.selling_price || 0) * Number(it.units || 1),
        0
      );

      // ✅ dims for this suborder
      let totalWeight = 0;
      let maxL = 0, maxB = 0, maxH = 0;

      for (const it of soItems) {
        const p = productMap.get(String(it.productId));
        const dim = p ? extractDimWeightFromProduct(p, it.variantId) : { ...DEFAULT_DIM };

        const qty = Math.max(1, toNum(it.qty, 1));
        totalWeight += Number(dim.weight || DEFAULT_DIM.weight) * qty;

        maxL = Math.max(maxL, Number(dim.length || DEFAULT_DIM.length));
        maxB = Math.max(maxB, Number(dim.breadth || DEFAULT_DIM.breadth));
        maxH = Math.max(maxH, Number(dim.height || DEFAULT_DIM.height));
      }

      const finalDim = {
        length: maxL || DEFAULT_DIM.length,
        breadth: maxB || DEFAULT_DIM.breadth,
        height: maxH || DEFAULT_DIM.height,
        weight: totalWeight || DEFAULT_DIM.weight,
      };

      // ✅ serviceability
      let courier_company_id: number | null = null;

      const pickupPincode =
        String(so.ownerType) === "VENDOR"
          ? toStr(so?.shipment?.pickup?.pincode) || toStr(vendorMap.get(String(so.vendorId))?.pickupAddress?.pincode)
          : toStr(process.env.SHIP_PICKUP_PINCODE);

      try {
        if (pickupPincode && pickupPincode.length === 6) {
          const svc = await shiprocketCheckServiceability({
            pickup_postcode: String(pickupPincode),
            delivery_postcode: String(deliveryPincode),
            weight: Number(finalDim.weight),
            cod: codFlag as 0 | 1,
          });
          const companies = svc?.data?.available_courier_companies || svc?.available_courier_companies || [];
          if (Array.isArray(companies) && companies.length) {
            courier_company_id = Number(companies[0].courier_company_id || null);
          }
        }
      } catch {
        courier_company_id = null;
      }

      // ✅ unique shiprocket order_id per suborder
      const srOrderId = `${String(order.orderCode || order._id)}-${String(so.ownerType)}-${String(
        so.ownerType === "VENDOR" ? so.vendorId : "ADMIN"
      ).slice(-6)}`;

      const srOrderPayload: any = {
        order_id: srOrderId,
        order_date: shiprocketFormatOrderDate(new Date(order.createdAt || Date.now())),
        pickup_location,

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

        length: finalDim.length,
        breadth: finalDim.breadth,
        height: finalDim.height,
        weight: finalDim.weight,
      };

      const srCreateResp = await shiprocketCreateOrder(srOrderPayload);

      const sr_order_id = srCreateResp?.order_id || srCreateResp?.orderId || null;
      const shipment_id = srCreateResp?.shipment_id || srCreateResp?.shipmentId || null;

      if (!shipment_id) {
        throw new Error(`Shiprocket order created but shipment_id missing for subOrder ${srOrderId}`);
      }

      // generate awb
      let awbResp: any = null;
      let awb: string | null = null;

      if (courier_company_id) {
        awbResp = await shiprocketGenerateAwb({
          shipment_id: Number(shipment_id),
          courier_id: Number(courier_company_id),
        });
        awb = awbResp?.awb_code || awbResp?.awb || null;
      }

      const updatedShipment = {
        ...(so.shipment || {}),
        provider: "SHIPROCKET",
        vendorId: String(so.ownerType) === "VENDOR" ? so.vendorId : null,
          pickup: (so.shipment && so.shipment.pickup) ? so.shipment.pickup : (String(so.ownerType)==="VENDOR"
    ? { pincode: pickupPincode }
    : { pincode: toStr(process.env.SHIP_PICKUP_PINCODE) }
  ),
        status: awb ? "AWB_ASSIGNED" : "CREATED",
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
      };

      await Order.updateOne(
        { _id: new Types.ObjectId(orderId), "subOrders._id": so._id },
        {
          $set: {
            "subOrders.$.shipment": updatedShipment,
            "subOrders.$.status": "SHIPPED",
          },
        }
      );

      createdResults.push({
        subOrderId: so._id,
        ownerType: so.ownerType,
        vendorId: so.vendorId || null,
        pickup_location,
        pickupPincode,
        shipmentId: Number(shipment_id),
        awb: awb || null,
        dim: finalDim,
      });
    }

    if (createdResults.length) {
      await Order.updateOne({ _id: new Types.ObjectId(orderId) }, { $set: { status: "SHIPPED" } });
    }

    const fresh = await Order.findById(orderId).lean();

    return res.json({
      message: "Shiprocket shipment(s) created",
      data: {
        orderId: String(orderId),
        created: createdResults,
        order: fresh,
      },
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
