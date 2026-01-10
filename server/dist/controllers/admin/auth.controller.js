"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminMe = exports.adminLogout = exports.adminLogin = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Admin_model_js_1 = __importDefault(require("../../models/Admin.model.js"));
/**
 * Admin Login
 * - Issues JWT for 6 hours (5–7 hrs requirement)
 * - Returns token + basic admin info
 */
const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ message: "email and password are required" });
        }
        const admin = await Admin_model_js_1.default.findOne({ email }).select("+password");
        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }
        const isMatch = await bcrypt_1.default.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }
        // ✅ 6 hours session (requirement: 5–7 hours)
        const EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || "6h";
        const token = jsonwebtoken_1.default.sign({
            id: admin._id,
            role: "admin",
        }, process.env.JWT_SECRET, { expiresIn: EXPIRES_IN });
        return res.status(200).json({
            message: "Login successful",
            token,
            expiresIn: EXPIRES_IN, // optional (frontend can use this)
            admin: {
                id: admin._id,
                email: admin.email,
                // name: admin.name,
            },
        });
    }
    catch (err) {
        console.error("Admin Login Error:", err);
        return res.status(500).json({ message: "Login failed" });
    }
};
exports.adminLogin = adminLogin;
/**
 * Optional: Admin Logout
 * - Since you are using Bearer token in localStorage, logout is client-side.
 * - This endpoint is still useful for consistency.
 */
const adminLogout = async (req, res) => {
    try {
        return res.status(200).json({ message: "Logged out" });
    }
    catch (err) {
        console.error("Admin Logout Error:", err);
        return res.status(500).json({ message: "Logout failed" });
    }
};
exports.adminLogout = adminLogout;
/**
 * Optional: Me (validate token on refresh)
 * - Frontend can call this on admin layout load
 * - If token expired => 401
 */
const getAdminMe = async (req, res) => {
    try {
        // verifyAdmin middleware should attach req.admin
        const admin = req.admin;
        if (!admin) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        return res.status(200).json({
            message: "Admin fetched",
            admin: {
                id: admin._id,
                email: admin.email,
                // name: admin.name,
            },
        });
    }
    catch (err) {
        console.error("Admin Me Error:", err);
        return res.status(500).json({ message: "Failed to fetch admin" });
    }
};
exports.getAdminMe = getAdminMe;
