import mongoose, { Schema, Model, Document } from "mongoose";

export interface IOrderCounter extends Document {
  key: string;     // e.g. "ORDER-YYYYMMDD"
  seq: number;     // incrementing number
}

const OrderCounterSchema = new Schema<IOrderCounter>(
  {
    key: { type: String, required: true, unique: true, index: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export const OrderCounter: Model<IOrderCounter> =
  mongoose.models.OrderCounter || mongoose.model<IOrderCounter>("OrderCounter", OrderCounterSchema);
