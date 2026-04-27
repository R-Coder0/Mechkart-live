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
exports.VendorWallet = void 0;
// src/models/VendorWallet.model.ts
const mongoose_1 = __importStar(require("mongoose"));
const WalletTxnSchema = new mongoose_1.Schema({
    vendorId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    orderId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    subOrderId: { type: mongoose_1.Schema.Types.ObjectId, default: null, index: true },
    orderCode: { type: String, default: "" },
    type: {
        type: String,
        enum: [
            "DELIVERED_HOLD_CREDIT",
            "CANCEL_DEDUCT",
            "RETURN_DEDUCT",
            "HOLD_TO_AVAILABLE",
            "PAYOUT_RELEASED",
            "PAYOUT_FAILED",
            "ADJUSTMENT",
        ],
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ["HOLD", "AVAILABLE", "PAID", "REVERSED", "FAILED"],
        default: "HOLD",
        index: true,
    },
    amount: { type: Number, required: true },
    direction: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
    currency: { type: String, default: "INR" },
    effectiveAt: { type: Date, default: Date.now, index: true },
    unlockAt: { type: Date, default: null, index: true },
    idempotencyKey: { type: String, required: true, index: true },
    note: { type: String, default: "" },
    meta: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { _id: true, timestamps: true });
const VendorWalletSchema = new mongoose_1.Schema({
    vendorId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Vendor",
        required: true,
        unique: true,
        index: true,
    },
    balances: {
        hold: { type: Number, default: 0 },
        available: { type: Number, default: 0 },
        paid: { type: Number, default: 0 },
        deduction: { type: Number, default: 0 },
    },
    stats: {
        totalCredits: { type: Number, default: 0 },
        totalDebits: { type: Number, default: 0 },
        lastTxnAt: { type: Date, default: null },
    },
    transactions: { type: [WalletTxnSchema], default: [] },
}, { timestamps: true });
VendorWalletSchema.index({ vendorId: 1 });
VendorWalletSchema.index({ "transactions.idempotencyKey": 1 }, { unique: true, sparse: true });
VendorWalletSchema.index({ "transactions.orderId": 1 });
VendorWalletSchema.index({ "transactions.subOrderId": 1 });
VendorWalletSchema.index({ "transactions.unlockAt": 1 });
VendorWalletSchema.index({ "transactions.status": 1 });
exports.VendorWallet = mongoose_1.default.models.VendorWallet ||
    mongoose_1.default.model("VendorWallet", VendorWalletSchema);
