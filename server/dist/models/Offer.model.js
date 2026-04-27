"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Offer = void 0;
const mongoose_1 = require("mongoose");
const OfferSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    type: { type: String, enum: ["FLAT", "PERCENT"], required: true },
    value: { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number, min: 0 },
    scope: { type: String, enum: ["SITE", "CATEGORY", "SUBCATEGORY", "PRODUCT"], required: true },
    categoryIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "Category" }],
    subCategoryIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "Category" }],
    productIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "Product" }],
    mode: { type: String, enum: ["AUTO", "COUPON"], required: true },
    couponCode: { type: String, trim: true, uppercase: true },
    globalUsageLimit: { type: Number, min: 1 },
    globalUsedCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, min: 1 },
    firstOrderOnly: { type: Boolean, default: false },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    stackable: { type: Boolean, default: false },
    // your project uses Admin as createdBy in Product
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "Admin", default: null },
}, { timestamps: true });
// coupon code unique only if couponCode exists
OfferSchema.index({ couponCode: 1 }, { unique: true, partialFilterExpression: { couponCode: { $type: "string" } } });
// fast listing + fetch for active offers
OfferSchema.index({ isActive: 1, mode: 1, startsAt: 1, endsAt: 1, priority: -1 });
exports.Offer = (0, mongoose_1.model)("Offer", OfferSchema);
