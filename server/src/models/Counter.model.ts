import { Schema, model } from "mongoose";

interface ICounter {
  name: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    name: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Counter = model<ICounter>("Counter", CounterSchema);
