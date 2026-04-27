"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_js_1 = require("../controllers/admin/auth.controller.js");
const auth_middleware_js_1 = require("../middleware/auth.middleware.js");
const stats_controller_js_1 = require("../controllers/admin/stats.controller.js");
const category_controller_js_1 = require("../controllers/admin/category.controller.js");
const product_controller_1 = require("../controllers/admin/product.controller");
const upload_middleware_js_1 = require("../middleware/upload.middleware.js");
const banner_admin_controller_js_1 = require("../controllers/admin/banner.admin.controller.js");
const auth_controller_js_2 = require("../controllers/user/auth.controller.js");
const order_controller_js_1 = require("../controllers/admin/order.controller.js");
const offer_admin_controller_1 = require("../controllers/admin/offer.admin.controller");
const shipment_controller_js_1 = require("../controllers/admin/shipment.controller.js");
const return_controller_js_1 = require("../controllers/admin/return.controller.js");
const refund_controller_js_1 = require("../controllers/admin/refund.controller.js");
// ✅ Vendor controllers (updated)
const vendor_controller_js_1 = require("../controllers/vendor/vendor.controller.js");
const Vendor_Product_Controller_js_1 = require("../controllers/admin/Vendor.Product.Controller.js");
const vendorWallet_admin_controller_js_1 = require("../controllers/admin/vendorWallet.admin.controller.js");
const wallet_payout_controller_js_1 = require("../controllers/admin/wallet.payout.controller.js");
const router = (0, express_1.Router)();
// ---------- PUBLIC ROUTES ----------
router.post("/login", auth_controller_js_1.adminLogin);
// ---------- PROTECTED ROUTES (Admin Only) ----------
router.get("/profile", auth_middleware_js_1.verifyAdmin, (req, res) => {
    res.json({ message: "Admin verified", admin: req.admin });
});
router.get("/stats", auth_middleware_js_1.verifyAdmin, stats_controller_js_1.getAdminStats);
router.get("/notifications/counts", auth_middleware_js_1.verifyAdmin, stats_controller_js_1.getAdminNotificationCounts);
// ---------- CATEGORY ROUTES ----------
router.post("/categories", auth_middleware_js_1.verifyAdmin, upload_middleware_js_1.uploadCategoryImage, category_controller_js_1.createCategory);
router.get("/categories", category_controller_js_1.getAllCategories);
router.get("/categories/:id", auth_middleware_js_1.verifyAdmin, category_controller_js_1.getCategoryById);
router.put("/categories/:id", auth_middleware_js_1.verifyAdmin, upload_middleware_js_1.uploadCategoryImage, category_controller_js_1.updateCategory);
router.delete("/categories/:id", auth_middleware_js_1.verifyAdmin, category_controller_js_1.deleteCategory);
// ---------- PRODUCTS ROUTES ----------
router.post("/products", auth_middleware_js_1.verifyAdmin, upload_middleware_js_1.uploadProductImages, product_controller_1.createProduct);
router.get("/products", product_controller_1.getAllProducts);
router.get("/products/:id", product_controller_1.getProductById);
router.put("/products/:id", auth_middleware_js_1.verifyAdmin, upload_middleware_js_1.uploadProductImages, product_controller_1.updateProduct);
router.get("/products/slug/:slug", product_controller_1.getProductBySlug);
router.delete("/products/:id", auth_middleware_js_1.verifyAdmin, product_controller_1.deleteProduct);
// ---------- BANNERS ----------
router.post("/:key", auth_middleware_js_1.verifyAdmin, upload_middleware_js_1.uploadCategoryImage, banner_admin_controller_js_1.upsertBannerByKey);
// ---------- USERS ----------
router.get("/users", auth_middleware_js_1.verifyAdmin, auth_controller_js_2.adminGetUsers);
// ---------- ORDERS ----------
router.get("/orders", auth_middleware_js_1.verifyAdmin, order_controller_js_1.adminGetOrders);
router.patch("/orders/:orderId/status", auth_middleware_js_1.verifyAdmin, order_controller_js_1.adminUpdateOrderStatus);
router.patch("/orders/:orderId/confirm-cod", auth_middleware_js_1.verifyAdmin, order_controller_js_1.adminConfirmCodOrder);
router.post("/orders/:orderId/shiprocket/create-shipment", auth_middleware_js_1.verifyAdmin, shipment_controller_js_1.adminCreateShiprocketShipment);
// ---------- OFFERS ----------
router.post("/discount/offers", auth_middleware_js_1.verifyAdmin, offer_admin_controller_1.createOffer);
router.patch("/discount/offers/:id", auth_middleware_js_1.verifyAdmin, offer_admin_controller_1.updateOffer);
router.patch("/discount/offers/:id/toggle", auth_middleware_js_1.verifyAdmin, offer_admin_controller_1.toggleOffer);
router.get("/discount/offers", auth_middleware_js_1.verifyAdmin, offer_admin_controller_1.listOffers);
// ---------- Return & Refund ----------
// ---------- Return & Refund ----------
router.get("/returns", auth_middleware_js_1.verifyAdmin, return_controller_js_1.adminListReturnRequests);
// ✅ approve/reject: same signature as controller expects
router.post("/orders/:orderId/suborders/:subOrderId/returns/:returnId/approve", auth_middleware_js_1.verifyAdmin, return_controller_js_1.adminApproveReturn);
router.post("/orders/:orderId/suborders/:subOrderId/returns/:returnId/reject", auth_middleware_js_1.verifyAdmin, return_controller_js_1.adminRejectReturn);
// ✅ refund: keep naming consistent with your controller (refund.controller.ts)
router.post("/orders/:orderId/suborders/:subOrderId/returns/:returnId/refund", auth_middleware_js_1.verifyAdmin, refund_controller_js_1.adminProcessRefund);
// ==============================
// ✅ VENDORS (Admin)
// ==============================
// ✅ List vendors (PENDING/APPROVED/REJECTED/ALL + search + pagination)
router.get("/vendors", auth_middleware_js_1.verifyAdmin, vendor_controller_js_1.adminListVendors);
// ✅ Get single vendor details
router.get("/vendors/:vendorId", auth_middleware_js_1.verifyAdmin, vendor_controller_js_1.adminGetVendor);
// ✅ Approve vendor
router.post("/vendors/:vendorId/approve", auth_middleware_js_1.verifyAdmin, vendor_controller_js_1.approveVendor);
// ✅ Reject vendor
router.post("/vendors/:vendorId/reject", auth_middleware_js_1.verifyAdmin, vendor_controller_js_1.rejectVendor);
router.post("/vendors/:vendorId/disable", auth_middleware_js_1.verifyAdmin, vendor_controller_js_1.adminDisableVendor);
router.post("/vendors/:vendorId/enable", auth_middleware_js_1.verifyAdmin, vendor_controller_js_1.adminEnableVendor);
// optional hard delete
router.delete("/vendors/:vendorId", auth_middleware_js_1.verifyAdmin, vendor_controller_js_1.adminDeleteVendor);
router.get("/vendor-products", auth_middleware_js_1.verifyAdmin, Vendor_Product_Controller_js_1.adminListVendorProducts);
router.post("/vendor-products/:id/approve", auth_middleware_js_1.verifyAdmin, Vendor_Product_Controller_js_1.adminApproveVendorProduct);
router.post("/vendor-products/:id/reject", auth_middleware_js_1.verifyAdmin, Vendor_Product_Controller_js_1.adminRejectVendorProduct);
router.get("/vendor-products/:id", auth_middleware_js_1.verifyAdmin, Vendor_Product_Controller_js_1.adminGetVendorProductById);
router.post("/wallet/sync-order/:orderId", auth_middleware_js_1.verifyAdmin, vendorWallet_admin_controller_js_1.adminSyncWalletForOrder);
router.post("/wallet/unlock", auth_middleware_js_1.verifyAdmin, vendorWallet_admin_controller_js_1.adminRunWalletUnlock);
// ✅ payout endpoints
router.post("/wallet/payout/release", auth_middleware_js_1.verifyAdmin, wallet_payout_controller_js_1.adminPayoutRelease);
router.post("/wallet/payout/failed", auth_middleware_js_1.verifyAdmin, wallet_payout_controller_js_1.adminPayoutFailed);
router.get("/wallet/vendor/:vendorId", auth_middleware_js_1.verifyAdmin, vendorWallet_admin_controller_js_1.adminGetVendorWallet);
// list wallets
router.get("/wallet/vendor-wallet", auth_middleware_js_1.verifyAdmin, vendorWallet_admin_controller_js_1.adminListVendorWallets);
exports.default = router;
