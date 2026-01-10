import mongoose, { Schema, Document, Model } from "mongoose";

export interface IVendor extends Document {
  shopName: string;
  email: string;
  password: string;
  createdAt: Date;
}

const vendorSchema = new Schema<IVendor>(
  {
    shopName: String,
    email: String,
    password: String,
  },
  { timestamps: true }
);

const Vendor: Model<IVendor> =
  mongoose.models.Vendor || mongoose.model<IVendor>("Vendor", vendorSchema);

export default Vendor;
