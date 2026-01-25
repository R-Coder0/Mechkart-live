import { Schema, model, Document } from "mongoose";

export type VendorStatus = "PENDING" | "APPROVED" | "REJECTED" | "DISABLED";

export interface IVendor extends Document {
  name: {
    first: string;
    last: string;
  };

  email: string;
  phone: string;
  passwordHash: string;

  kyc: {
    panNumber: string;
    panImage: string;
  };

  company: {
    name: string;
    email: string;
    gst?: string;
  };

  pickupAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };

  payment: {
    upiId?: string;
    bankAccount?: string;
    ifsc?: string;
    qrImage?: string;
  };

  status: VendorStatus;
  rejectReason?: string;

  // ✅ disable fields
  disabledAt?: Date;
  disabledReason?: string;

  isLoginEnabled: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const VendorSchema = new Schema<IVendor>(
  {
    name: {
      first: { type: String, required: true, trim: true },
      last: { type: String, required: true, trim: true },
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    kyc: {
      panNumber: { type: String, required: true, uppercase: true },
      panImage: { type: String, required: true },
    },

    company: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      gst: { type: String },
    },

    pickupAddress: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
    },

    payment: {
      upiId: { type: String },
      bankAccount: { type: String },
      ifsc: { type: String },
      qrImage: { type: String },
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "DISABLED"],
      default: "PENDING",
    },

    rejectReason: { type: String },

    // ✅ disable fields in schema
    disabledAt: { type: Date },
    disabledReason: { type: String },

    isLoginEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Vendor = model<IVendor>("Vendor", VendorSchema);
