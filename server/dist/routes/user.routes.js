"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_otp_controller_js_1 = require("../controllers/user/auth.otp.controller.js");
const auth_controller_js_1 = require("../controllers/user/auth.controller.js");
const user_auth_middleware_js_1 = require("../middleware/user.auth.middleware.js");
const auth_session_controller_js_1 = require("../controllers/user/auth.session.controller.js");
const address_controller_js_1 = require("../controllers/user/address.controller.js");
const order_controller_js_1 = require("../controllers/user/order.controller.js");
const checkout_controller_js_1 = require("../controllers/user/checkout.controller.js");
const router = (0, express_1.Router)();
// OTP flow
router.post("/auth/send-otp", auth_otp_controller_js_1.sendSignupOtp);
router.post("/auth/verify-otp", auth_otp_controller_js_1.verifySignupOtp);
router.post("/auth/register", auth_controller_js_1.registerUserAfterOtp);
// session
router.post("/auth/login", auth_session_controller_js_1.loginUser);
router.post("/auth/logout", auth_session_controller_js_1.logoutUser);
router.get("/auth/me", user_auth_middleware_js_1.verifyUser, auth_session_controller_js_1.meUser);
//address
router.get("/addresses", user_auth_middleware_js_1.verifyUser, address_controller_js_1.listAddresses);
router.post("/addresses", user_auth_middleware_js_1.verifyUser, address_controller_js_1.addAddress);
router.patch("/addresses/:addressId", user_auth_middleware_js_1.verifyUser, address_controller_js_1.updateAddress);
router.patch("/addresses/:addressId/default", user_auth_middleware_js_1.verifyUser, address_controller_js_1.setDefaultAddress);
router.delete("/addresses/:addressId", user_auth_middleware_js_1.verifyUser, address_controller_js_1.deleteAddress);
// Check OUt Summary 
router.get("/checkout/summary", user_auth_middleware_js_1.verifyUser, checkout_controller_js_1.getCheckoutSummary);
// order
router.post("/orders", user_auth_middleware_js_1.verifyUser, order_controller_js_1.createCodOrder);
router.get("/orders", user_auth_middleware_js_1.verifyUser, order_controller_js_1.getMyOrders);
router.get("/orders/:orderId", user_auth_middleware_js_1.verifyUser, order_controller_js_1.getOrderById);
router.get("/orders/:orderId/invoice", user_auth_middleware_js_1.verifyUser, order_controller_js_1.downloadInvoicePdf);
exports.default = router;
