"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authOptional = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_model_1 = require("../models/User.model");
const authOptional = async (req, _res, next) => {
    try {
        const token = req.cookies?.user_token ||
            (req.headers.authorization?.startsWith("Bearer ")
                ? req.headers.authorization.split(" ")[1]
                : null);
        if (!token)
            return next();
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        if (!decoded?.id || decoded.role !== "user")
            return next();
        const user = await User_model_1.User.findById(decoded.id).select("-password");
        if (!user)
            return next();
        req.user = user;
        return next();
    }
    catch {
        return next();
    }
};
exports.authOptional = authOptional;
