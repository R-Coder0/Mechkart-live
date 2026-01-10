"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_js_1 = require("../controllers/admin/auth.controller.js");
const auth_middleware_js_1 = require("../middleware/auth.middleware.js");
const stats_controller_js_1 = require("../controllers/admin/stats.controller.js");
// 👇 NEW: import category controllers
const category_controller_js_1 = require("../controllers/admin/category.controller.js");
const product_controller_js_1 = require("../controllers/admin/product.controller.js");
const upload_middleware_js_1 = require("../middleware/upload.middleware.js");
const banner_admin_controller_js_1 = require("../controllers/admin/banner.admin.controller.js");
const auth_controller_js_2 = require("../controllers/user/auth.controller.js");
const order_controller_js_1 = require("../controllers/admin/order.controller.js");
const router = (0, express_1.Router)();
// ---------- PUBLIC ROUTES ----------
router.post("/login", auth_controller_js_1.adminLogin);
// ---------- PROTECTED ROUTES (Admin Only) ----------
router.get("/profile", auth_middleware_js_1.verifyAdmin, (req, res) => {
    res.json({ message: "Admin verified", admin: req.admin });
});
router.get("/stats", auth_middleware_js_1.verifyAdmin, stats_controller_js_1.getAdminStats);
// ---------- CATEGORY ROUTES ----------
router.post("/categories", auth_middleware_js_1.verifyAdmin, upload_middleware_js_1.uploadCategoryImage, category_controller_js_1.createCategory);
router.get("/categories", category_controller_js_1.getAllCategories);
router.get("/categories/:id", auth_middleware_js_1.verifyAdmin, category_controller_js_1.getCategoryById);
router.put("/categories/:id", auth_middleware_js_1.verifyAdmin, upload_middleware_js_1.uploadCategoryImage, category_controller_js_1.updateCategory);
router.delete("/categories/:id", auth_middleware_js_1.verifyAdmin, category_controller_js_1.deleteCategory);
router.post("/products", auth_middleware_js_1.verifyAdmin, upload_middleware_js_1.uploadProductImages, product_controller_js_1.createProduct);
router.get("/products", product_controller_js_1.getAllProducts); // public listing (agar chaho to verifyAdmin hata do)
router.get("/products/:id", product_controller_js_1.getProductById);
router.put("/products/:id", auth_middleware_js_1.verifyAdmin, upload_middleware_js_1.uploadProductImages, product_controller_js_1.updateProduct);
router.get("/products/slug/:slug", product_controller_js_1.getProductBySlug);
router.delete("/products/:id", auth_middleware_js_1.verifyAdmin, product_controller_js_1.deleteProduct);
// ---------- PRODUCTS ROUTES ----------
router.post("/:key", auth_middleware_js_1.verifyAdmin, upload_middleware_js_1.uploadCategoryImage, banner_admin_controller_js_1.upsertBannerByKey);
// ---------- USERS ROUTES ----------
router.get("/users", auth_middleware_js_1.verifyAdmin, auth_controller_js_2.adminGetUsers);
// list all orders
router.get("/orders", auth_middleware_js_1.verifyAdmin, order_controller_js_1.adminGetOrders);
// update status
router.patch("/orders/:orderId/status", auth_middleware_js_1.verifyAdmin, order_controller_js_1.adminUpdateOrderStatus);
exports.default = router;
