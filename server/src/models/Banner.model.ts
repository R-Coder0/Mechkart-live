import { Schema, model, Document } from "mongoose";

export interface IBanner extends Document {
  key: string;              // e.g. "home-hero"
  image: string;            // stored as "/uploads/xxx.webp"
  ctaUrl: string;           // e.g. "/products" OR full URL
  isActive: boolean;
}

const BannerSchema = new Schema<IBanner>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    image: { type: String, required: true, trim: true },
    ctaUrl: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Banner = model<IBanner>("Banner", BannerSchema);
