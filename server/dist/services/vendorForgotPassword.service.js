"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVendorResetPasswordEmail = sendVendorResetPasswordEmail;
const crypto_1 = __importDefault(require("crypto"));
const Vendor_model_1 = require("../models/Vendor.model");
const sendEmail_1 = require("../utils/sendEmail");
async function sendVendorResetPasswordEmail(email) {
    const emailNorm = String(email).toLowerCase().trim();
    const vendor = await Vendor_model_1.Vendor.findOne({ email: emailNorm });
    // Security: don't reveal whether email exists
    if (!vendor)
        return;
    // raw token (send in email)
    const rawToken = crypto_1.default.randomBytes(32).toString("hex");
    // hash token (store in DB)
    const tokenHash = crypto_1.default.createHash("sha256").update(rawToken).digest("hex");
    vendor.resetPasswordTokenHash = tokenHash;
    vendor.resetPasswordTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await vendor.save();
    const baseUrl = process.env.VENDOR_RESET_PASSWORD_URL ||
        process.env.CLIENT_URL ||
        "http://localhost:3000";
    const resetLink = `${baseUrl}/supplier/reset-password?token=${rawToken}&email=${encodeURIComponent(emailNorm)}`;
    await (0, sendEmail_1.sendEmail)({
        to: vendor.email,
        subject: "Reset your Vendor Password",
        html: `
      <p>Hello ${vendor.name.first},</p>
      <p>We received a request to reset your vendor password.</p>
      <p>This link is valid for <b>15 minutes</b>.</p>
      <p><a href="${resetLink}">Reset Password</a></p>
      <p>If you didn’t request this, you can ignore this email.</p>
    `,
    });
}
