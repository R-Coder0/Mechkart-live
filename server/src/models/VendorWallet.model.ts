// src/models/VendorWallet.model.ts
import mongoose, { Schema, type Model, type HydratedDocument } from "mongoose";

export type WalletTxnType =
  | "DELIVERED_HOLD_CREDIT"
  | "CANCEL_DEDUCT"
  | "RETURN_DEDUCT"
  | "HOLD_TO_AVAILABLE"
  | "PAYOUT_RELEASED"
  | "PAYOUT_FAILED"
  | "ADJUSTMENT";

export type WalletTxnStatus = "HOLD" | "AVAILABLE" | "PAID" | "REVERSED" | "FAILED";

// ----- Schemas (same as yours) -----
const WalletTxnSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    subOrderId: { type: Schema.Types.ObjectId, default: null, index: true },
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
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: true, timestamps: true }
);

const VendorWalletSchema = new Schema(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      unique: true,
      index: true,
    },

    balances: {
      hold: { type: Number, default: 0 },
      available: { type: Number, default: 0 },
      paid: { type: Number, default: 0 },
    },

    stats: {
      totalCredits: { type: Number, default: 0 },
      totalDebits: { type: Number, default: 0 },
      lastTxnAt: { type: Date, default: null },
    },

    transactions: { type: [WalletTxnSchema], default: [] },
  },
  { timestamps: true }
);

VendorWalletSchema.index({ vendorId: 1 });
VendorWalletSchema.index({ "transactions.idempotencyKey": 1 }, { unique: true, sparse: true });
VendorWalletSchema.index({ "transactions.orderId": 1 });
VendorWalletSchema.index({ "transactions.subOrderId": 1 });
VendorWalletSchema.index({ "transactions.unlockAt": 1 });
VendorWalletSchema.index({ "transactions.status": 1 });

// ----- Types (important) -----
export type VendorWalletShape = {
  vendorId: mongoose.Types.ObjectId;
  balances: { hold: number; available: number; paid: number };
  stats: { totalCredits: number; totalDebits: number; lastTxnAt: Date | null };
  transactions: any[];
};

export type VendorWalletDoc = HydratedDocument<VendorWalletShape>;

// ✅ KEY FIX: force a single Model type (no union)
export const VendorWallet: Model<VendorWalletDoc> =
  (mongoose.models.VendorWallet as Model<VendorWalletDoc>) ||
  mongoose.model<VendorWalletDoc>("VendorWallet", VendorWalletSchema);
