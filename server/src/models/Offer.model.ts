import { Schema, model, Types } from "mongoose";

export type OfferType = "FLAT" | "PERCENT";
export type OfferScope = "SITE" | "CATEGORY" | "SUBCATEGORY" | "PRODUCT";
export type OfferMode = "AUTO" | "COUPON";

export interface IOffer {
  name: string;
  description?: string;

  type: OfferType;     // FLAT | PERCENT
  value: number;       // 500 or 20 etc
  maxDiscountAmount?: number; // optional cap for PERCENT (recommended)

  scope: OfferScope;   // SITE | CATEGORY | SUBCATEGORY | PRODUCT
  categoryIds?: Types.ObjectId[];
  subCategoryIds?: Types.ObjectId[];
  productIds?: Types.ObjectId[];

  mode: OfferMode;     // AUTO (direct apply) | COUPON
  couponCode?: string; // required when mode=COUPON

  // usage
  globalUsageLimit?: number;  // optional total limit
  globalUsedCount: number;    // increments when applied successfully

  perUserLimit?: number;      // 1=once per user, N=N times per user
  firstOrderOnly: boolean;

  // validity
  startsAt: Date;
  endsAt: Date;

  // admin controls
  isActive: boolean;
  priority: number;           // AUTO offer selection
  stackable: boolean;         // keep false for now

  createdBy?: Types.ObjectId | null;
}

const OfferSchema = new Schema<IOffer>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    type: { type: String, enum: ["FLAT", "PERCENT"], required: true },
    value: { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number, min: 0 },

    scope: { type: String, enum: ["SITE", "CATEGORY", "SUBCATEGORY", "PRODUCT"], required: true },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    subCategoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    productIds: [{ type: Schema.Types.ObjectId, ref: "Product" }],

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
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
);

// coupon code unique only if couponCode exists
OfferSchema.index(
  { couponCode: 1 },
  { unique: true, partialFilterExpression: { couponCode: { $type: "string" } } }
);

// fast listing + fetch for active offers
OfferSchema.index({ isActive: 1, mode: 1, startsAt: 1, endsAt: 1, priority: -1 });

export const Offer = model<IOffer>("Offer", OfferSchema);
