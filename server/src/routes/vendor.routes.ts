import { Router } from "express";
import {
  registerVendor,
  loginVendor,
} from "../controllers/vendor/vendor.controller";
import { vendorAuth } from "../middleware/vendor.middleware";
import { upload } from "../middleware/upload.middleware";

const router = Router();

/**
 * VENDOR REGISTER
 * files:
 *  - panImage (required)
 *  - qrImage (optional)
 */
router.post(
  "/register",
  upload.fields([
    { name: "panImage", maxCount: 1 },
    { name: "qrImage", maxCount: 1 },
  ]),
  registerVendor
);

/**
 * VENDOR LOGIN
 */
router.post("/login", loginVendor);

/**
 * VENDOR PROFILE (test protected route)
 */
router.get("/me", vendorAuth, (req: any, res) => {
  res.json({
    vendor: req.vendor,
  });
});

export default router;
