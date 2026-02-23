import crypto from "crypto";
import { Vendor } from "../models/Vendor.model";
import { sendEmail } from "../utils/sendEmail";

export async function sendVendorResetPasswordEmail(email: string) {
  const emailNorm = String(email).toLowerCase().trim();

  const vendor = await Vendor.findOne({ email: emailNorm });
  // Security: don't reveal whether email exists
  if (!vendor) return;

  // raw token (send in email)
  const rawToken = crypto.randomBytes(32).toString("hex");

  // hash token (store in DB)
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  vendor.resetPasswordTokenHash = tokenHash;
  vendor.resetPasswordTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min
  await vendor.save();

  const baseUrl =
    process.env.VENDOR_RESET_PASSWORD_URL ||
    process.env.CLIENT_URL ||
    "http://localhost:3000";

  const resetLink = `${baseUrl}/supplier/reset-password?token=${rawToken}&email=${encodeURIComponent(
    emailNorm
  )}`;

  await sendEmail({
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