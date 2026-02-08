/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { Cart } from "../../models/Cart.model";
import { Product } from "../../models/Product.model";
import { validateAndComputeOffer } from "../../services/offer.apply.service";
import { Vendor } from "../../models/Vendor.model";

const getUserId = (req: Request) => (req as any).user?._id;

const toStr = (v: any) => String(v ?? "").trim();
const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

const oid = (v: any) => new Types.ObjectId(String(v));

/** =========================
 * Shipping Markup (Vendor-only)
 * ========================= */
// 0.5kg => 60, every next 0.5kg => +30
const calcShippingMarkup = (weightKg: any) => {
  const w = Number(weightKg || 0);
  if (!Number.isFinite(w) || w <= 0) return 0;

  const step = 0.5;
  const slabs = Math.ceil(w / step);
  const base = 60;
  const extra = Math.max(0, slabs - 1) * 30;
  return base + extra;
};

const getShippingMarkupForProduct = (product: any) => {
  // ✅ ONLY vendor products
  if (String(product?.ownerType) !== "VENDOR") return 0;
  const weightKg = product?.ship?.weightKg ?? 0;
  return calcShippingMarkup(weightKg);
};

/** =========================
 * Offer helpers
 * ========================= */
function buildEligibleSetFromItems(appliedOffer: any, items: any[]) {
  const scope = String(appliedOffer?.scope || "SITE");

  if (scope === "SITE") {
    return new Set(items.map((it) => String(it.productId)));
  }

  if (scope === "PRODUCT") {
    const allowed = new Set((appliedOffer?.productIds || []).map((x: any) => String(x)));
    return new Set(
      items
        .filter((it) => allowed.has(String(it.productId)))
        .map((it) => String(it.productId))
    );
  }

  if (scope === "CATEGORY") {
    const allowed = new Set((appliedOffer?.categoryIds || []).map((x: any) => String(x)));
    return new Set(
      items
        .filter((it) => allowed.has(String(it?.product?.category)))
        .map((it) => String(it.productId))
    );
  }

  if (scope === "SUBCATEGORY") {
    const allowed = new Set((appliedOffer?.subCategoryIds || []).map((x: any) => String(x)));
    return new Set(
      items
        .filter((it) => it?.product?.subCategory && allowed.has(String(it.product.subCategory)))
        .map((it) => String(it.productId))
    );
  }

  return new Set<string>();
}

function allocateDiscountToItems(items: any[], eligibleSet: Set<string>, totalDiscount: number) {
  const discount = Math.max(0, Number(totalDiscount || 0));
  if (!discount || eligibleSet.size === 0) {
    return items.map((it) => ({
      ...it,
      offerDiscount: 0,
      finalLineTotal: round2(Number(it.lineTotal || 0)),
      effectiveUnitPrice: it.qty ? round2(Number(it.lineTotal || 0) / Number(it.qty || 1)) : 0,
    }));
  }

  const eligibleSubtotal = items.reduce((s, it) => {
    if (!eligibleSet.has(String(it.productId))) return s;
    return s + Number(it.lineTotal || 0);
  }, 0);

  if (eligibleSubtotal <= 0) {
    return items.map((it) => ({
      ...it,
      offerDiscount: 0,
      finalLineTotal: round2(Number(it.lineTotal || 0)),
      effectiveUnitPrice: it.qty ? round2(Number(it.lineTotal || 0) / Number(it.qty || 1)) : 0,
    }));
  }

  let lastEligibleIndex = -1;
  items.forEach((it, idx) => {
    if (eligibleSet.has(String(it.productId))) lastEligibleIndex = idx;
  });

  let allocated = 0;

  return items.map((it, idx) => {
    let offerDiscount = 0;

    if (eligibleSet.has(String(it.productId))) {
      const raw = (Number(it.lineTotal || 0) / eligibleSubtotal) * discount;
      offerDiscount = round2(raw);

      if (idx === lastEligibleIndex) {
        offerDiscount = round2(discount - allocated);
      } else {
        allocated = round2(allocated + offerDiscount);
      }
    }

    offerDiscount = Math.max(0, Math.min(Number(it.lineTotal || 0), offerDiscount));

    const finalLineTotal = Math.max(0, round2(Number(it.lineTotal || 0) - offerDiscount));
    const qty = Number(it.qty || 0) || 1;
    const effectiveUnitPrice = round2(finalLineTotal / qty);

    return {
      ...it,
      offerDiscount,
      finalLineTotal,
      effectiveUnitPrice,
    };
  });
}

/**
 * Group items seller-wise:
 * - ADMIN => "ADMIN"
 * - VENDOR => "VENDOR:<vendorId>"
 */
function groupBySeller(items: any[]) {
  const map = new Map<string, any>();

  for (const it of items) {
    const ownerType = String(it.ownerType || it?.product?.ownerType || "ADMIN");
    const vendorId =
      ownerType === "VENDOR" && (it.vendorId || it?.product?.vendorId)
        ? String(it.vendorId || it?.product?.vendorId)
        : "";

    const key = ownerType === "ADMIN" ? "ADMIN" : `VENDOR:${vendorId}`;

    if (!map.has(key)) {
      map.set(key, {
        ownerType,
        vendorId: ownerType === "VENDOR" ? (vendorId || null) : null,
        soldBy: ownerType === "ADMIN" ? "Mechkart" : String(it.soldBy || "Vendor"),
        items: [],
        subtotal: 0,
      });
    }

    const g = map.get(key);
    g.items.push(it);
    g.subtotal = round2(Number(g.subtotal || 0) + Number(it.finalLineTotal ?? it.lineTotal ?? 0));
  }

  const arr = Array.from(map.values());
  arr.sort((a, b) => (a.ownerType === "ADMIN" ? 1 : 0) - (b.ownerType === "ADMIN" ? 1 : 0));
  return arr;
}

/** =========================
 * GET CHECKOUT SUMMARY
 * ========================= */
export const getCheckoutSummary = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const couponCode = toStr((req.query as any)?.couponCode || (req.body as any)?.couponCode) || "";

    const ownerKey = `u:${String(userId)}`;
    const cart = (await Cart.findOne({ ownerKey })) || (await Cart.findOne({ userId }));

    if (!cart || !cart.items?.length) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const selectedItems = (cart.items as any[]).filter((it) => it?.isSelected === true);
    if (!selectedItems.length) {
      return res.status(400).json({ message: "No items selected for checkout" });
    }

    // ✅ products fetch must include ship + ownerType + vendorId always
    const productIds = Array.from(new Set(selectedItems.map((it: any) => String(it.productId))));
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
    })
      .select(
        "productId title slug featureImage galleryImages variants colors isActive mrp salePrice baseStock stock quantity category subCategory ownerType vendorId ship"
      )
      .lean();

    const productMap = new Map(products.map((p: any) => [String(p._id), p]));

    // vendor names
    const vendorIds = Array.from(
      new Set(
        products
          .filter((p: any) => String(p.ownerType) === "VENDOR" && p.vendorId)
          .map((p: any) => String(p.vendorId))
      )
    );

    const vendors = vendorIds.length
      ? await Vendor.find({ _id: { $in: vendorIds } }).select("company.name").lean()
      : [];

    const vendorMap = new Map(vendors.map((v: any) => [String(v._id), v]));

    const items = selectedItems.map((it: any) => {
      const product = productMap.get(String(it.productId));
      if (!product || product.isActive === false) throw new Error("Some products are unavailable");

      const qty = toNum(it.qty, 0);
      if (!qty || qty <= 0) throw new Error("Invalid quantity in cart");

      const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;

      let variant: any = null;
      if (hasVariants) {
        variant = (product.variants || []).find((v: any) => String(v._id) === String(it.variantId));
        if (!variant) throw new Error("Selected variant no longer exists");
      }

      const available = hasVariants
        ? toNum(variant?.quantity ?? variant?.stock ?? 0, 0)
        : toNum(product.baseStock ?? product.stock ?? product.quantity ?? 0, 0);

      if (available <= 0) throw new Error("Stock issue for some items");
      if (qty > available) throw new Error("Stock issue for some items");

      // ✅ base pricing (without shipping)
      const baseMrp = hasVariants ? toNum(variant?.mrp ?? it.mrp ?? 0, 0) : toNum(product.mrp ?? it.mrp ?? 0, 0);

      const baseSalePrice = hasVariants
        ? toNum(variant?.salePrice ?? it.salePrice ?? baseMrp, baseMrp)
        : toNum(product.salePrice ?? it.salePrice ?? baseMrp, baseMrp);

      // ✅ shipping markup only for vendor products
      const shippingMarkup = getShippingMarkupForProduct(product);

      // ✅ payable (customer-facing)
      const payableMrp = round2(baseMrp + shippingMarkup);
      const payableSalePrice = round2(baseSalePrice + shippingMarkup);

      const lineTotal = round2(payableSalePrice * qty);

      const ownerType = String(product.ownerType || "ADMIN");
      const vendorId =
        ownerType === "VENDOR" && product.vendorId ? String(product.vendorId) : null;

      const vendorDoc = vendorId ? vendorMap.get(String(vendorId)) : null;
      const soldBy = ownerType === "VENDOR" ? String(vendorDoc?.company?.name || "Vendor") : "Mechkart";

      return {
        _id: String(it._id || ""),
        productId: String(it.productId),
        productCode: String(it.productCode || product.productId || "NA"),
        variantId: hasVariants ? String(it.variantId) : null,
        colorKey: it.colorKey ?? null,
        qty,
        title: String(it.title || product.title || "Product"),

        // ✅ payable shown to customer + used in totals/offers
        mrp: payableMrp,
        salePrice: payableSalePrice,
        lineTotal,

        pricingMeta: {
          baseMrp,
          baseSalePrice,
          shippingMarkup,
          weightKg: product?.ship?.weightKg ?? 0,
        },

        ownerType,
        vendorId,
        soldBy,

        product,
      };
    });

    // totals based on payable prices (customer payable)
    const subtotal = round2(items.reduce((s: number, i: any) => s + toNum(i.lineTotal, 0), 0));
    const mrpTotal = round2(items.reduce((s: number, i: any) => s + toNum(i.mrp, 0) * toNum(i.qty, 0), 0));
    const savings = Math.max(0, round2(mrpTotal - subtotal));

    const lines = items.map((it: any) => ({
      productId: oid(it.productId),
      qty: Number(it.qty || 0),
      salePrice: Number(it.salePrice || 0), // ✅ payable salePrice
    }));

    const offerResult = await validateAndComputeOffer({
      userId: oid(userId),
      couponCode: couponCode ? couponCode.toUpperCase() : undefined,
      lines,
    });

    if (couponCode && !offerResult.ok) {
      return res.status(400).json({ message: offerResult.reason || "Invalid coupon" });
    }

    const appliedOffer = offerResult.ok ? offerResult.appliedOffer : null;
    const discountRaw = offerResult.ok ? Number(offerResult.discount || 0) : 0;
    const discount = Math.max(0, Math.min(round2(discountRaw), subtotal));

    const eligibleSet = appliedOffer ? buildEligibleSetFromItems(appliedOffer, items) : new Set<string>();
    const itemsWithOffer = allocateDiscountToItems(items, eligibleSet, discount);

    const grandTotal = Math.max(0, round2(subtotal - discount));
    const groups = groupBySeller(itemsWithOffer);

    return res.status(200).json({
      message: "Checkout summary",
      data: {
        items: itemsWithOffer,
        groups,
        totals: { subtotal, mrpTotal, savings, discount, grandTotal },
        appliedOffer: appliedOffer || null,
        couponCode: couponCode ? couponCode.toUpperCase() : null,
      },
    });
  } catch (err: any) {
    return res.status(409).json({
      message: err?.message || "Checkout summary failed",
    });
  }
};

/** =========================
 * OFFER PREVIEW
 * ========================= */
export const offerPreview = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const couponCode = toStr((req.body as any)?.couponCode) || "";

    const ownerKey = `u:${String(userId)}`;
    const cart = (await Cart.findOne({ ownerKey })) || (await Cart.findOne({ userId }));

    if (!cart || !cart.items?.length) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const selectedItems = (cart.items as any[]).filter((it) => it?.isSelected === true);
    if (!selectedItems.length) {
      return res.status(400).json({ message: "No items selected for checkout" });
    }

    // ✅ MUST include ownerType + ship so vendor-only shipping applies correctly
    const productIds = Array.from(new Set(selectedItems.map((it: any) => String(it.productId))));
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
    })
      .select("mrp salePrice variants baseStock stock quantity category subCategory isActive ship ownerType")
      .lean();

    const productMap = new Map(products.map((p: any) => [String(p._id), p]));

    const items = selectedItems.map((it: any) => {
      const product = productMap.get(String(it.productId));
      if (!product || product.isActive === false) throw new Error("Some products are unavailable");

      const qty = toNum(it.qty, 0);
      if (!qty || qty <= 0) throw new Error("Invalid quantity in cart");

      const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
      const variant = hasVariants
        ? (product.variants || []).find((v: any) => String(v._id) === String(it.variantId))
        : null;

      const baseMrp = hasVariants ? toNum(variant?.mrp ?? it.mrp ?? 0, 0) : toNum(product.mrp ?? it.mrp ?? 0, 0);

      const baseSalePrice = hasVariants
        ? toNum(variant?.salePrice ?? it.salePrice ?? baseMrp, baseMrp)
        : toNum(product.salePrice ?? it.salePrice ?? baseMrp, baseMrp);

      const shippingMarkup = getShippingMarkupForProduct(product);

      const payableMrp = round2(baseMrp + shippingMarkup);
      const payableSalePrice = round2(baseSalePrice + shippingMarkup);
      const lineTotal = round2(payableSalePrice * qty);

      return {
        productId: String(it.productId),
        qty,
        mrp: payableMrp,
        salePrice: payableSalePrice,
        lineTotal,
        pricingMeta: {
          baseMrp,
          baseSalePrice,
          shippingMarkup,
          weightKg: product?.ship?.weightKg ?? 0,
        },
        product,
      };
    });

    const subtotal = round2(items.reduce((s: number, it: any) => s + Number(it.lineTotal || 0), 0));

    const lines = items.map((it: any) => ({
      productId: oid(it.productId),
      qty: Number(it.qty || 0),
      salePrice: Number(it.salePrice || 0), // ✅ payable salePrice
    }));

    const offerResult = await validateAndComputeOffer({
      userId: oid(userId),
      couponCode: couponCode ? couponCode.toUpperCase() : undefined,
      lines,
    });

    if (!offerResult.ok) {
      return res.status(400).json({ message: offerResult.reason || "Offer not applicable" });
    }

    const appliedOffer = offerResult.appliedOffer || null;
    const discountRaw = Number(offerResult.discount || 0);
    const discount = Math.max(0, Math.min(round2(discountRaw), subtotal));
    const grandTotal = Math.max(0, round2(subtotal - discount));

    return res.json({
      message: "Offer preview",
      data: {
        subtotal,
        discount,
        grandTotal,
        appliedOffer,
        couponCode: couponCode ? couponCode.toUpperCase() : null,
      },
    });
  } catch (err: any) {
    return res.status(409).json({ message: err?.message || "Offer preview failed" });
  }
};
