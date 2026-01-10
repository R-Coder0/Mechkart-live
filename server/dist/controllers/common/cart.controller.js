"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearCart = exports.removeCartItem = exports.updateCartItemOptions = exports.setCartSelectAll = exports.setCartItemSelected = exports.updateCartQty = exports.addToCart = exports.getMyCart = void 0;
const mongoose_1 = require("mongoose");
const crypto_1 = __importDefault(require("crypto"));
const Cart_model_1 = require("../../models/Cart.model");
const Product_model_1 = require("../../models/Product.model");
/** =========================
 * Helpers
 * ========================= */
const normalizeColorKey = (v) => {
    if (v === undefined || v === null)
        return null;
    const s = String(v).trim().toLowerCase();
    return s.length ? s : null;
};
const toPositiveInt = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0)
        return null;
    return Math.floor(n);
};
const oid = (v) => String(v || "");
const lineMatches = (it, productId, variantId, colorKey) => {
    const p = oid(it.productId);
    const v = oid(it.variantId);
    const c = it.colorKey ? String(it.colorKey).trim().toLowerCase() : null;
    return p === productId && v === variantId && c === colorKey;
};
// user injected by verifyUser middleware (cookie auth)
const getUserId = (req) => req.user?._id || null;
const GUEST_COOKIE = "guestId";
const getOrCreateGuestId = (req, res) => {
    const existing = req.cookies?.[GUEST_COOKIE];
    if (existing && String(existing).trim())
        return String(existing).trim();
    const gid = crypto_1.default.randomUUID(); // Node 18+
    res.cookie(GUEST_COOKIE, gid, {
        httpOnly: true,
        sameSite: "lax",
        // secure: true, // enable on HTTPS production
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        path: "/",
    });
    return gid;
};
const getOwner = (req, res) => {
    const userId = getUserId(req);
    if (userId) {
        return {
            ownerKey: `u:${String(userId)}`,
            userId,
            guestId: null,
        };
    }
    const guestId = getOrCreateGuestId(req, res);
    return {
        ownerKey: `g:${guestId}`,
        userId: null,
        guestId,
    };
};
const getOrCreateCart = async (ownerKey, userId, guestId) => {
    let cart = await Cart_model_1.Cart.findOne({ ownerKey });
    if (!cart) {
        cart = await Cart_model_1.Cart.create({
            ownerKey,
            userId: userId ?? null,
            guestId: guestId ?? null,
            items: [],
        });
    }
    return cart;
};
/**
 * Enrich cart items with lightweight product data (same shape as GET /common/cart)
 * IMPORTANT: This is the root fix for UI disappearing after mutations.
 */
const enrichCartLean = async (cartLean) => {
    if (!cartLean)
        return null;
    const productIds = (cartLean.items || []).map((i) => i.productId);
    const products = await Product_model_1.Product.find({
        _id: { $in: productIds },
        isActive: true,
    })
        .select("title slug featureImage galleryImages variants colors isActive")
        .lean();
    const map = new Map(products.map((p) => [String(p._id), p]));
    const items = (cartLean.items || []).map((it) => ({
        ...it,
        product: map.get(String(it.productId)) || null,
    }));
    return { ...cartLean, items };
};
const getEnrichedCartByOwnerKey = async (ownerKey) => {
    const cartLean = await Cart_model_1.Cart.findOne({ ownerKey }).lean();
    if (!cartLean)
        return null;
    return enrichCartLean(cartLean);
};
const getEnrichedCartById = async (cartId) => {
    const cartLean = await Cart_model_1.Cart.findById(cartId).lean();
    if (!cartLean)
        return null;
    return enrichCartLean(cartLean);
};
const mergeGuestCartIntoUserCart = async (userId, guestId) => {
    const userOwnerKey = `u:${String(userId)}`;
    const guestOwnerKey = `g:${String(guestId)}`;
    const [userCart, guestCart] = await Promise.all([
        Cart_model_1.Cart.findOne({ ownerKey: userOwnerKey }),
        Cart_model_1.Cart.findOne({ ownerKey: guestOwnerKey }),
    ]);
    if (!guestCart || !guestCart.items?.length) {
        return userCart || null;
    }
    const target = userCart || (await Cart_model_1.Cart.create({
        ownerKey: userOwnerKey,
        userId,
        guestId: null,
        items: [],
    }));
    // merge items (same productId+variantId+colorKey)
    for (const gi of guestCart.items) {
        const idx = target.items.findIndex((ui) => (String(ui.productId) === String(gi.productId) &&
            String(ui.variantId || "") === String(gi.variantId || "") &&
            String((ui.colorKey || "").toLowerCase()) === String((gi.colorKey || "").toLowerCase())));
        if (idx > -1) {
            target.items[idx].qty = Number(target.items[idx].qty || 0) + Number(gi.qty || 0);
            target.items[idx].updatedAt = new Date();
            // keep selected true if any of them is selected
            target.items[idx].isSelected = Boolean(target.items[idx].isSelected) || Boolean(gi.isSelected);
        }
        else {
            target.items.push({
                ...gi,
                _id: new mongoose_1.Types.ObjectId(), // new line id
                isSelected: gi.isSelected ?? true,
                addedAt: gi.addedAt || new Date(),
                updatedAt: new Date(),
            });
        }
    }
    await target.save();
    await Cart_model_1.Cart.deleteOne({ _id: guestCart._id }); // remove guest cart after merge
    return target;
};
/** =========================
 * Controllers
 * ========================= */
/**
 * GET /api/common/cart
 * returns cart + lightweight product enrichment for UI
 */
const getMyCart = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        // ✅ If logged-in + guest cookie exists, merge once
        const guestId = req.cookies?.[GUEST_COOKIE];
        if (userId && guestId) {
            await mergeGuestCartIntoUserCart(userId, String(guestId));
            // optional: clear guest cookie after merge (recommended)
            res.clearCookie(GUEST_COOKIE, { path: "/" });
        }
        const { ownerKey } = getOwner(req, res);
        const enriched = await getEnrichedCartByOwnerKey(ownerKey);
        return res.status(200).json({
            message: "Cart fetched",
            data: enriched || { items: [] },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getMyCart = getMyCart;
/**
 * POST /api/common/cart/add
 * body: { productId, variantId, colorKey?, qty }
 * - merges same (productId + variantId + colorKey)
 * - snapshots: title/image/mrp/salePrice
 */
const addToCart = async (req, res) => {
    try {
        const { productId, variantId = null, colorKey = null, qty = 1, selectOnAdd = false, clearOthers = false } = req.body;
        const safeQty = Math.max(1, Number(qty) || 1);
        const normColorKey = typeof colorKey === "string" ? colorKey.trim().toLowerCase() || null : null;
        // 1) Load product
        const product = await Product_model_1.Product.findById(productId).lean();
        if (!product)
            return res.status(404).json({ message: "Product not found" });
        const productTitle = product.title || "Product";
        const productCode = String(product.productId || "");
        const productMrp = Number(product.mrp) || 0;
        const productSale = Number(product.salePrice) || 0;
        const productImage = product.featureImage ||
            (Array.isArray(product.galleryImages) && product.galleryImages.length
                ? product.galleryImages[0]
                : null) ||
            null;
        const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
        // 2) Resolve chosen variant (if exists)
        let chosenVariant = null;
        if (hasVariants) {
            if (!variantId) {
                return res.status(400).json({ message: "variantId is required for this product" });
            }
            chosenVariant = product.variants.find((v) => String(v._id) === String(variantId));
            if (!chosenVariant) {
                return res.status(400).json({ message: "Invalid variantId" });
            }
        }
        // 3) Price snapshot
        const resolvedMrp = hasVariants && chosenVariant?.mrp != null && !Number.isNaN(Number(chosenVariant.mrp))
            ? Number(chosenVariant.mrp)
            : productMrp;
        const resolvedSalePrice = hasVariants && chosenVariant?.salePrice != null && !Number.isNaN(Number(chosenVariant.salePrice))
            ? Number(chosenVariant.salePrice)
            : productSale;
        // 4) Image snapshot (color -> variant -> product)
        const variantImage = (hasVariants && (chosenVariant?.image || chosenVariant?.featuredImage)) || null;
        // NOTE: your product schema has product.colors, not variant.colors.
        // keep current behavior minimal: resolve from product.colors images if matches.
        let colorImage = null;
        const normalizedColor = normalizeColorKey(normColorKey);
        if (normalizedColor && Array.isArray(product.colors)) {
            const selected = product.colors.find((c) => {
                const nm = String(c?.name || "").trim().toLowerCase();
                return nm && nm === normalizedColor;
            });
            if (selected?.images?.length)
                colorImage = selected.images[0];
        }
        const resolvedImage = colorImage || variantImage || productImage;
        // 5) Owner
        const { ownerKey, userId, guestId } = getOwner(req, res);
        const cart = await getOrCreateCart(ownerKey, userId, guestId);
        // 6) Merge key
        const idx = cart.items.findIndex((it) => {
            const sameProduct = String(it.productId) === String(productId);
            const sameVariant = String(it.variantId || "") === String(variantId || "");
            const sameColor = String(it.colorKey || "") === String(normColorKey || "");
            return sameProduct && sameVariant && sameColor;
        });
        // ✅ BuyNow behavior: optionally unselect all other items
        // ✅ BuyNow behavior: optionally unselect all other items
        if (clearOthers === true) {
            for (const it of cart.items)
                it.isSelected = false;
        }
        // ✅ Selection rules:
        // - default add-to-cart: selected true
        // - buyNow: selected true + clearOthers already handled
        const finalSelected = true;
        const payload = {
            productId,
            productCode,
            variantId: hasVariants ? variantId : null,
            colorKey: normColorKey,
            qty: safeQty,
            isSelected: finalSelected,
            title: productTitle,
            image: resolvedImage,
            mrp: resolvedMrp,
            salePrice: resolvedSalePrice,
            addedAt: new Date(),
            updatedAt: new Date(),
        };
        if (idx >= 0) {
            cart.items[idx].qty += safeQty;
            cart.items[idx].updatedAt = new Date();
            // refresh snapshot
            cart.items[idx].title = payload.title;
            cart.items[idx].productCode = payload.productCode;
            cart.items[idx].image = payload.image;
            cart.items[idx].mrp = payload.mrp;
            cart.items[idx].salePrice = payload.salePrice;
            cart.items[idx].colorKey = payload.colorKey;
            cart.items[idx].variantId = payload.variantId;
            // ✅ keep selected true unless BuyNow cleared others
            cart.items[idx].isSelected = true;
        }
        else {
            cart.items.unshift(payload);
        }
        await cart.save();
        // ✅ return enriched cart (same as GET)
        const enriched = await getEnrichedCartById(cart._id);
        return res.status(200).json({ message: "Added to cart", data: enriched || cart });
    }
    catch (err) {
        console.error("❌ addToCart error:", err);
        return res.status(500).json({
            message: "Server error",
            error: err?.message || "Unknown error",
        });
    }
};
exports.addToCart = addToCart;
/**
 * PATCH /api/common/cart/qty
 * body: { itemId, qty }
 * - Guest allowed (qty only)
 * - Logged-in allowed
 * - Validates stock against latest product variant.quantity
 */
const updateCartQty = async (req, res, next) => {
    try {
        const { ownerKey, userId, guestId } = getOwner(req, res);
        const { itemId, qty } = req.body;
        if (!mongoose_1.Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({ message: "Invalid itemId" });
        }
        const newQty = toPositiveInt(qty);
        if (!newQty) {
            return res.status(400).json({ message: "Invalid qty" });
        }
        const cart = await getOrCreateCart(ownerKey, userId, guestId);
        const item = cart.items.find((it) => String(it._id) === String(itemId));
        if (!item)
            return res.status(404).json({ message: "Cart item not found" });
        const product = await Product_model_1.Product.findById(item.productId)
            .select("isActive variants baseStock stock quantity")
            .lean();
        if (!product || product.isActive === false) {
            return res.status(409).json({ message: "Product unavailable now" });
        }
        const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
        let available = 0;
        if (hasVariants) {
            const variant = (product.variants || []).find((v) => String(v._id) === String(item.variantId));
            if (!variant) {
                return res.status(409).json({ message: "Selected variant no longer exists" });
            }
            available = Number(variant.quantity ?? variant.stock ?? 0);
            if (available <= 0)
                return res.status(409).json({ message: "Selected variant out of stock" });
        }
        else {
            // ✅ No variants => validate against product-level stock
            available = Number(product.baseStock ?? product.stock ?? product.quantity ?? 0);
            if (available <= 0)
                return res.status(409).json({ message: "Product out of stock" });
            // keep cart line clean
            item.variantId = null;
        }
        if (newQty > available) {
            return res.status(409).json({ message: "Quantity exceeds available stock", available });
        }
        item.qty = newQty;
        item.updatedAt = new Date();
        await cart.save();
        const enriched = await getEnrichedCartById(cart._id);
        return res.status(200).json({ message: "Quantity updated", data: enriched || cart });
    }
    catch (err) {
        next(err);
    }
};
exports.updateCartQty = updateCartQty;
/**
 * PATCH /api/common/cart/item/options
 * body: { itemId, variantId, colorKey? }
 * - Logged-in ONLY (guest cannot change variant/color)
 * - Updates commercial snapshots (mrp/salePrice)
 * - Merges lines if same (productId+variantId+colorKey) already exists
 */
/**
 * PATCH /api/common/cart/item/select
 * body: { itemId, isSelected }
 * - Guest allowed (selection is UI-level)
 */
const setCartItemSelected = async (req, res, next) => {
    try {
        const { ownerKey, userId, guestId } = getOwner(req, res);
        const { itemId, isSelected } = req.body;
        if (!mongoose_1.Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({ message: "Invalid itemId" });
        }
        const cart = await getOrCreateCart(ownerKey, userId, guestId);
        const item = cart.items.find((it) => String(it._id) === String(itemId));
        if (!item)
            return res.status(404).json({ message: "Cart item not found" });
        item.isSelected = Boolean(isSelected);
        item.updatedAt = new Date();
        await cart.save();
        const enriched = await getEnrichedCartById(cart._id);
        return res.status(200).json({ message: "Selection updated", data: enriched || cart });
    }
    catch (err) {
        next(err);
    }
};
exports.setCartItemSelected = setCartItemSelected;
/**
 * PATCH /api/common/cart/select-all
 * body: { isSelected }
 */
const setCartSelectAll = async (req, res, next) => {
    try {
        const { ownerKey, userId, guestId } = getOwner(req, res);
        const { isSelected } = req.body;
        const cart = await getOrCreateCart(ownerKey, userId, guestId);
        for (const it of cart.items) {
            it.isSelected = Boolean(isSelected);
        }
        await cart.save();
        const enriched = await getEnrichedCartById(cart._id);
        return res.status(200).json({ message: "Selection updated", data: enriched || cart });
    }
    catch (err) {
        next(err);
    }
};
exports.setCartSelectAll = setCartSelectAll;
const updateCartItemOptions = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const { itemId, variantId = null, colorKey = null } = req.body;
        if (!mongoose_1.Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({ message: "Invalid itemId" });
        }
        const normalizedColor = normalizeColorKey(colorKey);
        const ownerKey = `u:${String(userId)}`;
        const cart = await Cart_model_1.Cart.findOne({ ownerKey });
        if (!cart) {
            return res.status(200).json({ message: "Cart empty", data: { items: [] } });
        }
        const current = cart.items.find((it) => String(it._id) === String(itemId));
        if (!current)
            return res.status(404).json({ message: "Cart item not found" });
        const product = await Product_model_1.Product.findById(current.productId)
            .select("isActive variants colors mrp salePrice baseStock stock quantity")
            .lean();
        if (!product || product.isActive === false) {
            return res.status(409).json({ message: "Product unavailable now" });
        }
        const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
        // ✅ validate color belongs to product.colors (optional)
        if (normalizedColor) {
            const ok = (product.colors || []).some((c) => {
                const nm = String(c?.name || "").trim().toLowerCase();
                return nm && nm === normalizedColor;
            });
            if (!ok)
                return res.status(400).json({ message: "Invalid color for this product" });
        }
        // ✅ resolve variant only if product has variants
        let newVariant = null;
        let nextVariantId = null;
        if (hasVariants) {
            if (!variantId || !mongoose_1.Types.ObjectId.isValid(variantId)) {
                return res.status(400).json({ message: "variantId is required and must be valid" });
            }
            newVariant = (product.variants || []).find((v) => String(v._id) === String(variantId));
            if (!newVariant) {
                return res.status(400).json({ message: "Variant not found for this product" });
            }
            nextVariantId = String(variantId);
        }
        else {
            // no variants => force null
            newVariant = null;
            nextVariantId = null;
        }
        const nextColorKey = normalizedColor; // may be null
        // ✅ Stock validate (variant > product)
        const available = hasVariants
            ? Number(newVariant?.quantity ?? newVariant?.stock ?? 0)
            : Number(product.baseStock ?? product.stock ?? product.quantity ?? 0);
        if (available <= 0) {
            return res.status(409).json({ message: hasVariants ? "Selected variant is out of stock" : "Product out of stock" });
        }
        if (Number(current.qty || 1) > available) {
            return res.status(409).json({
                message: "Current quantity exceeds available stock",
                available,
            });
        }
        // ✅ Price snapshot (variant > product)
        const mrpSnap = hasVariants ? Number(newVariant?.mrp || 0) : Number(product.mrp || 0);
        const saleSnap = hasVariants
            ? Number(newVariant?.salePrice || 0)
            : Number(product.salePrice || product.mrp || 0);
        // ✅ merge if same line exists
        const targetIdx = cart.items.findIndex((it) => {
            const sameProduct = String(it.productId) === String(current.productId);
            const sameVariant = String(it.variantId || "") === String(nextVariantId || "");
            const sameColor = String((it.colorKey || "").toLowerCase()) === String((nextColorKey || "").toLowerCase());
            return sameProduct && sameVariant && sameColor;
        });
        if (targetIdx > -1) {
            const target = cart.items[targetIdx];
            if (String(target._id) !== String(current._id)) {
                const mergedQty = Number(target.qty || 0) + Number(current.qty || 0);
                if (mergedQty > available) {
                    return res.status(409).json({
                        message: "Merged quantity exceeds available stock",
                        available,
                    });
                }
                target.qty = mergedQty;
                target.variantId = hasVariants ? new mongoose_1.Types.ObjectId(nextVariantId) : null;
                target.colorKey = nextColorKey;
                target.mrp = mrpSnap;
                target.salePrice = saleSnap;
                target.updatedAt = new Date();
                cart.items = cart.items.filter((it) => String(it._id) !== String(current._id));
            }
            else {
                current.variantId = hasVariants ? new mongoose_1.Types.ObjectId(nextVariantId) : null;
                current.colorKey = nextColorKey;
                current.mrp = mrpSnap;
                current.salePrice = saleSnap;
                current.updatedAt = new Date();
            }
        }
        else {
            current.variantId = hasVariants ? new mongoose_1.Types.ObjectId(nextVariantId) : null;
            current.colorKey = nextColorKey;
            current.mrp = mrpSnap;
            current.salePrice = saleSnap;
            current.updatedAt = new Date();
        }
        await cart.save();
        const enriched = await getEnrichedCartByOwnerKey(ownerKey);
        return res.status(200).json({ message: "Item options updated", data: enriched || cart });
    }
    catch (err) {
        next(err);
    }
};
exports.updateCartItemOptions = updateCartItemOptions;
/**
 * DELETE /api/common/cart/item/:itemId
 * remove single line item (guest allowed)
 */
const removeCartItem = async (req, res, next) => {
    try {
        const { ownerKey, userId, guestId } = getOwner(req, res);
        const { itemId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({ message: "Invalid itemId" });
        }
        const cart = await getOrCreateCart(ownerKey, userId, guestId);
        const before = cart.items.length;
        cart.items = cart.items.filter((it) => String(it._id) !== String(itemId));
        if (cart.items.length === before) {
            return res.status(404).json({ message: "Cart item not found" });
        }
        await cart.save();
        const enriched = await getEnrichedCartById(cart._id);
        return res.status(200).json({ message: "Item removed", data: enriched || cart });
    }
    catch (err) {
        next(err);
    }
};
exports.removeCartItem = removeCartItem;
/**
 * DELETE /api/common/cart/clear
 * clears all items (guest allowed)
 */
const clearCart = async (req, res, next) => {
    try {
        const { ownerKey, userId, guestId } = getOwner(req, res);
        const cart = await getOrCreateCart(ownerKey, userId, guestId);
        cart.items = [];
        await cart.save();
        const enriched = await getEnrichedCartById(cart._id);
        return res.status(200).json({ message: "Cart cleared", data: enriched || cart });
    }
    catch (err) {
        next(err);
    }
};
exports.clearCart = clearCart;
