"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutUser = exports.loginUser = exports.meUser = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongoose_1 = require("mongoose");
const User_model_1 = require("../../models/User.model");
const Cart_model_1 = require("../../models/Cart.model");
const JWT_EXPIRES_IN = "7h";
const COOKIE_MAX_AGE_MS = 7 * 60 * 60 * 1000;
function getCookieOptions(req) {
    const isProd = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProd,
        sameSite: (isProd ? "none" : "lax"),
        path: "/",
        maxAge: COOKIE_MAX_AGE_MS,
    };
}
function signToken(payload) {
    if (!process.env.JWT_SECRET)
        throw new Error("JWT_SECRET missing");
    return jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
function toObjectId(id) {
    if (!mongoose_1.Types.ObjectId.isValid(id))
        throw new Error("Invalid userId");
    return new mongoose_1.Types.ObjectId(id);
}
/**
 * ✅ Important: Guest cart cookie-based (guestId) -> login ke baad user cart me merge
 */
async function mergeGuestCartToUser(req, userId) {
    const guestId = req.cookies?.guestId;
    if (!guestId)
        return;
    const userObjectId = toObjectId(userId);
    const guestCart = await Cart_model_1.Cart.findOne({ guestId });
    if (!guestCart || !guestCart.items?.length)
        return;
    let userCart = await Cart_model_1.Cart.findOne({ userId: userObjectId });
    // user cart doesn't exist -> move guest cart
    if (!userCart) {
        guestCart.userId = userObjectId;
        guestCart.guestId = undefined;
        await guestCart.save();
        return;
    }
    const key = (it) => `${String(it.productId)}|${String(it.variantId || "")}|${String(it.colorKey || "")}`;
    const map = new Map();
    for (const it of userCart.items || [])
        map.set(key(it), it);
    for (const it of guestCart.items || []) {
        const k = key(it);
        if (map.has(k)) {
            const existing = map.get(k);
            existing.qty = Number(existing.qty || 0) + Number(it.qty || 0);
        }
        else {
            userCart.items.push(it);
        }
    }
    await userCart.save();
    await Cart_model_1.Cart.deleteOne({ _id: guestCart._id });
}
/**
 * GET /api/user/me
 * verifyUser middleware ke baad hit hoga
 */
const meUser = async (req, res) => {
    const user = req.user;
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
exports.meUser = meUser;
/**
 * POST /api/user/login
 * body: { email, password }
 * ✅ sets httpOnly cookie: user_token (7h)
 */
const loginUser = async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        const user = await User_model_1.User.findOne({ email });
        if (!user)
            return res.status(404).json({ message: "User not found" });
        if (!user.emailVerified) {
            return res.status(400).json({ message: "Please verify OTP first" });
        }
        const ok = await bcrypt_1.default.compare(password, user.password);
        if (!ok)
            return res.status(400).json({ message: "Invalid credentials" });
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
    }
    catch (err) {
        console.error("loginUser error:", err);
        return res.status(500).json({ message: err?.message || "Login failed" });
    }
};
exports.loginUser = loginUser;
/**
 * POST /api/user/logout
 * ✅ clears cookie
 */
const logoutUser = async (req, res) => {
    try {
        res.clearCookie("user_token", {
            path: "/",
            sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax"),
            secure: process.env.NODE_ENV === "production",
        });
        return res.json({ message: "Logged out" });
    }
    catch (err) {
        return res.status(500).json({ message: "Logout failed" });
    }
};
exports.logoutUser = logoutUser;
