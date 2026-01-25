import mongoose, { Schema, Document } from "mongoose";

export interface IOrderCounter extends Document {
  key: string;   // e.g. MECH-20260118
  seq: number;   // 1,2,3...
}

const OrderCounterSchema = new Schema<IOrderCounter>(
  {
    key: { type: String, required: true, unique: true, index: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export const OrderCounter = mongoose.model<IOrderCounter>("OrderCounter", OrderCounterSchema);
