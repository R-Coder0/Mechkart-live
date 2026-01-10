"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Product = void 0;
const mongoose_1 = require("mongoose");
// -------------------- SCHEMAS --------------------
const ColorSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    hex: { type: String, default: "" },
    images: { type: [String], default: [] },
    orderIndex: { type: Number, default: 0 },
}, { _id: true });
const VariantSchema = new mongoose_1.Schema({
    label: { type: String },
    weight: { type: String },
    size: { type: String },
    // keep comboText (variant identity)
    comboText: { type: String },
    // keep color only for backward compatibility
    color: { type: String },
    quantity: { type: Number, required: true, default: 0 },
    mrp: { type: Number, required: true },
    salePrice: { type: Number, required: true },
    images: { type: [String], default: [] },
}, { _id: true });
const ProductSchema = new mongoose_1.Schema({
    productId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
    },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String },
    features: { type: String, default: "" },
    featureImage: { type: String },
    galleryImages: { type: [String], default: [] },
    // ✅ NEW: colors array on product
    colors: { type: [ColorSchema], default: [] },
    mrp: { type: Number, required: true },
    salePrice: { type: Number, required: true },
    baseStock: { type: Number, default: 0 },
    totalStock: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    isLowStock: { type: Boolean, default: false },
    variants: { type: [VariantSchema], default: [] },
    category: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Category",
        required: true,
    },
    subCategory: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Category",
        default: null,
    },
    isActive: { type: Boolean, default: true },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Admin",
        default: null,
    },
}, { timestamps: true });
/**
 * Helper inside model:
 * totalStock = variants sum (if variants exist) else baseStock
 * isLowStock = totalStock <= lowStockThreshold
 */
const computeStock = (doc) => {
    const variantsArr = Array.isArray(doc.variants) ? doc.variants : [];
    const hasVariants = variantsArr.length > 0;
    if (hasVariants) {
        doc.baseStock = 0;
        doc.totalStock = variantsArr.reduce((sum, v) => sum + Number(v.quantity || 0), 0);
    }
    else {
        doc.totalStock = Number(doc.baseStock || 0);
    }
    const threshold = Number(doc.lowStockThreshold ?? 5);
    doc.isLowStock = doc.totalStock <= threshold;
};
/**
 * Auto-generate productId = MECH000001, MECH000002, ...
 */
ProductSchema.pre("validate", async function (next) {
    try {
        if (this.isNew && !this.productId) {
            const last = await this.constructor
                .findOne({}, { productId: 1 })
                .sort({ createdAt: -1 })
                .lean();
            let nextNumber = 1;
            if (last?.productId) {
                const numericPart = last.productId.replace(/^CH/, "");
                const parsed = parseInt(numericPart, 10);
                if (!Number.isNaN(parsed))
                    nextNumber = parsed + 1;
            }
            this.productId = `CH${String(nextNumber).padStart(6, "0")}`;
        }
        // ✅ compute stock on validate as well (safe)
        computeStock(this);
        next();
    }
    catch (e) {
        next(e);
    }
});
ProductSchema.pre("findOneAndUpdate", function (next) {
    try {
        return next();
    }
    catch (err) {
        return next(err);
    }
});
exports.Product = (0, mongoose_1.model)("Product", ProductSchema);
