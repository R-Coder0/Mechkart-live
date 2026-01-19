import { Router } from "express";
import { adminLogin } from "../controllers/admin/auth.controller.js";
import { verifyAdmin } from "../middleware/auth.middleware.js";
import { getAdminStats } from "../controllers/admin/stats.controller.js";

import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../controllers/admin/category.controller.js";

import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductBySlug,
} from "../controllers/admin/product.controller";

import { uploadProductImages, uploadCategoryImage } from "../middleware/upload.middleware.js";
import { upsertBannerByKey } from "../controllers/admin/banner.admin.controller.js";
import { adminGetUsers } from "../controllers/user/auth.controller.js";

import {
  adminGetOrders,
  adminUpdateOrderStatus,
  adminConfirmCodOrder, // ✅ NEW
} from "../controllers/admin/order.controller.js";

import {
  createOffer,
  updateOffer,
  toggleOffer,
  listOffers,
} from "../controllers/admin/offer.admin.controller";
import { adminCreateShiprocketShipment } from "../controllers/admin/shipment.controller.js";

const router = Router();

// ---------- PUBLIC ROUTES ----------
router.post("/login", adminLogin);

// ---------- PROTECTED ROUTES (Admin Only) ----------
router.get("/profile", verifyAdmin, (req: any, res) => {
  res.json({ message: "Admin verified", admin: req.admin });
});

router.get("/stats", verifyAdmin, getAdminStats);

// ---------- CATEGORY ROUTES ----------
router.post("/categories", verifyAdmin, uploadCategoryImage, createCategory);
router.get("/categories", getAllCategories);
router.get("/categories/:id", verifyAdmin, getCategoryById);
router.put("/categories/:id", verifyAdmin, uploadCategoryImage, updateCategory);
router.delete("/categories/:id", verifyAdmin, deleteCategory);

// ---------- PRODUCTS ROUTES ----------
router.post("/products", verifyAdmin, uploadProductImages, createProduct);
router.get("/products", getAllProducts);
router.get("/products/:id", getProductById);
router.put("/products/:id", verifyAdmin, uploadProductImages, updateProduct);
router.get("/products/slug/:slug", getProductBySlug);
router.delete("/products/:id", verifyAdmin, deleteProduct);

// ---------- BANNERS ----------
router.post("/:key", verifyAdmin, uploadCategoryImage, upsertBannerByKey);

// ---------- USERS ----------
router.get("/users", verifyAdmin, adminGetUsers);

// ---------- ORDERS ----------
router.get("/orders", verifyAdmin, adminGetOrders);

// status change (dropdown etc.)
router.patch("/orders/:orderId/status", verifyAdmin, adminUpdateOrderStatus);

// ✅ NEW: confirm COD (Admin approves COD before shipment)
router.patch("/orders/:orderId/confirm-cod", verifyAdmin, adminConfirmCodOrder);

// ---------- OFFERS ----------
router.post("/discount/offers", verifyAdmin, createOffer);
router.patch("/discount/offers/:id", verifyAdmin, updateOffer);
router.patch("/discount/offers/:id/toggle", verifyAdmin, toggleOffer);
router.get("/discount/offers", verifyAdmin, listOffers);

router.post("/orders/:orderId/shiprocket/create-shipment", verifyAdmin, adminCreateShiprocketShipment);

export default router;
