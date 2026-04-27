"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOrderCode = generateOrderCode;
const OrderCounter_model_1 = require("../models/OrderCounter.model");
function pad(num, size = 4) {
    const s = String(num);
    return s.length >= size ? s : "0".repeat(size - s.length) + s;
}
async function generateOrderCode(prefix = "MECH") {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const key = `${prefix}-${yyyy}${mm}${dd}`; // MECH-20260118
    const counter = await OrderCounter_model_1.OrderCounter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { new: true, upsert: true }).lean();
    const seq = counter?.seq || 1;
    return `${key}-${pad(seq, 4)}`; // MECH-20260118-0001
}
