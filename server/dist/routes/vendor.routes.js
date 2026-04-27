"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vendor_controller_1 = require("../controllers/vendor/vendor.controller");
const vendor_middleware_1 = require("../middleware/vendor.middleware");
const upload_middleware_1 = require("../middleware/upload.middleware");
const upload_middleware_2 = require("../middleware/upload.middleware");
const vendor_product_controller_1 = require("../controllers/vendor/vendor.product.controller");
const vendor_order_controller_1 = require("../controllers/vendor/vendor.order.controller");
const vendor_wallet_controller_1 = require("../controllers/vendor/vendor.wallet.controller");
const vendor_return_controller_1 = require("../controllers/vendor/vendor.return.controller");
const router = (0, express_1.Router)();
/**
 * VENDOR REGISTER
 * files:
 *  - panImage (required)
 *  - qrImage (optional)
 */
router.post("/register", upload_middleware_1.uploadVendorKyc, vendor_controller_1.registerVendor);
/**
 * VENDOR LOGIN
 */
router.post("/login", vendor_controller_1.loginVendor);
/**
 * VENDOR PROFILE (test protected route)
 */
router.get("/me", vendor_middleware_1.vendorAuth, vendor_controller_1.vendorMe);
router.patch("/me", vendor_middleware_1.vendorAuth, vendor_controller_1.vendorUpdateMe);
router.patch("/me/password", vendor_middleware_1.vendorAuth, vendor_controller_1.vendorChangePassword);
router.post("/orders/:orderId/suborders/:subOrderId/returns/:returnId/approve", vendor_middleware_1.vendorAuth, vendor_return_controller_1.approveReturnByVendor);
router.post("/orders/:orderId/suborders/:subOrderId/returns/:returnId/reject", vendor_middleware_1.vendorAuth, vendor_return_controller_1.rejectReturnByVendor);
// new
router.post("/forgot-password", vendor_controller_1.vendorForgotPassword);
router.post("/reset-password", vendor_controller_1.vendorResetPassword);
/**
 * Base: /api/vendors/products
 * Protected: vendorAuth
 */
// Create product (with images)
router.post("/products", vendor_middleware_1.vendorAuth, upload_middleware_2.uploadProductImages, vendor_product_controller_1.vendorCreateProduct);
// List my products
router.get("/products", vendor_middleware_1.vendorAuth, vendor_product_controller_1.vendorListMyProducts);
// Get single my product
router.get("/products/:id", vendor_middleware_1.vendorAuth, vendor_product_controller_1.vendorGetMyProductById);
// Update my product (with images)
router.put("/products/:id", vendor_middleware_1.vendorAuth, upload_middleware_2.uploadProductImages, vendor_product_controller_1.vendorUpdateMyProduct);
// ✅ vendor orders
router.get("/orders", vendor_middleware_1.vendorAuth, vendor_order_controller_1.vendorFetchOrders);
router.get("/orders/:orderId", vendor_middleware_1.vendorAuth, vendor_order_controller_1.vendorGetOrderById);
router.get("/orders/:orderId/tracking", vendor_middleware_1.vendorAuth, vendor_order_controller_1.vendorGetOrderTracking);
router.post("/orders/:orderId/shipments/:shipmentId/label", vendor_middleware_1.vendorAuth, vendor_order_controller_1.vendorGenerateOrderLabel);
router.get("/wallet", vendor_middleware_1.vendorAuth, vendor_wallet_controller_1.vendorGetMyWallet);
exports.default = router;
