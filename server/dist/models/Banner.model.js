"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Banner = void 0;
const mongoose_1 = require("mongoose");
const BannerSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true, trim: true },
    image: { type: String, required: true, trim: true },
    ctaUrl: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
exports.Banner = (0, mongoose_1.model)("Banner", BannerSchema);
