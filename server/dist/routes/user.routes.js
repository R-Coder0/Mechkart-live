"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_otp_controller_1 = require("../controllers/user/auth.otp.controller");
const auth_controller_1 = require("../controllers/user/auth.controller");
const user_auth_middleware_1 = require("../middleware/user.auth.middleware");
const auth_session_controller_1 = require("../controllers/user/auth.session.controller");
const address_controller_1 = require("../controllers/user/address.controller");
const order_controller_1 = require("../controllers/user/order.controller");
const checkout_controller_1 = require("../controllers/user/checkout.controller");
const tracking_controller_1 = require("../controllers/user/tracking.controller");
const return_controller_1 = require("../controllers/user/return.controller");
const return_upload_controller_1 = require("../controllers/user/return.upload.controller");
const upload_middleware_1 = require("../middleware/upload.middleware");
const router = (0, express_1.Router)();
// OTP flow
router.post("/auth/send-otp", auth_otp_controller_1.sendSignupOtp);
router.post("/auth/verify-otp", auth_otp_controller_1.verifySignupOtp);
router.post("/auth/register", auth_controller_1.registerUserAfterOtp);
// session
router.post("/auth/login", auth_session_controller_1.loginUser);
router.post("/auth/logout", auth_session_controller_1.logoutUser);
router.get("/auth/me", user_auth_middleware_1.verifyUser, auth_session_controller_1.meUser);
// address
router.get("/addresses", user_auth_middleware_1.verifyUser, address_controller_1.listAddresses);
router.post("/addresses", user_auth_middleware_1.verifyUser, address_controller_1.addAddress);
router.patch("/addresses/:addressId", user_auth_middleware_1.verifyUser, address_controller_1.updateAddress);
router.patch("/addresses/:addressId/default", user_auth_middleware_1.verifyUser, address_controller_1.setDefaultAddress);
router.delete("/addresses/:addressId", user_auth_middleware_1.verifyUser, address_controller_1.deleteAddress);
// checkout summary
router.get("/checkout/summary", user_auth_middleware_1.verifyUser, checkout_controller_1.getCheckoutSummary);
router.post("/checkout/offer-preview", user_auth_middleware_1.verifyUser, checkout_controller_1.offerPreview);
// ----------------------
// orders
// ----------------------
// ✅ COD order
router.post("/orders/cod", user_auth_middleware_1.verifyUser, order_controller_1.createCodOrder);
// ✅ Razorpay (ONLINE) - Step 1
router.post("/orders/razorpay/create", user_auth_middleware_1.verifyUser, order_controller_1.createRazorpayOrder);
router.post("/orders/razorpay/verify", user_auth_middleware_1.verifyUser, order_controller_1.verifyRazorpayPayment);
// existing
router.get("/orders", user_auth_middleware_1.verifyUser, order_controller_1.getMyOrders);
router.get("/orders/:orderId", user_auth_middleware_1.verifyUser, order_controller_1.getOrderById);
router.get("/orders/:orderId/invoice", user_auth_middleware_1.verifyUser, order_controller_1.downloadInvoicePdf);
router.get("/orders/:orderId/tracking", user_auth_middleware_1.verifyUser, tracking_controller_1.getOrderTracking);
// return
router.post("/orders/:orderId/return-request", user_auth_middleware_1.verifyUser, upload_middleware_1.uploadReturnImages, // ✅ add this
return_controller_1.createReturnRequest);
router.get("/orders/:orderId/return-request", user_auth_middleware_1.verifyUser, return_controller_1.getReturnRequest);
router.post("/uploads/return-images", user_auth_middleware_1.verifyUser, upload_middleware_1.uploadReturnImages, return_upload_controller_1.uploadReturnImagesController);
exports.default = router;
