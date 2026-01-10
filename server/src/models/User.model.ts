import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IUserAddress {
  _id: Types.ObjectId;
  fullName: string;          // receiver name
  phone: string;             // receiver phone
  pincode: string;
  state: string;
  city: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUser extends Document {
  name: string;
  email: string;
  phone: string;
  password: string;

  emailVerified: boolean;
  role: "user";

  addresses: Types.DocumentArray<IUserAddress>;

  createdAt: Date;
  updatedAt: Date;
}

const UserAddressSchema = new Schema<IUserAddress>(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },

    pincode: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },

    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    landmark: { type: String, trim: true },

    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true, _id: true }
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: { type: String, required: true, trim: true, index: true },

    password: { type: String, required: true },

    emailVerified: { type: Boolean, default: false },

    role: { type: String, enum: ["user"], default: "user" },

    addresses: { type: [UserAddressSchema], default: [] },
  },
  { timestamps: true }
);

// ✅ Avoid duplicates
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ phone: 1 }, { unique: true });

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
