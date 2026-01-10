import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEmailOtp extends Document {
  email: string;
  otpHash: string;
  purpose: "signup";
  expiresAt: Date;
  attempts: number;
  verified: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const EmailOtpSchema = new Schema<IEmailOtp>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    otpHash: { type: String, required: true },
    purpose: { type: String, enum: ["signup"], default: "signup" },

    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },

    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ✅ auto delete after expiresAt
EmailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Optional: keep only latest OTP for email+purpose
EmailOtpSchema.index({ email: 1, purpose: 1 });

export const EmailOtp: Model<IEmailOtp> =
  mongoose.models.EmailOtp || mongoose.model<IEmailOtp>("EmailOtp", EmailOtpSchema);
