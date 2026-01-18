/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import crypto from "crypto";
import Razorpay from "razorpay";

import { Cart } from "../../models/Cart.model";
import { Product } from "../../models/Product.model";
import { User } from "../../models/User.model";
import PDFDocument from "pdfkit";
import { Order } from "../../models/Order.model";
import { generateOrderCode } from "../../utils/orderCode";
import {
  validateAndComputeOffer,
  recordOfferRedemption,
} from "../../services/offer.apply.service";

// ✅ Email service imports
import {
  sendOrderPlacedCustomerEmail,
  sendOrderPlacedOwnerEmail,
} from "../../services/email.service";

const getUserId = (req: Request) => (req as any).user?._id;
const toStr = (v: any) => String(v ?? "").trim();

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const moneyNum = (n: any) => Math.round(Number(n || 0) * 100) / 100;
const fmtRs = (n: any) => `Rs ${moneyNum(n).toFixed(2)}`;

// -----------------------------
// Razorpay setup
// -----------------------------
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

const razorpay =
  RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET
    ? new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
    : null;

function assertRazorpayConfigured() {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || !razorpay) {
    throw new Error("Razorpay not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET");
  }
}

// ✅ helper to compute variant text like your UI
const computeVariantText = (p: any, variantId: any) => {
  const v = (p?.variants || []).find((x: any) => String(x._id) === String(variantId));
  if (!v) return "";
  return (
    toStr(v.label) ||
    toStr(v.comboText) ||
    toStr(v.size) ||
    toStr(v.weight) ||
    ""
  );
};

/**
 * ✅ Create order with atomic unique orderCode (no duplicates)
 * Uses generateOrderCode("CH") which you built with OrderCounter ($inc upsert).
 * Retries few times just in case.
 */
async function createOrderWithUniqueCode(createDoc: any) {
  let created: any = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const orderCode = await generateOrderCode("CH");
      created = await Order.create({ ...createDoc, orderCode });
      break;
    } catch (err: any) {
      if (err?.code === 11000 && (err?.keyPattern?.orderCode || err?.keyValue?.orderCode)) {
        continue; // retry
      }
      throw err;
    }
  }

  if (!created) {
    const e: any = new Error("Could not generate unique order code. Try again.");
    e.status = 500;
    throw e;
  }

  return created;
}

/**
 * ✅ Shared: build orderItems + totals + offerResult from selected cart
 * Used for COD + ONLINE
 */
async function buildCheckoutSnapshot(req: Request, userId: any) {
  const contact = req.body?.contact || {};
  const addressId = toStr(req.body?.addressId);

  const contactName = toStr(contact.name) || toStr((req as any).user?.name);
  const contactPhone = toStr(contact.phone) || toStr((req as any).user?.phone);
  const contactEmail = toStr(contact.email) || toStr((req as any).user?.email);

  if (!contactName || !contactPhone) {
    const e: any = new Error("Contact name and phone are required");
    e.status = 400;
    throw e;
  }
  if (!Types.ObjectId.isValid(addressId)) {
    const e: any = new Error("Valid addressId is required");
    e.status = 400;
    throw e;
  }

  const user = await User.findById(userId).select("addresses name phone email");
  if (!user) {
    const e: any = new Error("User not found");
    e.status = 404;
    throw e;
  }

  const addr: any = (user.addresses as any).id(addressId);
  if (!addr) {
    const e: any = new Error("Address not found");
    e.status = 400;
    throw e;
  }

  // Cart
  const ownerKey = `u:${String(userId)}`;
  const cart =
    (await Cart.findOne({ ownerKey })) ||
    (await Cart.findOne({ userId }));

  if (!cart || !cart.items?.length) {
    const e: any = new Error("Cart is empty");
    e.status = 400;
    throw e;
  }

  const selectedItems = (cart.items as any[]).filter((it) => it.isSelected === true);
  if (!selectedItems.length) {
    const e: any = new Error("No items selected for checkout");
    e.status = 400;
    throw e;
  }

  // Products
  const productIds = selectedItems.map((it: any) => it.productId);

  const products = await Product.find({
    _id: { $in: productIds },
    isActive: true,
  })
    .select("title productId variants colors galleryImages featureImage isActive mrp salePrice baseStock stock quantity")
    .lean();

  const productMap = new Map(products.map((p: any) => [String(p._id), p]));

  // Stock validate
  for (const it of selectedItems) {
    const p: any = productMap.get(String(it.productId));
    if (!p) {
      const e: any = new Error("Some products are unavailable now");
      e.status = 409;
      throw e;
    }

    const qty = Number(it.qty || 0);
    if (!qty || qty <= 0) {
      const e: any = new Error("Invalid quantity in cart");
      e.status = 409;
      throw e;
    }

    const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;

    if (hasVariants) {
      const v = (p.variants || []).find((x: any) => String(x._id) === String(it.variantId));
      if (!v) {
        const e: any = new Error("Selected variant no longer exists");
        e.status = 409;
        throw e;
      }

      const available = Number(v.quantity ?? v.stock ?? 0);
      if (available <= 0) {
        const e: any = new Error("Variant out of stock");
        e.status = 409;
        throw e;
      }
      if (qty > available) {
        const e: any = new Error("Quantity exceeds available stock");
        e.status = 409;
        (e as any).available = available;
        throw e;
      }
    } else {
      const available = Number(p.baseStock ?? p.stock ?? p.quantity ?? 0);
      if (available <= 0) {
        const e: any = new Error("Product out of stock");
        e.status = 409;
        throw e;
      }
      if (qty > available) {
        const e: any = new Error("Quantity exceeds available stock");
        e.status = 409;
        (e as any).available = available;
        throw e;
      }
    }
  }

  // Build order items snapshot
  const orderItems = selectedItems.map((it: any) => {
    const p: any = productMap.get(String(it.productId));

    const codeFromCart = toStr(it.productCode);
    const codeFromProduct = toStr(p?.productId);
    const productCode = codeFromCart || codeFromProduct || "NA";

    const hasVariants = Array.isArray(p?.variants) && p.variants.length > 0;

    let mrp = 0;
    let salePrice = 0;
    let finalVariantId: any = null;
    let variantText = "";

    if (hasVariants) {
      const v = (p.variants || []).find((x: any) => String(x._id) === String(it.variantId));
      if (!v) throw new Error("Selected variant no longer exists");

      mrp = Number(v.mrp ?? it.mrp ?? 0);
      salePrice = Number(v.salePrice ?? it.salePrice ?? mrp);
      finalVariantId = new Types.ObjectId(it.variantId);
      variantText = computeVariantText(p, it.variantId);
    } else {
      mrp = Number(p?.mrp ?? it.mrp ?? 0);
      salePrice = Number(p?.salePrice ?? it.salePrice ?? mrp);
      finalVariantId = null;
      variantText = "";
    }

    return {
      productId: new Types.ObjectId(it.productId),
      productCode,
      variantId: finalVariantId,
      variantText: variantText || null,
      colorKey: it.colorKey ?? null,
      qty: Number(it.qty || 1),
      title: toStr(it.title) || toStr(p?.title) || "Product",
      image: it.image ?? null,
      mrp,
      salePrice,
    };
  });

  const subtotal = orderItems.reduce((sum, it: any) => sum + Number(it.salePrice) * Number(it.qty), 0);
  const mrpTotal = orderItems.reduce((sum, it: any) => sum + Number(it.mrp) * Number(it.qty), 0);
  const savings = Math.max(0, mrpTotal - subtotal);

  // Offer apply
  const couponCode = toStr(req.body?.couponCode);
  const lines = orderItems.map((it: any) => ({
    productId: it.productId,
    qty: it.qty,
    salePrice: it.salePrice,
  }));

  const offerResult = await validateAndComputeOffer({
    userId: new Types.ObjectId(userId),
    couponCode: couponCode || undefined,
    lines,
  });

  if (!offerResult.ok) {
    const e: any = new Error(offerResult.reason || "Offer invalid");
    e.status = 400;
    throw e;
  }

  const discount = Math.min(Number(offerResult.discount || 0), subtotal);
  const grandTotal = Math.max(0, subtotal - discount);

  return {
    user,
    addr,
    cart,
    selectedItems,
    couponCode: couponCode || null,
    contactName,
    contactPhone,
    contactEmail,
    orderItems,
    totals: { subtotal, mrpTotal, savings, discount, grandTotal },
    offerResult,
  };
}

/**
 * ✅ CREATE COD ORDER
 * Route: POST /users/orders (or /users/orders/cod)
 */
export const createCodOrder = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const snap = await buildCheckoutSnapshot(req, userId);

    const createDoc = {
      userId: new Types.ObjectId(userId),
      items: snap.orderItems,
      totals: snap.totals,

      appliedOffer: snap.offerResult.appliedOffer
        ? {
            offerId: snap.offerResult.appliedOffer._id,
            name: snap.offerResult.appliedOffer.name,
            mode: snap.offerResult.appliedOffer.mode,
            couponCode: snap.offerResult.appliedOffer.couponCode || null,
            offerType: snap.offerResult.appliedOffer.type,
            value: snap.offerResult.appliedOffer.value,
            discountAmount: snap.totals.discount,
          }
        : null,

      contact: {
        name: snap.contactName,
        phone: snap.contactPhone,
        email: snap.contactEmail || undefined,
      },

      address: {
        fullName: snap.addr.fullName,
        phone: snap.addr.phone,
        pincode: snap.addr.pincode,
        state: snap.addr.state,
        city: snap.addr.city,
        addressLine1: snap.addr.addressLine1,
        addressLine2: snap.addr.addressLine2,
        landmark: snap.addr.landmark,
      },

      paymentMethod: "COD",
      paymentStatus: "PENDING",
      status: "PLACED",
    };

    // ✅ Atomic unique orderCode + retry
    const order = await createOrderWithUniqueCode(createDoc);

    // ✅ Offer redemption record (COD immediately)
    if (snap.offerResult.ok && snap.offerResult.appliedOffer && snap.totals.discount > 0) {
      await recordOfferRedemption({
        offerId: snap.offerResult.appliedOffer._id,
        userId: new Types.ObjectId(userId),
        orderId: new Types.ObjectId(String(order._id)),
        couponCode: snap.couponCode,
        discountAmount: snap.totals.discount,
      });
    }

    // ✅ Emails (fail-safe)
    try {
      await sendOrderPlacedCustomerEmail(order as any);
      await sendOrderPlacedOwnerEmail(order as any);
    } catch (e: any) {
      console.error("Order placed email failed:", e?.message || e);
    }

    // ✅ Make selected address default
    for (const a of snap.user.addresses as any) a.isDefault = false;
    (snap.user.addresses as any).id(String(req.body?.addressId)).isDefault = true;
    await snap.user.save();

    // ✅ Remove selected cart lines
    const selectedIds = new Set(snap.selectedItems.map((it: any) => String(it._id)));
    snap.cart.items = (snap.cart.items as any[]).filter((it: any) => !selectedIds.has(String(it._id))) as any;
    await snap.cart.save();

    return res.status(201).json({
      message: "Order placed (COD)",
      data: {
        orderId: order._id,
        orderCode: order.orderCode,
        status: order.status,
        totals: order.totals,
      },
    });
  } catch (err: any) {
    console.error("createCodOrder error:", err);
    return res.status(err?.status || 500).json({
      message: err?.message || "Order creation failed",
      error: err?.message || "Unknown error",
      ...(err?.available !== undefined ? { available: err.available } : {}),
    });
  }
};

/**
 * ✅ STEP-1: CREATE ONLINE ORDER + RAZORPAY ORDER
 * Route: POST /users/orders/razorpay/create
 */
export const createRazorpayOrder = async (req: Request, res: Response) => {
  try {
    assertRazorpayConfigured();

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const snap = await buildCheckoutSnapshot(req, userId);

    const amountPaise = Math.round(Number(snap.totals.grandTotal || 0) * 100);
    if (!amountPaise || amountPaise <= 0) {
      return res.status(400).json({ message: "Invalid amount for payment" });
    }

    const createDoc = {
      userId: new Types.ObjectId(userId),
      items: snap.orderItems,
      totals: snap.totals,

      appliedOffer: snap.offerResult.appliedOffer
        ? {
            offerId: snap.offerResult.appliedOffer._id,
            name: snap.offerResult.appliedOffer.name,
            mode: snap.offerResult.appliedOffer.mode,
            couponCode: snap.offerResult.appliedOffer.couponCode || null,
            offerType: snap.offerResult.appliedOffer.type,
            value: snap.offerResult.appliedOffer.value,
            discountAmount: snap.totals.discount,
          }
        : null,

      contact: {
        name: snap.contactName,
        phone: snap.contactPhone,
        email: snap.contactEmail || undefined,
      },

      address: {
        fullName: snap.addr.fullName,
        phone: snap.addr.phone,
        pincode: snap.addr.pincode,
        state: snap.addr.state,
        city: snap.addr.city,
        addressLine1: snap.addr.addressLine1,
        addressLine2: snap.addr.addressLine2,
        landmark: snap.addr.landmark,
      },

      paymentMethod: "ONLINE",
      paymentStatus: "PENDING",
      status: "PLACED",

      pg: {
        provider: "RAZORPAY",
        amount: amountPaise,
        currency: "INR",
        orderId: null,
        paymentId: null,
        signature: null,
        verifiedAt: null,
        raw: null,
      },
    };

    // ✅ Atomic unique orderCode + retry
    const order = await createOrderWithUniqueCode(createDoc);

    // ✅ Create Razorpay order_id
    const rpOrder = await razorpay!.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: String(order.orderCode),
      notes: {
        appOrderId: String(order._id),
        orderCode: String(order.orderCode),
        userId: String(userId),
      },
    });

    // ✅ Save razorpay_order_id in our order
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          "pg.orderId": rpOrder.id,
          "pg.currency": rpOrder.currency || "INR",
          "pg.amount": rpOrder.amount,
        },
      }
    );

    return res.status(201).json({
      message: "Razorpay order created",
      data: {
        orderId: order._id,
        orderCode: order.orderCode,
        totals: order.totals,
        razorpay: {
          keyId: RAZORPAY_KEY_ID,
          orderId: rpOrder.id,
          amount: rpOrder.amount,
          currency: rpOrder.currency,
        },
      },
    });
  } catch (err: any) {
    console.error("createRazorpayOrder error:", err);
    return res.status(err?.status || 500).json({
      message: err?.message || "Razorpay order creation failed",
      error: err?.message || "Unknown error",
    });
  }
};

/**
 * ✅ VERIFY ONLINE PAYMENT
 * Route: POST /users/orders/razorpay/verify
 */
export const verifyRazorpayPayment = async (req: Request, res: Response) => {
  try {
    assertRazorpayConfigured();

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const orderId = toStr(req.body?.orderId);
    const razorpay_order_id = toStr(req.body?.razorpay_order_id);
    const razorpay_payment_id = toStr(req.body?.razorpay_payment_id);
    const razorpay_signature = toStr(req.body?.razorpay_signature);

    if (!Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid orderId" });
    }
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing Razorpay payment fields" });
    }

    const order = await Order.findOne({ _id: orderId, userId: new Types.ObjectId(userId) });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.paymentMethod !== "ONLINE") {
      return res.status(400).json({ message: "This order is not an ONLINE order" });
    }

    const savedRpOrderId = toStr((order as any)?.pg?.orderId);
    if (!savedRpOrderId || savedRpOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: "Razorpay order mismatch" });
    }

    // signature = HMAC_SHA256(order_id|payment_id, secret)
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    const isValid = expected === razorpay_signature;

    if (!isValid) {
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            paymentStatus: "FAILED",
            "pg.paymentId": razorpay_payment_id,
            "pg.signature": razorpay_signature,
            "pg.verifiedAt": null,
            "pg.raw": { razorpay_order_id, razorpay_payment_id },
          },
        }
      );

      return res.status(400).json({ message: "Payment verification failed" });
    }

    // ✅ Mark paid + confirm
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          paymentStatus: "PAID",
          status: "CONFIRMED",
          "pg.paymentId": razorpay_payment_id,
          "pg.signature": razorpay_signature,
          "pg.verifiedAt": new Date(),
          "pg.raw": { razorpay_order_id, razorpay_payment_id },
        },
      }
    );

    // ✅ Record offer redemption AFTER payment success
    if ((order as any)?.appliedOffer?.offerId && Number((order as any)?.totals?.discount || 0) > 0) {
      try {
        await recordOfferRedemption({
          offerId: new Types.ObjectId(String((order as any).appliedOffer.offerId)),
          userId: new Types.ObjectId(userId),
          orderId: new Types.ObjectId(String(order._id)),
          couponCode: (order as any)?.appliedOffer?.couponCode || null,
          discountAmount: Number((order as any)?.totals?.discount || 0),
        });
      } catch (e: any) {
        console.error("recordOfferRedemption (ONLINE) failed:", e?.message || e);
      }
    }

    // ✅ Emails on payment success
    try {
      const fresh = await Order.findById(order._id);
      if (fresh) {
        await sendOrderPlacedCustomerEmail(fresh as any);
        await sendOrderPlacedOwnerEmail(fresh as any);
      }
    } catch (e: any) {
      console.error("Order placed email failed:", e?.message || e);
    }

    return res.json({
      message: "Payment verified",
      data: {
        orderId: String(order._id),
        orderCode: String(order.orderCode),
        paymentStatus: "PAID",
        status: "CONFIRMED",
      },
    });
  } catch (err: any) {
    console.error("verifyRazorpayPayment error:", err);
    return res.status(500).json({
      message: "Payment verification failed",
      error: err?.message || "Unknown error",
    });
  }
};

/**
 * ✅ GET ORDER BY ID (DETAIL)
 * Route: GET /users/orders/:orderId
 */
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { orderId } = req.params;
    if (!Types.ObjectId.isValid(orderId)) return res.status(400).json({ message: "Invalid orderId" });

    const order = await Order.findOne({ _id: orderId, userId })
      .populate({
        path: "items.productId",
        select: "title variants colors galleryImages featureImage",
      })
      .lean();

    if (!order) return res.status(404).json({ message: "Order not found" });

    return res.json({ message: "Order fetched", data: order });
  } catch (err: any) {
    return res.status(500).json({ message: "Order fetch failed", error: err?.message || "Unknown error" });
  }
};

/**
 * ✅ GET MY ORDERS (LIST)
 * Route: GET /users/orders?q=
 */
export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const q = toStr(req.query?.q);
    const query: any = { userId: new Types.ObjectId(userId) };

    if (q) {
      query.$or = [
        { orderCode: { $regex: q, $options: "i" } },
        { "contact.name": { $regex: q, $options: "i" } },
        { "contact.phone": { $regex: q, $options: "i" } },
        { "items.title": { $regex: q, $options: "i" } },
        { "items.productCode": { $regex: q, $options: "i" } },
      ];
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate({
        path: "items.productId",
        select: "title variants colors galleryImages featureImage",
      })
      .lean();

    return res.json({
      message: "Orders fetched",
      data: orders,
    });
  } catch (err: any) {
    return res.status(500).json({
      message: "Orders fetch failed",
      error: err?.message || "Unknown error",
    });
  }
};

/**
 * ✅ DOWNLOAD INVOICE PDF
 * Route: GET /users/orders/:orderId/invoice
 */
export const downloadInvoicePdf = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { orderId } = req.params;
    if (!Types.ObjectId.isValid(orderId)) return res.status(400).json({ message: "Invalid orderId" });

    const order: any = await Order.findOne({ _id: orderId, userId }).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });

    // ---------- Provider ----------
    const PROVIDER = {
      legalName: "COUNTRY HOME PRIVATE LIMITED",
      addressLine1: "Your Office Address Line 1",
      addressLine2: "Your Office Address Line 2",
      city: "Your City",
      state: "HARYANA",
      pincode: "000000",
      gstin: "YOUR_GSTIN_HERE",
    };

    const createdAt = new Date(order.createdAt || Date.now());
    const invoiceDateStr = createdAt.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const invoiceNumber = `CH${createdAt.getFullYear()}${pad(createdAt.getMonth() + 1, 2)}${pad(
      createdAt.getDate(),
      2
    )}-${String(order._id).slice(-6).toUpperCase()}`;

    const ship = order.addressSnapshot || order.shippingAddress || order.address || null;
    const placeOfSupply = String(ship?.state || "").trim().toUpperCase() || "NA";

    const CGST_RATE = 0;
    const SGST_RATE = 0;
    const IGST_RATE = 0;

    const doc = new PDFDocument({ margin: 36, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${orderId}.pdf`);
    doc.pipe(res);

    const pageLeft = doc.page.margins.left;
    const pageRight = doc.page.width - doc.page.margins.right;

    const hr = () => {
      doc.moveDown(0.6);
      doc.moveTo(pageLeft, doc.y).lineTo(pageRight, doc.y).lineWidth(1).strokeColor("#111").stroke();
      doc.moveDown(0.6);
    };

    // ---------- Header ----------
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#111").text("Tax Invoice", pageLeft, 36);
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(9).fillColor("#111");

    const topY = doc.y;

    doc.text(`Invoice Number:`, pageLeft, topY, { continued: true });
    doc.font("Helvetica-Bold").text(` ${invoiceNumber}`);
    doc.font("Helvetica").text(`Order Code:`, pageLeft, doc.y, { continued: true });
    doc.font("Helvetica-Bold").text(` ${String(order.orderCode || "—")}`);
    doc.font("Helvetica").text(`Nature of Transaction:`, pageLeft, doc.y, { continued: true });
    doc.font("Helvetica-Bold").text(` ${String(order.paymentMethod || "COD")}`);
    doc.font("Helvetica").text(`Place of Supply:`, pageLeft, doc.y, { continued: true });
    doc.font("Helvetica-Bold").text(` ${placeOfSupply}`);

    const metaRightX = pageLeft + 300;
    doc.y = topY;
    doc.font("Helvetica").text(`Date:`, metaRightX, doc.y, { continued: true });
    doc.font("Helvetica-Bold").text(` ${invoiceDateStr}`);
    doc.font("Helvetica").text(`Nature of Supply:`, metaRightX, doc.y, { continued: true });
    doc.font("Helvetica-Bold").text(` Goods`);

    // optional barcode
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const bwipjs = require("bwip-js");
      const png = await bwipjs.toBuffer({
        bcid: "code128",
        text: String(order.orderCode || order._id),
        scale: 2,
        height: 10,
        includetext: false,
      });
      doc.image(png, pageRight - 210, 34, { width: 180 });
    } catch {}

    hr();
    doc.moveDown(0.2);

    // ---------- Two columns ----------
    const gap = 24;
    const colW = (pageRight - pageLeft - gap) / 2;
    const leftX = pageLeft;
    const provX = pageLeft + colW + gap;

    const startY = doc.y;

    doc.font("Helvetica-Bold").fontSize(10).text("Bill to / Ship to:", leftX, startY, { width: colW });
    let leftY = startY + 14;
    doc.font("Helvetica").fontSize(9);

    if (ship) {
      doc.font("Helvetica-Bold").text(String(ship.fullName || "—"), leftX, leftY, { width: colW });
      leftY = doc.y;

      doc.font("Helvetica").text(
        `${ship.addressLine1 || ""}${ship.addressLine2 ? ", " + ship.addressLine2 : ""}${
          ship.landmark ? ", " + ship.landmark : ""
        }`,
        leftX,
        leftY,
        { width: colW }
      );
      leftY = doc.y;

      doc.text(`${ship.city || ""}${ship.pincode ? " - " + ship.pincode : ""}`, leftX, leftY, { width: colW });
      leftY = doc.y;

      doc.text(`${ship.state || ""}`, leftX, leftY, { width: colW });
      leftY = doc.y;

      doc.text(`Mobile: ${ship.phone || "—"}`, leftX, leftY, { width: colW });
      leftY = doc.y;
    } else {
      doc.text("—", leftX, leftY, { width: colW });
      leftY = doc.y;
    }

    doc.font("Helvetica-Bold").fontSize(10).text("Service Provider", provX, startY, { width: colW });
    let rightY = startY + 14;
    doc.font("Helvetica").fontSize(9);

    doc.font("Helvetica-Bold").text(PROVIDER.legalName, provX, rightY, { width: colW });
    rightY = doc.y;

    doc.font("Helvetica").text(`${PROVIDER.addressLine1}, ${PROVIDER.addressLine2}`, provX, rightY, { width: colW });
    rightY = doc.y;

    doc.text(`${PROVIDER.city} (${PROVIDER.state}) - ${PROVIDER.pincode}`, provX, rightY, { width: colW });
    rightY = doc.y;

    doc.text(`GSTIN number: ${PROVIDER.gstin}`, provX, rightY, { width: colW });
    rightY = doc.y;

    // optional qr
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const QRCode = require("qrcode");
      const qrPayload = JSON.stringify({
        orderId: String(order._id),
        orderCode: String(order.orderCode || ""),
        amount: Number(order?.totals?.subtotal || 0),
      });
      const dataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 110 });
      const base64 = dataUrl.split(",")[1];
      const buf = Buffer.from(base64, "base64");

      doc.image(buf, pageRight - 110, startY + 6, { width: 90, height: 90 });
    } catch {}

    const columnsBottom = Math.max(leftY, rightY);
    doc.y = columnsBottom + 10;

    hr();

    // ---------- Table ----------
    const cols = [
      { key: "qty", label: "Qty", w: 26 },
      { key: "gross", label: "Gross Amount", w: 70 },
      { key: "discount", label: "Discount", w: 60 },
      { key: "other", label: "Other Charges", w: 72 },
      { key: "taxable", label: "Taxable Amount", w: 74 },
      { key: "cgst", label: "CGST", w: 50 },
      { key: "sgst", label: "SGST/UGST", w: 60 },
      { key: "igst", label: "IGST", w: 50 },
      { key: "total", label: "Total Amount", w: 70 },
    ];

    const tableX = pageLeft;
    const rowH = 18;

    const drawRow = (y: number, row: Record<string, string>, isHeader = false) => {
      let x = tableX;
      doc.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor("#111");

      doc.moveTo(tableX, y).lineTo(pageRight, y).lineWidth(0.5).strokeColor("#111").stroke();
      for (const c of cols) {
        doc.text(row[c.key] ?? "", x + 2, y + 5, { width: c.w - 4, align: "center" });
        x += c.w;
      }
      doc.moveTo(tableX, y + rowH).lineTo(pageRight, y + rowH).lineWidth(0.5).strokeColor("#111").stroke();
    };

    let y = doc.y;

    drawRow(
      y,
      cols.reduce((acc: any, c) => {
        acc[c.key] = c.label;
        return acc;
      }, {}),
      true
    );
    y += rowH;

    const items = order.items || [];

    let totalQty = 0;
    let grossTotal = 0;
    let discountTotal = 0;
    let otherTotal = 0;
    let taxableTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let grandTotal = 0;

    for (const it of items) {
      const qty = Number(it.qty || 1);
      totalQty += qty;

      const mrp = Number(it.mrp || 0);
      const sale = Number(it.salePrice || 0);

      const gross = mrp * qty;
      const lineTotal = sale * qty;

      const discount = Math.max(0, gross - lineTotal);
      const other = 0;
      const taxable = lineTotal;

      const cgst = taxable * CGST_RATE;
      const sgst = taxable * SGST_RATE;
      const igst = taxable * IGST_RATE;

      const totalWithTax = taxable + cgst + sgst + igst + other;

      grossTotal += gross;
      discountTotal += discount;
      otherTotal += other;
      taxableTotal += taxable;
      cgstTotal += cgst;
      sgstTotal += sgst;
      igstTotal += igst;
      grandTotal += totalWithTax;

      if (y > doc.page.height - doc.page.margins.bottom - 120) {
        doc.addPage();
        y = doc.y;
        drawRow(
          y,
          cols.reduce((acc: any, c) => {
            acc[c.key] = c.label;
            return acc;
          }, {}),
          true
        );
        y += rowH;
      }

      drawRow(y, {
        qty: String(qty),
        gross: fmtRs(gross),
        discount: fmtRs(discount),
        other: fmtRs(other),
        taxable: fmtRs(taxable),
        cgst: fmtRs(cgst),
        sgst: fmtRs(sgst),
        igst: fmtRs(igst),
        total: fmtRs(totalWithTax),
      });
      y += rowH;

      doc.font("Helvetica").fontSize(8).fillColor("#333");
      doc.text(`${String(it.title || "Product")}  |  Code: ${String(it.productCode || "NA")}`, pageLeft, y + 3, {
        width: pageRight - pageLeft,
      });
      y += 14;
    }

    drawRow(y, {
      qty: String(totalQty),
      gross: fmtRs(grossTotal),
      discount: fmtRs(discountTotal),
      other: fmtRs(otherTotal),
      taxable: fmtRs(taxableTotal),
      cgst: fmtRs(cgstTotal),
      sgst: fmtRs(sgstTotal),
      igst: fmtRs(igstTotal),
      total: fmtRs(grandTotal),
    });
    y += rowH;

    doc.y = y + 10;

    doc.font("Helvetica").fontSize(8).fillColor("#444");
    doc.text(`${PROVIDER.legalName}`, pageLeft, doc.y);
    doc.moveDown(0.3);
    doc.text("Signature", pageLeft);
    doc.moveDown(0.8);
    doc.fillColor("#777").text("This is a computer generated invoice.", pageLeft);

    doc.end();
  } catch (err: any) {
    console.error("downloadInvoicePdf error:", err);
    return res.status(500).json({
      message: "Invoice generation failed",
      error: err?.message || "Unknown error",
    });
  }
};
