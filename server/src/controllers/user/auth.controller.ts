import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { Types } from "mongoose";

import { User } from "../../models/User.model";
import { EmailOtp } from "../../models/EmailOtp.model";
import { Cart } from "../../models/Cart.model";

const JWT_EXPIRES_IN = "7h"; // ✅ as you want
const COOKIE_MAX_AGE_MS = 7 * 60 * 60 * 1000; // ✅ 7 hours

const toInt = (v: any, def: number) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.floor(n);
};
function getCookieOptions(req: Request) {
  const isProd = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    // domain: isProd ? ".countryhome.co.in" : undefined,
    path: "/",
    maxAge: COOKIE_MAX_AGE_MS,
  };
}

function signToken(payload: { id: string; role: "user" }) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET missing");
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function toObjectId(id: string) {
  // throw if invalid (better than saving bad data)
  if (!Types.ObjectId.isValid(id)) throw new Error("Invalid userId");
  return new Types.ObjectId(id);
}

async function mergeGuestCartToUser(req: Request, userId: string) {
  const guestId = (req as any).cookies?.guestId; // cookie-parser required
  if (!guestId) return;

  const userObjectId = toObjectId(userId);

  const guestCart = await Cart.findOne({ guestId });
  if (!guestCart || !guestCart.items?.length) return;

  let userCart = await Cart.findOne({ userId: userObjectId });

  // ✅ if user has no cart, move guest cart to user
  if (!userCart) {
    guestCart.userId = userObjectId; // ✅ FIX: ObjectId
    guestCart.guestId = undefined;
    await guestCart.save();
    return;
  }

  // ✅ merge item-by-item
  const key = (it: any) =>
    `${String(it.productId)}|${String(it.variantId || "")}|${String(it.colorKey || "")}`;

  const map = new Map<string, any>();
  for (const it of userCart.items || []) map.set(key(it), it);

  for (const it of guestCart.items || []) {
    const k = key(it);
    if (map.has(k)) {
      const existing = map.get(k);
      existing.qty = Number(existing.qty || 0) + Number(it.qty || 0);
    } else {
      userCart.items.push(it);
    }
  }

  await userCart.save();
  await Cart.deleteOne({ _id: guestCart._id });
}

export const registerUserAfterOtp = async (req: Request, res: Response) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();

    const password = String(req.body.password || "");
    const confirmPassword = String(req.body.confirmPassword || "");

    if (!name || !email || !phone) {
      return res.status(400).json({ message: "Name, email and phone are required" });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // ✅ OTP must be verified
    const otp = await EmailOtp.findOne({ email, purpose: "signup" }).sort({ createdAt: -1 });
    if (!otp || !otp.verified) {
      return res.status(400).json({ message: "Please verify OTP first" });
    }

    // ✅ create or update user
    const exists = await User.findOne({ $or: [{ email }, { phone }] });

    if (exists && exists.emailVerified) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    let userDoc;
    if (!exists) {
      userDoc = await User.create({
        name,
        email,
        phone,
        password: hashed,
        emailVerified: true,
        role: "user",
      });
    } else {
      exists.name = name;
      exists.phone = phone;
      exists.password = hashed;
      exists.emailVerified = true;
      userDoc = await exists.save();
    }

    // ✅ cleanup OTP
    await EmailOtp.deleteMany({ email, purpose: "signup" });

    // ✅ set cookie token (7h)
    const token = signToken({ id: String(userDoc._id), role: "user" });
    res.cookie("user_token", token, getCookieOptions(req));

    // ✅ merge guest cart into user cart
    await mergeGuestCartToUser(req, String(userDoc._id));

    return res.json({
      message: "Account created",
      user: {
        id: userDoc._id,
        name: userDoc.name,
        email: userDoc.email,
        phone: userDoc.phone,
      },
    });
  } catch (err: any) {
    console.error("registerUserAfterOtp error:", err);
    return res.status(500).json({ message: err?.message || "Signup failed" });
  }
};

export const adminGetUsers = async (req: Request, res: Response) => {
  try {
    const page = toInt(req.query.page, 1);
    const limit = Math.min(toInt(req.query.limit, 20), 100);
    const q = String(req.query.q || "").trim();

    const filter: any = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select("name email phone role emailVerified createdAt updatedAt") // keep minimal
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      message: "Users fetched",
      data: {
        users,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: any) {
    console.error("adminGetUsers error:", err);
    return res.status(500).json({ message: err?.message || "Failed to fetch users" });
  }
};