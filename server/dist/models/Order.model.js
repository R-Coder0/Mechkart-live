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
    variantText: { type: String, default: null, trim: true },
    colorKey: { type: String, default: null, trim: true },
    qty: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, trim: true },
    image: { type: String, default: null, trim: true },
    mrp: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, required: true, min: 0 },
    ownerType: { type: String, enum: ["ADMIN", "VENDOR"], default: "ADMIN" },
    vendorId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Vendor", default: null },
    soldBy: { type: String, default: null, trim: true },
    ship: {
        type: {
            lengthCm: { type: Number, default: null },
            breadthCm: { type: Number, default: null },
            heightCm: { type: Number, default: null },
            weightKg: { type: Number, default: null },
        },
        default: null,
    },
    offerDiscount: { type: Number, default: 0, min: 0 },
    finalLineTotal: { type: Number, default: 0, min: 0 },
}, { _id: false });
const ShipmentItemRefSchema = new mongoose_1.Schema({
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Product", required: true },
    qty: { type: Number, required: true, min: 1 },
    variantId: { type: mongoose_1.Schema.Types.ObjectId, default: null },
    colorKey: { type: String, default: null, trim: true },
}, { _id: false });
const OrderShipmentSchema = new mongoose_1.Schema({
    provider: {
        type: String,
        enum: ["SHIPROCKET"],
        required: true,
        default: "SHIPROCKET",
    },
    vendorId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Vendor", default: null },
    items: { type: [ShipmentItemRefSchema], default: [] },
    pickup: {
        type: {
            name: { type: String, trim: true },
            phone: { type: String, trim: true },
            pincode: { type: String, trim: true },
            state: { type: String, trim: true },
            city: { type: String, trim: true },
            addressLine1: { type: String, trim: true },
            addressLine2: { type: String, trim: true },
        },
        default: null,
    },
    shiprocket: {
        type: {
            orderId: { type: String, default: null, trim: true },
            shipmentId: { type: Number, default: null },
            awb: { type: String, default: null, trim: true },
            courierName: { type: String, default: null, trim: true },
            courierCompanyId: { type: Number, default: null },
            labelUrl: { type: String, default: null, trim: true },
            manifestUrl: { type: String, default: null, trim: true },
            invoiceUrl: { type: String, default: null, trim: true },
            pickupScheduledAt: { type: Date, default: null },
            tracking: { type: mongoose_1.Schema.Types.Mixed, default: null },
            raw: { type: mongoose_1.Schema.Types.Mixed, default: null },
        },
        default: null,
    },
    status: {
        type: String,
        enum: [
            "CREATED",
            "AWB_ASSIGNED",
            "PICKUP_SCHEDULED",
            "IN_TRANSIT",
            "DELIVERED",
            "CANCELLED",
        ],
        default: "CREATED",
    },
}, { timestamps: true });
/** ✅ Bank details schema for COD returns */
const ReturnBankDetailsSchema = new mongoose_1.Schema({
    accountHolderName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    ifsc: { type: String, required: true, trim: true },
    bankName: { type: String, default: null, trim: true },
    upiId: { type: String, default: null, trim: true },
}, { _id: false });
/* =========================
 * SubOrder Return/Refund Schemas (V2)
 * (✅ MUST be before SubOrderSchema)
 * ========================= */
const SubOrderReturnItemSchema = new mongoose_1.Schema({
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Product", required: true },
    qty: { type: Number, required: true, min: 1 },
    variantId: { type: mongoose_1.Schema.Types.ObjectId, default: null },
    colorKey: { type: String, default: null, trim: true },
    reason: { type: String, default: null, trim: true },
    note: { type: String, default: null, trim: true },
    images: { type: [String], default: [] },
}, { _id: false });
const SubOrderReturnSchema = new mongoose_1.Schema({
    requestedAt: { type: Date, default: Date.now },
    reason: { type: String, required: true, trim: true },
    note: { type: String, default: null, trim: true },
    images: {
        type: [String],
        default: [],
        validate: {
            validator: function (arr) {
                if (!Array.isArray(arr))
                    return true;
                return arr.length <= 5;
            },
            message: "You can upload up to 5 images only.",
        },
    },
    bankDetails: { type: ReturnBankDetailsSchema, default: null },
    items: { type: [SubOrderReturnItemSchema], required: true, default: [] },
    status: {
        type: String,
        enum: [
            "REQUESTED",
            "APPROVED",
            "REJECTED",
            "PICKUP_CREATED",
            "RECEIVED",
            "REFUNDED",
        ],
        default: "REQUESTED",
    },
    handledByRole: { type: String, enum: ["ADMIN", "VENDOR"], default: null },
    handledById: { type: mongoose_1.Schema.Types.ObjectId, default: null },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    rejectReason: { type: String, default: null, trim: true },
    receivedAt: { type: Date, default: null },
    returnShipment: { type: OrderShipmentSchema, default: null },
}, { _id: true });
const SubOrderRefundSchema = new mongoose_1.Schema({
    method: { type: String, enum: ["COD", "ONLINE"], required: true },
    amount: { type: Number, required: true, min: 0 },
    status: {
        type: String,
        enum: ["PENDING", "PROCESSED", "FAILED"],
        default: "PENDING",
    },
    provider: { type: String, enum: ["RAZORPAY", "MANUAL"], default: null },
    reference: { type: String, default: null, trim: true },
    processedAt: { type: Date, default: null },
    processedByAdminId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Admin", default: null },
    raw: { type: mongoose_1.Schema.Types.Mixed, default: null },
}, { _id: false });
/* =========================
 * SubOrder schema (NEW)
 * ========================= */
const SubOrderSchema = new mongoose_1.Schema({
    ownerType: { type: String, enum: ["ADMIN", "VENDOR"], required: true },
    vendorId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Vendor", default: null },
    vendorName: { type: String, default: null, trim: true },
    soldBy: { type: String, required: true, trim: true },
    items: { type: [OrderItemSchema], default: [] },
    subtotal: { type: Number, required: true, default: 0 },
    shipping: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, default: 0 },
    status: {
        type: String,
        enum: ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
        default: "PLACED",
    },
    shipment: { type: OrderShipmentSchema, default: null },
    // ✅ now works because schema is already defined
    returns: { type: [SubOrderReturnSchema], default: [] },
    refund: { type: SubOrderRefundSchema, default: null },
}, { timestamps: true, _id: true });
/* =========================
 * Legacy Order Return/Refund Schemas
 * ========================= */
const OrderReturnSchema = new mongoose_1.Schema({
    requestedAt: { type: Date, default: Date.now },
    reason: { type: String, required: true, trim: true },
    note: { type: String, default: null, trim: true },
    images: {
        type: [String],
        default: [],
        validate: {
            validator: function (arr) {
                if (!Array.isArray(arr))
                    return true;
                return arr.length <= 5;
            },
            message: "You can upload up to 5 images only.",
        },
    },
    bankDetails: { type: ReturnBankDetailsSchema, default: null },
    items: {
        type: [
            {
                productId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Product", required: true },
                qty: { type: Number, required: true, min: 1 },
                variantId: { type: mongoose_1.Schema.Types.ObjectId, default: null },
                colorKey: { type: String, default: null, trim: true },
            },
        ],
        default: undefined,
    },
    status: {
        type: String,
        enum: [
            "REQUESTED",
            "APPROVED",
            "REJECTED",
            "PICKUP_CREATED",
            "RECEIVED",
            "REFUNDED",
        ],
        default: "REQUESTED",
    },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "Admin", default: null },
    rejectedAt: { type: Date, default: null },
    rejectReason: { type: String, default: null, trim: true },
    returnShipment: { type: OrderShipmentSchema, default: null },
}, { _id: false });
const OrderRefundSchema = new mongoose_1.Schema({
    method: { type: String, enum: ["COD", "ONLINE"], required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["PENDING", "PROCESSED", "FAILED"], default: "PENDING" },
    provider: { type: String, enum: ["RAZORPAY", "MANUAL"], default: null },
    refundId: { type: String, default: null, trim: true },
    processedAt: { type: Date, default: null },
    raw: { type: mongoose_1.Schema.Types.Mixed, default: null },
}, { _id: false });
const OrderSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderCode: { type: String, required: true, unique: true, index: true, trim: true },
    parentOrderId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    items: { type: [OrderItemSchema], required: true, default: [] },
    subOrders: { type: [SubOrderSchema], default: [] },
    totals: {
        type: {
            subtotal: { type: Number, required: true, default: 0 },
            mrpTotal: { type: Number, required: true, default: 0 },
            savings: { type: Number, required: true, default: 0 },
            discount: { type: Number, required: true, default: 0 },
            grandTotal: { type: Number, required: true, default: 0 },
        },
        required: true,
    },
    appliedOffer: { type: mongoose_1.Schema.Types.Mixed, default: null },
    contact: {
        type: {
            name: { type: String, required: true, trim: true },
            phone: { type: String, required: true, trim: true },
            email: { type: String, default: null, trim: true },
        },
        required: true,
    },
    address: {
        type: {
            fullName: { type: String, required: true, trim: true },
            phone: { type: String, required: true, trim: true },
            pincode: { type: String, required: true, trim: true },
            state: { type: String, required: true, trim: true },
            city: { type: String, required: true, trim: true },
            addressLine1: { type: String, required: true, trim: true },
            addressLine2: { type: String, default: null, trim: true },
            landmark: { type: String, default: null, trim: true },
        },
        required: true,
    },
    paymentMethod: { type: String, enum: ["COD", "ONLINE"], required: true },
    paymentStatus: {
        type: String,
        enum: ["PENDING", "PAID", "FAILED", "COD_PENDING_CONFIRMATION"],
        default: "PENDING",
    },
    status: {
        type: String,
        enum: ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
        default: "PLACED",
    },
    pg: { type: mongoose_1.Schema.Types.Mixed, default: null },
    cod: { type: mongoose_1.Schema.Types.Mixed, default: null },
    shipments: { type: [OrderShipmentSchema], default: [] },
    return: { type: OrderReturnSchema, default: null },
    refund: { type: OrderRefundSchema, default: null },
}, { timestamps: true });
exports.Order = mongoose_1.default.models.Order || mongoose_1.default.model("Order", OrderSchema);
