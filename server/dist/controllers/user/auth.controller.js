"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminGetUsers = exports.registerUserAfterOtp = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongoose_1 = require("mongoose");
const User_model_1 = require("../../models/User.model");
const EmailOtp_model_1 = require("../../models/EmailOtp.model");
const Cart_model_1 = require("../../models/Cart.model");
const JWT_EXPIRES_IN = "7h"; // ✅ as you want
const COOKIE_MAX_AGE_MS = 7 * 60 * 60 * 1000; // ✅ 7 hours
const toInt = (v, def) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0)
        return def;
    return Math.floor(n);
};
function getCookieOptions(req) {
    const isProd = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProd,
        sameSite: (isProd ? "none" : "lax"),
        // domain: isProd ? ".countryhome.co.in" : undefined,
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
    // throw if invalid (better than saving bad data)
    if (!mongoose_1.Types.ObjectId.isValid(id))
        throw new Error("Invalid userId");
    return new mongoose_1.Types.ObjectId(id);
}
async function mergeGuestCartToUser(req, userId) {
    const guestId = req.cookies?.guestId; // cookie-parser required
    if (!guestId)
        return;
    const userObjectId = toObjectId(userId);
    const guestCart = await Cart_model_1.Cart.findOne({ guestId });
    if (!guestCart || !guestCart.items?.length)
        return;
    let userCart = await Cart_model_1.Cart.findOne({ userId: userObjectId });
    // ✅ if user has no cart, move guest cart to user
    if (!userCart) {
        guestCart.userId = userObjectId; // ✅ FIX: ObjectId
        guestCart.guestId = undefined;
        await guestCart.save();
        return;
    }
    // ✅ merge item-by-item
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
const registerUserAfterOtp = async (req, res) => {
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
        const otp = await EmailOtp_model_1.EmailOtp.findOne({ email, purpose: "signup" }).sort({ createdAt: -1 });
        if (!otp || !otp.verified) {
            return res.status(400).json({ message: "Please verify OTP first" });
        }
        // ✅ create or update user
        const exists = await User_model_1.User.findOne({ $or: [{ email }, { phone }] });
        if (exists && exists.emailVerified) {
            return res.status(400).json({ message: "User already exists" });
        }
        const hashed = await bcrypt_1.default.hash(password, 10);
        let userDoc;
        if (!exists) {
            userDoc = await User_model_1.User.create({
                name,
                email,
                phone,
                password: hashed,
                emailVerified: true,
                role: "user",
            });
        }
        else {
            exists.name = name;
            exists.phone = phone;
            exists.password = hashed;
            exists.emailVerified = true;
            userDoc = await exists.save();
        }
        // ✅ cleanup OTP
        await EmailOtp_model_1.EmailOtp.deleteMany({ email, purpose: "signup" });
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
    }
    catch (err) {
        console.error("registerUserAfterOtp error:", err);
        return res.status(500).json({ message: err?.message || "Signup failed" });
    }
};
exports.registerUserAfterOtp = registerUserAfterOtp;
const adminGetUsers = async (req, res) => {
    try {
        const page = toInt(req.query.page, 1);
        const limit = Math.min(toInt(req.query.limit, 20), 100);
        const q = String(req.query.q || "").trim();
        const filter = {};
        if (q) {
            filter.$or = [
                { name: { $regex: q, $options: "i" } },
                { email: { $regex: q, $options: "i" } },
                { phone: { $regex: q, $options: "i" } },
            ];
        }
        const skip = (page - 1) * limit;
        const [total, users] = await Promise.all([
            User_model_1.User.countDocuments(filter),
            User_model_1.User.find(filter)
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
    }
    catch (err) {
        console.error("adminGetUsers error:", err);
        return res.status(500).json({ message: err?.message || "Failed to fetch users" });
    }
};
exports.adminGetUsers = adminGetUsers;
