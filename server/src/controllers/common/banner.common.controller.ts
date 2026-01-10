import { Request, Response } from "express";
import { Banner } from "../../models/Banner.model";

/**
 * Public: GET active banner by key
 * Route: GET /api/common/banners/:key
 *
 * Examples:
 * - /api/common/banners/home-hero
 * - /api/common/banners/home-hero-secondary
 */
export const getBannerByKey = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    if (!key) {
      return res.status(400).json({ ok: false, message: "Banner key is required" });
    }

    const banner = await Banner.findOne({ key, isActive: true })
      .select("key image ctaUrl isActive updatedAt")
      .lean();

    // If not set yet, return null (frontend can fallback)
    return res.json({ ok: true, banner: banner || null });
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, message: e?.message || "Server error" });
  }
};
