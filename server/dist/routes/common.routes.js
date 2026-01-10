"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const banner_common_controller_js_1 = require("../controllers/common/banner.common.controller.js");
const cart_controller_js_1 = require("../controllers/common/cart.controller.js");
const authOptional_js_1 = require("../middleware/authOptional.js");
const router = (0, express_1.Router)();
/**
 * CART ROUTES
 * Base: /api/common/cart
 */
router.get("/cart", authOptional_js_1.authOptional, cart_controller_js_1.getMyCart);
router.post("/cart/add", authOptional_js_1.authOptional, cart_controller_js_1.addToCart);
router.patch("/cart/item/options", authOptional_js_1.authOptional, cart_controller_js_1.updateCartItemOptions);
router.patch("/cart/qty", authOptional_js_1.authOptional, cart_controller_js_1.updateCartQty);
router.delete("/cart/item/:itemId", authOptional_js_1.authOptional, cart_controller_js_1.removeCartItem);
router.delete("/cart/clear", authOptional_js_1.authOptional, cart_controller_js_1.clearCart);
router.patch("/cart/item/select", authOptional_js_1.authOptional, cart_controller_js_1.setCartItemSelected);
router.patch("/cart/select-all", authOptional_js_1.authOptional, cart_controller_js_1.setCartSelectAll);
/**
 * BANNERS (KEEP THIS LAST)
 * GET /api/common/:key
 */
router.get("/:key", banner_common_controller_js_1.getBannerByKey);
exports.default = router;
