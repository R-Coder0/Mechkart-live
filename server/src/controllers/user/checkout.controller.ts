/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { Cart } from "../../models/Cart.model";
import { Product } from "../../models/Product.model";
import { validateAndComputeOffer } from "../../services/offer.apply.service";

const getUserId = (req: Request) => (req as any).user?._id;

const toStr = (v: any) => String(v ?? "").trim();
const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

const oid = (v: any) => new Types.ObjectId(String(v));

/**
 * Compute eligible products for appliedOffer based on already-fetched product data inside items
 * (so we don't need extra DB calls here).
 */
function buildEligibleSetFromItems(appliedOffer: any, items: any[]) {
  const scope = String(appliedOffer?.scope || "SITE");

  if (scope === "SITE") {
    return new Set(items.map((it) => String(it.productId)));
  }

  if (scope === "PRODUCT") {
    const allowed = new Set((appliedOffer?.productIds || []).map((x: any) => String(x)));
    return new Set(items.filter((it) => allowed.has(String(it.productId))).map((it) => String(it.productId)));
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

  // fallback = no eligible
  return new Set<string>();
}

/**
 * Allocate cart discount across eligible items proportionally (with rounding remainder fix).
 * Returns new items with:
 *  - offerDiscount
 *  - finalLineTotal
 *  - effectiveUnitPrice
 */
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

  // find last eligible index for remainder adjustment
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

export const getCheckoutSummary = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // couponCode can come from query (?couponCode=XXXX) OR body
    const couponCode = toStr((req.query as any)?.couponCode || (req.body as any)?.couponCode) || "";

    // 1) Fetch cart (ownerKey primary)
    const ownerKey = `u:${String(userId)}`;
    const cart = (await Cart.findOne({ ownerKey })) || (await Cart.findOne({ userId }));

    if (!cart || !cart.items?.length) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // only selected
    const selectedItems = (cart.items as any[]).filter((it) => it?.isSelected === true);
    if (!selectedItems.length) {
      return res.status(400).json({ message: "No items selected for checkout" });
    }

    // 2) fetch products
    const productIds = Array.from(new Set(selectedItems.map((it: any) => String(it.productId))));
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
    })
      .select(
        "productId title slug featureImage galleryImages variants colors isActive mrp salePrice baseStock stock quantity category subCategory"
      )
      .lean();

    const productMap = new Map(products.map((p: any) => [String(p._id), p]));

    // 3) build items
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

      const mrp = hasVariants
        ? toNum(variant?.mrp ?? it.mrp ?? 0, 0)
        : toNum(product.mrp ?? it.mrp ?? 0, 0);

      const salePrice = hasVariants
        ? toNum(variant?.salePrice ?? it.salePrice ?? mrp, mrp)
        : toNum(product.salePrice ?? it.salePrice ?? mrp, mrp);

      const lineTotal = round2(salePrice * qty);

      return {
        _id: String(it._id || ""),
        productId: String(it.productId),
        productCode: String(it.productCode || product.productId || "NA"),
        variantId: hasVariants ? String(it.variantId) : null,
        colorKey: it.colorKey ?? null,
        qty,
        title: String(it.title || product.title || "Product"),
        mrp,
        salePrice,
        lineTotal,
        product, // for UI image + category/subCategory eligibility
      };
    });

    // 4) base totals
    const subtotal = round2(items.reduce((s: number, i: any) => s + toNum(i.lineTotal, 0), 0));
    const mrpTotal = round2(items.reduce((s: number, i: any) => s + toNum(i.mrp, 0) * toNum(i.qty, 0), 0));
    const savings = Math.max(0, round2(mrpTotal - subtotal));

    // 5) offer compute (AUTO if coupon empty; COUPON if coupon provided)
    const lines = items.map((it: any) => ({
      productId: oid(it.productId),
      qty: Number(it.qty || 0),
      salePrice: Number(it.salePrice || 0),
    }));

    const offerResult = await validateAndComputeOffer({
      userId: oid(userId),
      couponCode: couponCode ? couponCode.toUpperCase() : undefined,
      lines,
    });

    // if user entered coupon and invalid => show error
    if (couponCode && !offerResult.ok) {
      return res.status(400).json({ message: offerResult.reason || "Invalid coupon" });
    }

    const appliedOffer = offerResult.ok ? offerResult.appliedOffer : null;
    const discountRaw = offerResult.ok ? Number(offerResult.discount || 0) : 0;
    const discount = Math.max(0, Math.min(round2(discountRaw), subtotal));

    // 6) allocate discount per-item so UI can show clear MRP -> final price
    const eligibleSet = appliedOffer ? buildEligibleSetFromItems(appliedOffer, items) : new Set<string>();
    const itemsWithOffer = allocateDiscountToItems(items, eligibleSet, discount);

    const grandTotal = Math.max(0, round2(subtotal - discount));

    return res.status(200).json({
      message: "Checkout summary",
      data: {
        items: itemsWithOffer,
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

/**
 * Optional endpoint: Offer preview (coupon apply button).
 * It returns the SAME structure as checkout summary totals (and can be used by UI),
 * but typically UI can just call getCheckoutSummary with ?couponCode=XXXX.
 */
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

    // Use checkout summary logic: fetch products so scope eligibility stays correct
    const productIds = Array.from(new Set(selectedItems.map((it: any) => String(it.productId))));
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
    })
      .select("mrp salePrice variants baseStock stock quantity category subCategory isActive")
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

      const mrp = hasVariants ? toNum(variant?.mrp ?? it.mrp ?? 0, 0) : toNum(product.mrp ?? it.mrp ?? 0, 0);
      const salePrice = hasVariants
        ? toNum(variant?.salePrice ?? it.salePrice ?? mrp, mrp)
        : toNum(product.salePrice ?? it.salePrice ?? mrp, mrp);

      const lineTotal = round2(salePrice * qty);

      return {
        productId: String(it.productId),
        qty,
        mrp,
        salePrice,
        lineTotal,
        product,
      };
    });

    const subtotal = round2(items.reduce((s: number, it: any) => s + Number(it.lineTotal || 0), 0));

    const lines = items.map((it: any) => ({
      productId: oid(it.productId),
      qty: Number(it.qty || 0),
      salePrice: Number(it.salePrice || 0),
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
