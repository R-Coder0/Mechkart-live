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

import {
  uploadProductImages,
  uploadCategoryImage,
  
} from "../middleware/upload.middleware.js";

import { upsertBannerByKey } from "../controllers/admin/banner.admin.controller.js";
import { adminGetUsers } from "../controllers/user/auth.controller.js";

import {
  adminGetOrders,
  adminUpdateOrderStatus,
  adminConfirmCodOrder,
} from "../controllers/admin/order.controller.js";

import {
  createOffer,
  updateOffer,
  toggleOffer,
  listOffers,
} from "../controllers/admin/offer.admin.controller";

import { adminCreateShiprocketShipment } from "../controllers/admin/shipment.controller.js";

import {
  adminApproveReturn,
  adminListReturnRequests,
  adminRejectReturn,
} from "../controllers/admin/return.controller.js";

import { adminProcessRefund } from "../controllers/admin/refund.controller.js";

// ✅ Vendor controllers (updated)
import {
  approveVendor,
  rejectVendor,
  adminListVendors,
  adminGetVendor,
  adminDisableVendor,
  adminEnableVendor,
  adminDeleteVendor,
} from "../controllers/vendor/vendor.controller.js";
import { adminApproveVendorProduct, adminGetVendorProductById, adminListVendorProducts, adminRejectVendorProduct } from "../controllers/admin/Vendor.Product.Controller.js";
import { adminGetVendorWallet, adminListVendorWallets, adminRunWalletUnlock, adminSyncWalletForOrder } from "../controllers/admin/vendorWallet.admin.controller.js";
import { adminPayoutFailed, adminPayoutRelease } from "../controllers/admin/wallet.payout.controller.js";

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
router.patch("/orders/:orderId/status", verifyAdmin, adminUpdateOrderStatus);
router.patch("/orders/:orderId/confirm-cod", verifyAdmin, adminConfirmCodOrder);
router.post(
  "/orders/:orderId/shiprocket/create-shipment",
  verifyAdmin,
  adminCreateShiprocketShipment
);

// ---------- OFFERS ----------
router.post("/discount/offers", verifyAdmin, createOffer);
router.patch("/discount/offers/:id", verifyAdmin, updateOffer);
router.patch("/discount/offers/:id/toggle", verifyAdmin, toggleOffer);
router.get("/discount/offers", verifyAdmin, listOffers);

// ---------- Return & Refund ----------
router.get("/returns", verifyAdmin, adminListReturnRequests);
router.post("/returns/:orderId/approve", verifyAdmin, adminApproveReturn);
router.post("/returns/:orderId/reject", verifyAdmin, adminRejectReturn);
router.post("/returns/:orderId/process-refund", verifyAdmin, adminProcessRefund);

// ==============================
// ✅ VENDORS (Admin)
// ==============================

// ✅ List vendors (PENDING/APPROVED/REJECTED/ALL + search + pagination)
router.get("/vendors", verifyAdmin, adminListVendors);

// ✅ Get single vendor details
router.get("/vendors/:vendorId", verifyAdmin, adminGetVendor);

// ✅ Approve vendor
router.post("/vendors/:vendorId/approve", verifyAdmin, approveVendor);

// ✅ Reject vendor
router.post("/vendors/:vendorId/reject", verifyAdmin, rejectVendor);
router.post("/vendors/:vendorId/disable", verifyAdmin, adminDisableVendor);
router.post("/vendors/:vendorId/enable", verifyAdmin, adminEnableVendor);

// optional hard delete
router.delete("/vendors/:vendorId", verifyAdmin, adminDeleteVendor);


router.get(
  "/vendor-products",
  verifyAdmin,
  adminListVendorProducts
);

router.post(
  "/vendor-products/:id/approve",
  verifyAdmin,
  adminApproveVendorProduct
);

router.post(
  "/vendor-products/:id/reject",
  verifyAdmin,
  adminRejectVendorProduct
);
router.get(
  "/vendor-products/:id",
  verifyAdmin,
  adminGetVendorProductById
);
router.post("/wallet/sync-order/:orderId", verifyAdmin, adminSyncWalletForOrder);
router.post("/wallet/unlock", verifyAdmin, adminRunWalletUnlock);
// ✅ payout endpoints
router.post("/wallet/payout/release", verifyAdmin, adminPayoutRelease);
router.post("/wallet/payout/failed", verifyAdmin, adminPayoutFailed);
router.get("/wallet/vendor/:vendorId", verifyAdmin, adminGetVendorWallet);

// list wallets
router.get("/wallet/vendor-wallet", verifyAdmin, adminListVendorWallets);

export default router;
