"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cart = void 0;
const mongoose_1 = require("mongoose");
/* -------------------- Cart Item Schema -------------------- */
const CartItemSchema = new mongoose_1.Schema({
    productId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
        index: true,
    },
    // ✅ Snapshot public code
    productCode: {
        type: String,
        default: "",
        trim: true,
    },
    // OPTIONAL
    variantId: {
        type: mongoose_1.Schema.Types.ObjectId,
        default: null,
        index: true,
        // ref: "Variant", // optional: only if you have a Variant collection
    },
    colorKey: {
        type: String,
        default: null,
        trim: true,
        lowercase: true,
    },
    qty: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
    },
    isSelected: {
        type: Boolean,
        default: true, // ✅ CRITICAL
    },
    // snapshots
    title: { type: String, required: true, trim: true },
    image: { type: String, required: true, trim: true },
    mrp: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, required: true, min: 0 },
    addedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
}, { _id: true });
/* -------------------- Cart Schema -------------------- */
const CartSchema = new mongoose_1.Schema({
    ownerKey: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    guestId: {
        type: String,
        default: null,
        trim: true,
    },
    items: { type: [CartItemSchema], default: [] },
}, { timestamps: true });
/* -------------------- Hooks -------------------- */
CartSchema.pre("save", function (next) {
    try {
        const cart = this;
        const now = new Date();
        if (Array.isArray(cart.items)) {
            cart.items.forEach((it) => {
                // ensure dates
                if (!it.addedAt)
                    it.addedAt = now;
                it.updatedAt = now;
                // normalize colorKey
                if (typeof it.colorKey === "string") {
                    const ck = it.colorKey.trim().toLowerCase();
                    it.colorKey = ck.length ? ck : null;
                }
                // normalize productCode/title/image
                if (typeof it.productCode === "string")
                    it.productCode = it.productCode.trim();
                if (typeof it.isSelected !== "boolean") {
                    it.isSelected = true;
                }
                if (typeof it.title === "string")
                    it.title = it.title.trim();
                if (typeof it.image === "string")
                    it.image = it.image.trim();
            });
        }
        next();
    }
    catch (e) {
        next(e);
    }
});
exports.Cart = (0, mongoose_1.model)("Cart", CartSchema);
