import mongoose, { Schema, Types, Document, Model } from "mongoose";

export interface IOfferRedemption extends Document {
  offerId: Types.ObjectId;
  userId: Types.ObjectId;
  orderId: Types.ObjectId;

  couponCode?: string | null;

  discountAmount: number;
  redeemedAt: Date;
}

const OfferRedemptionSchema = new Schema<IOfferRedemption>(
  {
    offerId: { type: Schema.Types.ObjectId, ref: "Offer", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },

    couponCode: { type: String, default: null, trim: true, uppercase: true },

    discountAmount: { type: Number, required: true, min: 0, default: 0 },
    redeemedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// to prevent same order logging twice
OfferRedemptionSchema.index({ orderId: 1 }, { unique: true });

// fast checks
OfferRedemptionSchema.index({ offerId: 1, userId: 1 });

export const OfferRedemption: Model<IOfferRedemption> =
  mongoose.models.OfferRedemption || mongoose.model<IOfferRedemption>("OfferRedemption", OfferRedemptionSchema);
