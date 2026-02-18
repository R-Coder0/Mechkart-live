import type { Request, Response } from "express";
import { Product } from "../../models/Product.model"; // ✅ path adjust if file name differs

export async function searchProducts(req: Request, res: Response) {
  try {
    const qRaw = String(req.query.q ?? "").trim();
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "24"), 10) || 24));
    const skip = (page - 1) * limit;

    if (!qRaw) {
      return res.status(200).json({
        success: true,
        data: { items: [], page, limit, total: 0, totalPages: 0 },
      });
    }

    // ✅ safe regex (escape special chars)
    const escaped = qRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");

    // ✅ Only show live + approved + active products
    // (vendor products must be APPROVED)
    const filter: any = {
      isActive: true,
      approvalStatus: "APPROVED",
      $or: [
        { title: rx },
        { slug: rx },
        { productId: rx },
        // optional:
        { description: rx },
        { features: rx },
      ],
    };

    const [items, total] = await Promise.all([
      Product.find(filter)
        .select(
          "_id title slug featureImage mrp salePrice totalStock baseStock variants ownerType vendorId approvalStatus"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    // ✅ map for UI: add inStock boolean
    const mapped = (items || []).map((p: any) => ({
      ...p,
      inStock: typeof p.totalStock === "number" ? p.totalStock > 0 : (p.baseStock ?? 0) > 0,
    }));

    return res.status(200).json({
      success: true,
      data: {
        items: mapped,
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || "Search failed",
    });
  }
}
