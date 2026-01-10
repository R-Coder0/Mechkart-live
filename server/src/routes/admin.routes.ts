import { Router } from "express";
import { adminLogin } from "../controllers/admin/auth.controller.js";
import { verifyAdmin } from "../middleware/auth.middleware.js";
import { getAdminStats } from "../controllers/admin/stats.controller.js";

// 👇 NEW: import category controllers
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
import { upsertBannerByKey} from "../controllers/admin/banner.admin.controller.js";
import { adminGetUsers } from "../controllers/user/auth.controller.js";
import { adminGetOrders, adminUpdateOrderStatus } from "../controllers/admin/order.controller.js";

const router = Router();

// ---------- PUBLIC ROUTES ----------
router.post("/login", adminLogin);

// ---------- PROTECTED ROUTES (Admin Only) ----------
router.get("/profile", verifyAdmin, (req: any, res) => {
  res.json({ message: "Admin verified", admin: req.admin });
});

router.get("/stats", verifyAdmin, getAdminStats);

// ---------- CATEGORY ROUTES ----------
router.post("/categories", verifyAdmin,uploadCategoryImage, createCategory);
router.get("/categories", getAllCategories);
router.get("/categories/:id", verifyAdmin, getCategoryById);
router.put("/categories/:id", verifyAdmin,uploadCategoryImage, updateCategory);
router.delete("/categories/:id", verifyAdmin, deleteCategory);


router.post("/products", verifyAdmin,uploadProductImages, createProduct);
router.get("/products", getAllProducts); // public listing (agar chaho to verifyAdmin hata do)
router.get("/products/:id", getProductById);
router.put("/products/:id", verifyAdmin,uploadProductImages, updateProduct);
router.get("/products/slug/:slug", getProductBySlug);
router.delete("/products/:id", verifyAdmin, deleteProduct);

// ---------- PRODUCTS ROUTES ----------
router.post("/:key", verifyAdmin, uploadCategoryImage, upsertBannerByKey);
// ---------- USERS ROUTES ----------
router.get("/users", verifyAdmin, adminGetUsers);

// list all orders
router.get("/orders", verifyAdmin, adminGetOrders);

// update status
router.patch("/orders/:orderId/status", verifyAdmin, adminUpdateOrderStatus);

export default router;
