"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertBannerByKey = void 0;
const Banner_model_js_1 = require("../../models/Banner.model.js");
const normalizeCtaUrl = (url) => {
    return (url || "").trim();
};
const fileToPublicPath = (file) => {
    if (!file?.filename)
        return "";
    return `/uploads/${file.filename}`;
};
/**
 * Admin: Create / Update banner by key
 *
 * Route:
 * POST /api/admin/banners/:key
 *
 * Params:
 * - key (string) → e.g.
 *   - home-hero
 *   - home-hero-secondary
 *
 * FormData:
 * - image (file)            [required on first create]
 * - ctaUrl (string)         [required]
 * - isActive ("true"/"false") [optional]
 */
const upsertBannerByKey = async (req, res) => {
    try {
        const { key } = req.params;
        if (!key) {
            return res
                .status(400)
                .json({ ok: false, message: "Banner key is required" });
        }
        const ctaUrl = normalizeCtaUrl(req.body?.ctaUrl);
        if (!ctaUrl) {
            return res
                .status(400)
                .json({ ok: false, message: "ctaUrl is required" });
        }
        const isActive = typeof req.body?.isActive === "string"
            ? req.body.isActive === "true"
            : req.body?.isActive ?? true;
        const uploadedImage = fileToPublicPath(req.file);
        // find existing banner (if any)
        const existing = await Banner_model_js_1.Banner.findOne({ key }).lean();
        // if creating first time → image mandatory
        const image = uploadedImage || existing?.image;
        if (!image) {
            return res.status(400).json({
                ok: false,
                message: "Image is required for first-time banner creation",
            });
        }
        const banner = await Banner_model_js_1.Banner.findOneAndUpdate({ key }, {
            $set: {
                key,
                image,
                ctaUrl,
                isActive,
            },
        }, {
            new: true,
            upsert: true,
        }).lean();
        return res.json({ ok: true, banner });
    }
    catch (e) {
        return res.status(500).json({
            ok: false,
            message: e?.message || "Server error",
        });
    }
};
exports.upsertBannerByKey = upsertBannerByKey;
