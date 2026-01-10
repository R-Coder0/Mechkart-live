"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Order = void 0;
const mongoose_1 = __importStar(require("mongoose"));
/* =========================
 * Schemas
 * ========================= */
const OrderItemSchema = new mongoose_1.Schema({
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Product", required: true },
    productCode: { type: String, required: true, trim: true },
    variantId: { type: mongoose_1.Schema.Types.ObjectId, default: null },
    colorKey: { type: String, default: null },
    qty: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, trim: true },
    image: { type: String, default: null },
    mrp: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, required: true, min: 0 },
}, { _id: false });
const OrderSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    /** ✅ New */
    orderCode: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
    },
    /** ✅ New (null = parent order) */
    parentOrderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Order",
        default: null,
        index: true,
    },
    items: {
        type: [OrderItemSchema],
        required: true,
    },
    totals: {
        subtotal: { type: Number, required: true },
        mrpTotal: { type: Number, required: true },
        savings: { type: Number, required: true },
    },
    contact: {
        name: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        email: { type: String, trim: true },
    },
    address: {
        fullName: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        pincode: { type: String, required: true, trim: true },
        state: { type: String, required: true, trim: true },
        city: { type: String, required: true, trim: true },
        addressLine1: { type: String, required: true, trim: true },
        addressLine2: { type: String, trim: true },
        landmark: { type: String, trim: true },
    },
    paymentMethod: {
        type: String,
        enum: ["COD", "ONLINE"],
        required: true,
    },
    paymentStatus: {
        type: String,
        enum: ["PENDING", "PAID", "FAILED"],
        default: "PENDING",
    },
    status: {
        type: String,
        enum: ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
        default: "PLACED",
    },
}, { timestamps: true });
exports.Order = mongoose_1.default.models.Order || mongoose_1.default.model("Order", OrderSchema);
