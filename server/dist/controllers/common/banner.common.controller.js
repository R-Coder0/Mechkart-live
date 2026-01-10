"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBannerByKey = void 0;
const Banner_model_1 = require("../../models/Banner.model");
/**
 * Public: GET active banner by key
 * Route: GET /api/common/banners/:key
 *
 * Examples:
 * - /api/common/banners/home-hero
 * - /api/common/banners/home-hero-secondary
 */
const getBannerByKey = async (req, res) => {
    try {
        const { key } = req.params;
        if (!key) {
            return res.status(400).json({ ok: false, message: "Banner key is required" });
        }
        const banner = await Banner_model_1.Banner.findOne({ key, isActive: true })
            .select("key image ctaUrl isActive updatedAt")
            .lean();
        // If not set yet, return null (frontend can fallback)
        return res.json({ ok: true, banner: banner || null });
    }
    catch (e) {
        return res
            .status(500)
            .json({ ok: false, message: e?.message || "Server error" });
    }
};
exports.getBannerByKey = getBannerByKey;
