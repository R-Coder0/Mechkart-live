import { Router } from "express";
import { getBannerByKey } from "../controllers/common/banner.common.controller.js";
import {
  getMyCart,
  addToCart,
  updateCartQty,
  removeCartItem,
  clearCart,
  updateCartItemOptions,
  setCartItemSelected,
  setCartSelectAll,
} from "../controllers/common/cart.controller.js";
import { authOptional } from "../middleware/authOptional.js";

const router = Router();

/**
 * CART ROUTES
 * Base: /api/common/cart
 */
router.get("/cart",authOptional, getMyCart);
router.post("/cart/add",authOptional, addToCart);
router.patch("/cart/item/options",authOptional, updateCartItemOptions);
router.patch("/cart/qty",authOptional, updateCartQty);
router.delete("/cart/item/:itemId",authOptional, removeCartItem);
router.delete("/cart/clear",authOptional, clearCart);
router.patch("/cart/item/select",authOptional, setCartItemSelected);
router.patch("/cart/select-all",authOptional, setCartSelectAll);


/**
 * BANNERS (KEEP THIS LAST)
 * GET /api/common/:key
 */
router.get("/:key", getBannerByKey);

export default router;
