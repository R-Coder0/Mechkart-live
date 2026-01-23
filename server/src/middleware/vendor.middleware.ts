import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Vendor } from "../models/Vendor.model";

interface VendorJwtPayload {
  vendorId: string;
  role: "VENDOR";
}

export interface VendorAuthRequest extends Request {
  vendor?: any;
}

export const vendorAuth = async (
  req: VendorAuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Vendor authorization required" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.VENDOR_JWT_SECRET as string
    ) as VendorJwtPayload;

    if (decoded.role !== "VENDOR") {
      return res.status(403).json({ message: "Invalid vendor token" });
    }

    const vendor = await Vendor.findById(decoded.vendorId);

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
  } catch (err) {
    console.error("Vendor auth error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
