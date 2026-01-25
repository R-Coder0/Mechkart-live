/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Product } from "../../models/Product.model";

/**
 * ADMIN: LIST VENDOR PRODUCTS (PENDING / APPROVED / REJECTED)
 * GET /api/admin/vendor-products?status=PENDING|APPROVED|REJECTED&vendorId=&q=
 */
export const adminListVendorProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, vendorId, q } = req.query as any;

    const filter: any = {
      ownerType: "VENDOR",
    };

    if (status) {
      filter.approvalStatus = String(status).toUpperCase();
    }

    if (vendorId && Types.ObjectId.isValid(String(vendorId))) {
      filter.vendorId = new Types.ObjectId(String(vendorId));
    }

    if (q) {
      const rx = new RegExp(String(q).trim(), "i");
      filter.$or = [{ title: rx }, { slug: rx }, { productId: rx }];
    }

    const products = await Product.find(filter)
      .populate("vendorId", "companyName email phone")
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .sort({ createdAt: -1 });

    return res.json({ data: products });
  } catch (err) {
    next(err);
  }
};

/**
 * ADMIN: APPROVE VENDOR PRODUCT
 * POST /api/admin/vendor-products/:id/approve
 */
export const adminApproveVendorProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const product = await Product.findOne({
      _id: id,
      ownerType: "VENDOR",
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    product.approvalStatus = "APPROVED";
    product.isActive = true;

    await product.save();

    return res.json({
      message: "Vendor product approved",
      data: product,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ADMIN: REJECT VENDOR PRODUCT
 * POST /api/admin/vendor-products/:id/reject
 */
export const adminRejectVendorProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { reason } = req.body as any;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const product = await Product.findOne({
      _id: id,
      ownerType: "VENDOR",
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

 product.approvalStatus = "REJECTED";
product.isActive = false;
product.approvalNote = reason || "Rejected by admin";
await product.save();
    (product as any).rejectReason = reason || "Rejected by admin";

    await product.save();

    return res.json({
      message: "Vendor product rejected",
      data: product,
    });
  } catch (err) {
    next(err);
  }
};
export const adminGetVendorProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const product = await Product.findOne({ _id: id, ownerType: "VENDOR" })
      .populate("vendorId", "companyName email phone status")
      .populate("category", "name slug")
      .populate("subCategory", "name slug");

    if (!product) return res.status(404).json({ message: "Product not found" });

    return res.json({ data: product });
  } catch (err) {
    next(err);
  }
};
