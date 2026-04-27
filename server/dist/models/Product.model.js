"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Product = void 0;
const mongoose_1 = require("mongoose");
const Counter_model_1 = require("./Counter.model"); // ✅ ADD THIS
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
    comboText: { type: String },
    // keep color only for backward compatibility
    color: { type: String },
    quantity: { type: Number, required: true, default: 0 },
    mrp: { type: Number, required: true },
    salePrice: { type: Number, required: true },
    images: { type: [String], default: [] },
}, { _id: true });
const ShipSchema = new mongoose_1.Schema({
    lengthCm: { type: Number, default: 20 },
    breadthCm: { type: Number, default: 15 },
    heightCm: { type: Number, default: 10 },
    weightKg: { type: Number, default: 0.5 },
}, { _id: false });
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
    // ✅ colors array on product
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
    // ✅ multivendor fields
    ownerType: {
        type: String,
        enum: ["ADMIN", "VENDOR"],
        default: "ADMIN",
        index: true,
    },
    vendorId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Vendor",
        default: null,
        index: true,
    },
    approvalStatus: {
        type: String,
        enum: ["PENDING", "APPROVED", "REJECTED"],
        default: "APPROVED", // ✅ admin-created products auto approved
        index: true,
    },
    approvalNote: { type: String, default: "" },
    // ✅ shipment defaults
    ship: { type: ShipSchema, default: () => ({}) },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Admin",
        default: null,
    },
}, { timestamps: true });
/**
 * Helper:
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
 * ✅ Auto-generate productId safely using Counter (atomic)
 */
ProductSchema.pre("validate", async function (next) {
    try {
        // ✅ productId generation (atomic, race-condition safe)
        if (this.isNew && !this.productId) {
            const PREFIX = "MECH";
            const counter = await Counter_model_1.Counter.findOneAndUpdate({ name: "productId" }, { $inc: { seq: 1 } }, { new: true, upsert: true }).lean();
            const nextNumber = counter?.seq ?? 1;
            this.productId = `${PREFIX}${String(nextNumber).padStart(6, "0")}`;
        }
        // ✅ ship defaults normalize
        if (!this.ship) {
            this.ship = { lengthCm: 20, breadthCm: 15, heightCm: 10, weightKg: 0.5 };
        }
        else {
            this.ship.lengthCm = Number(this.ship.lengthCm ?? 20);
            this.ship.breadthCm = Number(this.ship.breadthCm ?? 15);
            this.ship.heightCm = Number(this.ship.heightCm ?? 10);
            this.ship.weightKg = Number(this.ship.weightKg ?? 0.5);
        }
        computeStock(this);
        next();
    }
    catch (e) {
        next(e);
    }
});
exports.Product = (0, mongoose_1.model)("Product", ProductSchema);
