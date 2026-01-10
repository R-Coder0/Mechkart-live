import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { Types } from "mongoose";

import { User } from "../../models/User.model";
import { Cart } from "../../models/Cart.model";

const JWT_EXPIRES_IN = "7h";
const COOKIE_MAX_AGE_MS = 7 * 60 * 60 * 1000;

function getCookieOptions(req: Request) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_MS,
  };
}

function signToken(payload: { id: string; role: "user" }) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET missing");
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function toObjectId(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new Error("Invalid userId");
  return new Types.ObjectId(id);
}

/**
 * ✅ Important: Guest cart cookie-based (guestId) -> login ke baad user cart me merge
 */
async function mergeGuestCartToUser(req: Request, userId: string) {
  const guestId = (req as any).cookies?.guestId;
  if (!guestId) return;

  const userObjectId = toObjectId(userId);

  const guestCart = await Cart.findOne({ guestId });
  if (!guestCart || !guestCart.items?.length) return;

  let userCart = await Cart.findOne({ userId: userObjectId });

  // user cart doesn't exist -> move guest cart
  if (!userCart) {
    guestCart.userId = userObjectId;
    guestCart.guestId = undefined;
    await guestCart.save();
    return;
  }

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

/**
 * GET /api/user/me
 * verifyUser middleware ke baad hit hoga
 */
export const meUser = async (req: Request, res: Response) => {
  const user = (req as any).user;
  return res.json({
    user: user
      ? {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          emailVerified: user.emailVerified,
        }
      : null,
  });
};

/**
 * POST /api/user/login
 * body: { email, password }
 * ✅ sets httpOnly cookie: user_token (7h)
 */
export const loginUser = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.emailVerified) {
      return res.status(400).json({ message: "Please verify OTP first" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });

    const token = signToken({ id: String(user._id), role: "user" });
    res.cookie("user_token", token, getCookieOptions(req));

    // ✅ merge guest cart after login
    await mergeGuestCartToUser(req, String(user._id));

    return res.json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err: any) {
    console.error("loginUser error:", err);
    return res.status(500).json({ message: err?.message || "Login failed" });
  }
};

/**
 * POST /api/user/logout
 * ✅ clears cookie
 */
export const logoutUser = async (req: Request, res: Response) => {
  try {
    res.clearCookie("user_token", {
      path: "/",
      sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return res.json({ message: "Logged out" });
  } catch (err) {
    return res.status(500).json({ message: "Logout failed" });
  }
};
