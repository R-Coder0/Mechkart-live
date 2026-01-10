/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { Cart } from "../../models/Cart.model";
import { Product } from "../../models/Product.model";
import { User } from "../../models/User.model";
import PDFDocument from "pdfkit";
import { Order } from "../../models/Order.model";

const getUserId = (req: Request) => (req as any).user?._id;
const toStr = (v: any) => String(v ?? "").trim();

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

const moneyNum = (n: any) => Math.round(Number(n || 0) * 100) / 100;
const fmtRs = (n: any) => `Rs ${moneyNum(n).toFixed(2)}`;

/**
 * Generates a readable order code:
 * e.g. CH-20260108-0001
 *
 * This uses DB count for the day (simple approach).
 * Later, you can replace with atomic Counter collection.
 */
async function generateOrderCodeForDay(date: Date) {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1, 2);
  const d = pad(date.getDate(), 2);
  const dayKey = `${y}-${m}-${d}`;

  // count orders created today (simple; ok for MVP)
  const start = new Date(`${dayKey}T00:00:00.000Z`);
  const end = new Date(`${dayKey}T23:59:59.999Z`);

  const count = await Order.countDocuments({
    createdAt: { $gte: start, $lte: end },
  });

  const seq = pad(count + 1, 4);
  return `CH-${y}${m}${d}-${seq}`;
}

/**
 * ✅ CREATE COD ORDER
 * - supports variant products + non-variant products
 * - validates stock accordingly
 * - saves productCode snapshot
 * - removes only selected cart lines
 * - sets selected address default
 */
export const createCodOrder = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const contact = req.body?.contact || {};
    const addressId = toStr(req.body?.addressId);

    const contactName = toStr(contact.name) || toStr((req as any).user?.name);
    const contactPhone = toStr(contact.phone) || toStr((req as any).user?.phone);
    const contactEmail = toStr(contact.email) || toStr((req as any).user?.email);

    if (!contactName || !contactPhone) {
      return res.status(400).json({ message: "Contact name and phone are required" });
    }
    if (!Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({ message: "Valid addressId is required" });
    }

    // 1) Fetch user with addresses
    const user = await User.findById(userId).select("addresses name phone email");
    if (!user) return res.status(404).json({ message: "User not found" });

    const addr: any = (user.addresses as any).id(addressId);
    if (!addr) return res.status(400).json({ message: "Address not found" });

    // 2) Fetch cart
    const ownerKey = `u:${String(userId)}`;
    const cart =
      (await Cart.findOne({ ownerKey })) ||
      (await Cart.findOne({ userId })); // fallback for old carts

    if (!cart || !cart.items?.length) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const selectedItems = (cart.items as any[]).filter((it) => it.isSelected === true);
    if (!selectedItems.length) {
      return res.status(400).json({ message: "No items selected for checkout" });
    }

    // 3) Load products for selected items
    const productIds = selectedItems.map((it: any) => it.productId);

    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
    })
      .select("title productId variants isActive mrp salePrice baseStock stock quantity")
      .lean();

    const productMap = new Map(products.map((p: any) => [String(p._id), p]));

    // 4) Validate stock (variant vs non-variant)
    for (const it of selectedItems) {
      const p: any = productMap.get(String(it.productId));
      if (!p) return res.status(409).json({ message: "Some products are unavailable now" });

      const qty = Number(it.qty || 0);
      if (!qty || qty <= 0) return res.status(409).json({ message: "Invalid quantity in cart" });

      const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;

      if (hasVariants) {
        const v = (p.variants || []).find((x: any) => String(x._id) === String(it.variantId));
        if (!v) return res.status(409).json({ message: "Selected variant no longer exists" });

        const available = Number(v.quantity ?? v.stock ?? 0);
        if (available <= 0) return res.status(409).json({ message: "Variant out of stock" });
        if (qty > available) {
          return res.status(409).json({ message: "Quantity exceeds available stock", available });
        }
      } else {
        const available = Number(p.baseStock ?? p.stock ?? p.quantity ?? 0);
        if (available <= 0) return res.status(409).json({ message: "Product out of stock" });
        if (qty > available) {
          return res.status(409).json({ message: "Quantity exceeds available stock", available });
        }
      }
    }

    // 5) Build order items snapshot
    const orderItems = selectedItems.map((it: any) => {
      const p: any = productMap.get(String(it.productId));

      const codeFromCart = toStr(it.productCode);
      const codeFromProduct = toStr(p?.productId); // CH000001
      const productCode = codeFromCart || codeFromProduct || "NA";

      const hasVariants = Array.isArray(p?.variants) && p.variants.length > 0;

      let mrp = 0;
      let salePrice = 0;
      let finalVariantId: any = null;

      if (hasVariants) {
        const v = (p.variants || []).find((x: any) => String(x._id) === String(it.variantId));
        if (!v) throw new Error("Selected variant no longer exists");
        mrp = Number(v.mrp ?? it.mrp ?? 0);
        salePrice = Number(v.salePrice ?? it.salePrice ?? mrp);
        finalVariantId = new Types.ObjectId(it.variantId);
      } else {
        mrp = Number(p?.mrp ?? it.mrp ?? 0);
        salePrice = Number(p?.salePrice ?? it.salePrice ?? mrp);
        finalVariantId = null;
      }

      return {
        productId: new Types.ObjectId(it.productId),
        productCode,
        variantId: finalVariantId,
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

    // ✅ Order code
    const now = new Date();
    const orderCode = await generateOrderCodeForDay(now);

    // 6) Create order
    const order = await Order.create({
      userId: new Types.ObjectId(userId),
      orderCode, // ✅ add this in Order model (field)
      items: orderItems,
      totals: { subtotal, mrpTotal, savings },

      contact: {
        name: contactName,
        phone: contactPhone,
        email: contactEmail || undefined,
      },

      address: {
        fullName: addr.fullName,
        phone: addr.phone,
        pincode: addr.pincode,
        state: addr.state,
        city: addr.city,
        addressLine1: addr.addressLine1,
        addressLine2: addr.addressLine2,
        landmark: addr.landmark,
      },

      paymentMethod: "COD",
      paymentStatus: "PENDING",
      status: "PLACED",
    });

    // 7) Make selected address default
    for (const a of user.addresses as any) a.isDefault = false;
    (user.addresses as any).id(addressId).isDefault = true;
    await user.save();

    // 8) Remove only selected cart lines
    const selectedIds = new Set(selectedItems.map((it: any) => String(it._id)));
    cart.items = (cart.items as any[]).filter((it: any) => !selectedIds.has(String(it._id))) as any;
    await cart.save();

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
    return res.status(500).json({
      message: "Order creation failed",
      error: err?.message || "Unknown error",
    });
  }
};

/**
 * ✅ GET ORDER BY ID
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

    // optional search (orderCode / phone / name / product title)
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
 * - fixed left/right alignment
 * - GST = 0
 * - Nature of transaction = paymentMethod
 * - QR + Barcode optional
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
      legalName: "mechkart PRIVATE LIMITED",
      addressLine1: "Your Office Address Line 1",
      addressLine2: "Your Office Address Line 2",
      city: "Your City",
      state: "HARYANA",
      pincode: "000000",
      gstin: "YOUR_GSTIN_HERE",
    };

    // ---------- Invoice meta ----------
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

    // ✅ For now GST = 0
    const CGST_RATE = 0;
    const SGST_RATE = 0;
    const IGST_RATE = 0;

    // ---------- PDF ----------
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

    // Left meta
    doc.text(`Invoice Number:`, pageLeft, topY, { continued: true });
    doc.font("Helvetica-Bold").text(` ${invoiceNumber}`);
    doc.font("Helvetica").text(`Order Code:`, pageLeft, doc.y, { continued: true });
    doc.font("Helvetica-Bold").text(` ${String(order.orderCode || "—")}`);
    doc.font("Helvetica").text(`Nature of Transaction:`, pageLeft, doc.y, { continued: true });
    doc.font("Helvetica-Bold").text(` ${String(order.paymentMethod || "COD")}`);
    doc.font("Helvetica").text(`Place of Supply:`, pageLeft, doc.y, { continued: true });
    doc.font("Helvetica-Bold").text(` ${placeOfSupply}`);

    // Right meta
    const metaRightX = pageLeft + 300;
    doc.y = topY;
    doc.font("Helvetica").text(`Date:`, metaRightX, doc.y, { continued: true });
    doc.font("Helvetica-Bold").text(` ${invoiceDateStr}`);
    doc.font("Helvetica").text(`Nature of Supply:`, metaRightX, doc.y, { continued: true });
    doc.font("Helvetica-Bold").text(` Goods`);

    // ✅ Barcode (optional) using bwip-js
    // npm i bwip-js
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
    } catch {
      // skip if bwip-js not installed
    }

    hr();
    doc.moveDown(0.2);

    // ---------- Two columns (FIXED ALIGNMENT) ----------
    const gap = 24;
    const colW = (pageRight - pageLeft - gap) / 2;
    const leftX = pageLeft;
    const provX = pageLeft + colW + gap;

    const startY = doc.y;

    // Left block
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

    // Right block
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

    // ✅ QR (optional) - npm i qrcode
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
    } catch {
      // skip if qrcode not installed
    }

    // move cursor below both columns
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

    // header row
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

      const cgst = taxable * CGST_RATE; // 0
      const sgst = taxable * SGST_RATE; // 0
      const igst = taxable * IGST_RATE; // 0

      const totalWithTax = taxable + cgst + sgst + igst + other;

      grossTotal += gross;
      discountTotal += discount;
      otherTotal += other;
      taxableTotal += taxable;
      cgstTotal += cgst;
      sgstTotal += sgst;
      igstTotal += igst;
      grandTotal += totalWithTax;

      // page break
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

    // total row
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

    // footer
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