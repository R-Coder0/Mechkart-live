import { OrderCounter } from "../models/OrderCounter.model";

function pad(num: number, size = 4) {
  const s = String(num);
  return s.length >= size ? s : "0".repeat(size - s.length) + s;
}

export async function generateOrderCode(prefix = "CH") {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  const key = `${prefix}-${yyyy}${mm}${dd}`; // CH-20260118

  const counter = await OrderCounter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  ).lean();

  const seq = counter?.seq || 1;
  return `${key}-${pad(seq, 4)}`; // CH-20260118-0001
}
