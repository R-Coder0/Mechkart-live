import { Router } from "express";
import {
  registerVendor,
  loginVendor,
  vendorMe,
  vendorUpdateMe,
  vendorChangePassword,
} from "../controllers/vendor/vendor.controller";
import { vendorAuth } from "../middleware/vendor.middleware";
import { upload, uploadVendorKyc } from "../middleware/upload.middleware";

import { uploadProductImages } from "../middleware/upload.middleware";
import {
  vendorCreateProduct,
  vendorListMyProducts,
  vendorGetMyProductById,
  vendorUpdateMyProduct,
} from "../controllers/vendor/vendor.product.controller";
const router = Router();

/**
 * VENDOR REGISTER
 * files:
 *  - panImage (required)
 *  - qrImage (optional)
 */
router.post("/register", uploadVendorKyc, registerVendor);

/**
 * VENDOR LOGIN
 */
router.post("/login", loginVendor);

/**
 * VENDOR PROFILE (test protected route)
 */
router.get("/me", vendorAuth, vendorMe);
router.patch("/me", vendorAuth, vendorUpdateMe);
router.patch("/me/password", vendorAuth, vendorChangePassword);





/**
 * Base: /api/vendors/products
 * Protected: vendorAuth
 */

// Create product (with images)
router.post("/products", vendorAuth, uploadProductImages, vendorCreateProduct);

// List my products
router.get("/products", vendorAuth, vendorListMyProducts);

// Get single my product
router.get("/products/:id", vendorAuth, vendorGetMyProductById);

// Update my product (with images)
router.put("/products/:id", vendorAuth, uploadProductImages, vendorUpdateMyProduct);

export default router;
