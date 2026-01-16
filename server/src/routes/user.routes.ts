import { Router } from "express";
import { sendSignupOtp, verifySignupOtp } from "../controllers/user/auth.otp.controller";
import { registerUserAfterOtp } from "../controllers/user/auth.controller";
import { verifyUser } from "../middleware/user.auth.middleware";
import { meUser, loginUser, logoutUser } from "../controllers/user/auth.session.controller"; 
import {
  listAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "../controllers/user/address.controller";
import { createCodOrder, downloadInvoicePdf, getMyOrders, getOrderById } from "../controllers/user/order.controller";
import { getCheckoutSummary, offerPreview } from "../controllers/user/checkout.controller";


const router = Router();

// OTP flow
router.post("/auth/send-otp", sendSignupOtp);
router.post("/auth/verify-otp", verifySignupOtp);
router.post("/auth/register", registerUserAfterOtp);

// session
router.post("/auth/login", loginUser);
router.post("/auth/logout", logoutUser);
router.get("/auth/me", verifyUser, meUser);

//address
router.get("/addresses", verifyUser, listAddresses);
router.post("/addresses", verifyUser, addAddress);
router.patch("/addresses/:addressId", verifyUser, updateAddress);
router.patch("/addresses/:addressId/default", verifyUser, setDefaultAddress);
router.delete("/addresses/:addressId", verifyUser, deleteAddress);
// Check OUt Summary 
router.get("/checkout/summary", verifyUser, getCheckoutSummary);
router.post("/checkout/offer-preview", verifyUser, offerPreview);
// order
router.post("/orders", verifyUser, createCodOrder);    
router.get("/orders", verifyUser, getMyOrders);
router.get("/orders/:orderId", verifyUser, getOrderById);
router.get("/orders/:orderId/invoice", verifyUser, downloadInvoicePdf);

export default router;
