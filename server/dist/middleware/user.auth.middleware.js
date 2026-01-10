"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyUser = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_model_1 = require("../models/User.model");
const verifyUser = async (req, res, next) => {
    try {
        const token = req.cookies?.user_token ||
            (req.headers.authorization?.startsWith("Bearer ")
                ? req.headers.authorization.split(" ")[1]
                : null);
        if (!token) {
            return res.status(401).json({ message: "Unauthorized: No token" });
        }
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ message: "Server misconfigured: JWT_SECRET missing" });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        if (!decoded?.id || decoded.role !== "user") {
            return res.status(401).json({ message: "Unauthorized: Invalid token" });
        }
        const user = await User_model_1.User.findById(decoded.id).select("-password");
        if (!user) {
            return res.status(401).json({ message: "Unauthorized: User not found" });
        }
        // attach for downstream controllers
        req.user = user;
        next();
    }
    catch (err) {
        return res.status(401).json({ message: "Unauthorized" });
    }
};
exports.verifyUser = verifyUser;
