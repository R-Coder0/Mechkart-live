/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Cart } from "../../models/Cart.model";
import { Product } from "../../models/Product.model";

const getUserId = (req: Request) => (req as any).user?._id;

const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const getCheckoutSummary = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // 1) Fetch cart (ownerKey is primary)
    const ownerKey = `u:${String(userId)}`;
    const cart =
      (await Cart.findOne({ ownerKey })) ||
      (await Cart.findOne({ userId })); // fallback for older carts

    if (!cart || !cart.items?.length) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // ✅ ONLY selected items go to checkout
    const selectedItems = (cart.items as any[]).filter((it) => it?.isSelected === true);
    if (!selectedItems.length) {
      return res.status(400).json({ message: "No items selected for checkout" });
    }

    // 2) Fetch all products in one go (for selected items)
    const productIds = Array.from(new Set(selectedItems.map((it: any) => String(it.productId))));

    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
    })
      // ✅ MUST include images + colors + variants for checkout UI image+variant flow
      .select(
        "productId title slug featureImage galleryImages variants colors isActive mrp salePrice baseStock stock quantity"
      )
      .lean();

    const productMap = new Map(products.map((p: any) => [String(p._id), p]));

    // 3) Validate + build items (only selected)
    const items = selectedItems.map((it: any) => {
      const product = productMap.get(String(it.productId));

      if (!product || product.isActive === false) {
        throw new Error("Some products are unavailable");
      }

      const qty = toNum(it.qty, 0);
      if (!qty || qty <= 0) {
        throw new Error("Invalid quantity in cart");
      }

      const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;

      // ✅ Variant logic: required only if product has variants
      let variant: any = null;

      if (hasVariants) {
        variant = (product.variants || []).find((v: any) => String(v._id) === String(it.variantId));
        if (!variant) {
          throw new Error("Selected variant no longer exists");
        }
      } else {
        // product has no variants -> ignore variantId
        variant = null;
      }

      // ✅ Stock logic
      const available = hasVariants
        ? toNum(variant?.quantity ?? variant?.stock ?? 0, 0)
        : toNum(product.baseStock ?? product.stock ?? product.quantity ?? 0, 0);

      if (available <= 0) {
        throw new Error("Stock issue for some items");
      }
      if (qty > available) {
        throw new Error("Stock issue for some items");
      }

      // ✅ Price logic (variant > product; cart snapshot only as fallback)
      const mrp = hasVariants
        ? toNum(variant?.mrp ?? it.mrp ?? 0, 0)
        : toNum(product.mrp ?? it.mrp ?? 0, 0);

      const salePrice = hasVariants
        ? toNum(variant?.salePrice ?? it.salePrice ?? mrp, mrp)
        : toNum(product.salePrice ?? it.salePrice ?? mrp, mrp);

      const lineTotal = salePrice * qty;

      return {
        _id: String(it._id || ""),
        productId: String(it.productId),

        // ✅ Prefer snapshot in cart, else Product.productId
        productCode: String(it.productCode || product.productId || "NA"),

        // ✅ if no variants, keep variantId as null (important for UI + order)
        variantId: hasVariants ? String(it.variantId) : null,

        colorKey: it.colorKey ?? null,
        qty,

        title: String(it.title || product.title || "Product"),

        mrp,
        salePrice,
        lineTotal,

        // UI resolves image from product + variantId + colorKey
        product,
      };
    });

    // 4) Totals
    const subtotal = items.reduce((s: number, i: any) => s + toNum(i.lineTotal, 0), 0);
    const mrpTotal = items.reduce((s: number, i: any) => s + toNum(i.mrp, 0) * toNum(i.qty, 0), 0);
    const savings = Math.max(0, mrpTotal - subtotal);

    return res.status(200).json({
      message: "Checkout summary",
      data: {
        items,
        totals: { subtotal, mrpTotal, savings },
      },
    });
  } catch (err: any) {
    return res.status(409).json({
      message: err?.message || "Checkout summary failed",
    });
  }
};
