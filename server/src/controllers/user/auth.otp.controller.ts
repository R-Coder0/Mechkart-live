import bcrypt from "bcrypt";
import { Request, Response } from "express";
import { User } from "../../models/User.model";
import { EmailOtp } from "../../models/EmailOtp.model";
import { sendOtpEmail } from "../../utils/mailer";

function normalizeEmail(email: any) {
  return String(email || "").trim().toLowerCase();
}

function generateOtp() {
  // 6 digit numeric
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Dev-friendly error serializer (so JSON.stringify won't break)
function serializeError(err: any) {
  return {
    name: err?.name,
    message: err?.message,
    code: err?.code,
    stack: err?.stack,
    // nodemailer / axios style extra fields (if any)
    response: err?.response,
    responseCode: err?.responseCode,
    command: err?.command,
  };
}

function isProdEnv() {
  return process.env.NODE_ENV === "production";
}

export const sendSignupOtp = async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ message: "Email is required" });

    // If user already exists and verified => block OTP signup
    const existing = await User.findOne({ email });
    if (existing?.emailVerified) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Invalidate previous OTP for same email
    await EmailOtp.deleteMany({ email, purpose: "signup" });

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // ✅ 10 minutes

    await EmailOtp.create({
      email,
      otpHash,
      purpose: "signup",
      expiresAt,
      attempts: 0,
      verified: false,
    });

    // Isko separate try/catch me rakha hai taaki pata chale exactly mailer me error aa raha ya DB me
    try {
      await sendOtpEmail(email, otp);
    } catch (mailErr: any) {
      console.error("sendOtpEmail error:", mailErr);
      return res.status(500).json({
        message: "Failed to send OTP",
        ...(isProdEnv()
          ? {}
          : {
              error: serializeError(mailErr),
            }),
      });
    }

    return res.json({ message: "OTP sent to email" });
  } catch (err: any) {
    console.error("sendSignupOtp error:", err);
    return res.status(500).json({
      message: "Failed to send OTP",
      ...(isProdEnv()
        ? {}
        : {
            error: serializeError(err),
          }),
    });
  }
};

export const verifySignupOtp = async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const rec = await EmailOtp.findOne({ email, purpose: "signup" }).sort({
      createdAt: -1,
    });

    if (!rec) {
      return res.status(400).json({ message: "OTP not found. Please request again." });
    }

    if (rec.verified) return res.json({ message: "OTP already verified" });

    // Expiry check (TTL index will also cleanup but still check)
    if (new Date(rec.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP expired. Please request again." });
    }

    // attempts limit
    if (rec.attempts >= 5) {
      return res.status(429).json({ message: "Too many attempts. Request a new OTP." });
    }

    const ok = await bcrypt.compare(otp, rec.otpHash);
    if (!ok) {
      rec.attempts += 1;
      await rec.save();
      return res.status(400).json({ message: "Invalid OTP" });
    }

    rec.verified = true;
    await rec.save();

    return res.json({ message: "OTP verified" });
  } catch (err: any) {
    console.error("verifySignupOtp error:", err);
    return res.status(500).json({
      message: "OTP verification failed",
      ...(isProdEnv()
        ? {}
        : {
            error: serializeError(err),
          }),
    });
  }
};
