"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Vendor_model_1 = require("../models/Vendor.model");
const vendorAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Vendor authorization required" });
        }
        const token = authHeader.split(" ")[1];
        const decoded = jsonwebtoken_1.default.verify(token, process.env.VENDOR_JWT_SECRET);
        if (decoded.role !== "VENDOR") {
            return res.status(403).json({ message: "Invalid vendor token" });
        }
        const vendor = await Vendor_model_1.Vendor.findById(decoded.vendorId);
        if (!vendor) {
            return res.status(401).json({ message: "Vendor not found" });
        }
        if (vendor.status !== "APPROVED" || !vendor.isLoginEnabled) {
            return res
                .status(403)
                .json({ message: "Vendor account not approved" });
        }
        req.vendor = vendor;
        next();
    }
    catch (err) {
        console.error("Vendor auth error:", err);
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};
exports.vendorAuth = vendorAuth;
