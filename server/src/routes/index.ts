import { Router } from "express";
import adminRoutes from "./admin.routes.js";
import commonRoutes from "./common.routes.js";
import userRoutes from "./user.routes.js";
import vendorRoutes from "./vendor.routes.js";

const router = Router();

// test route
router.get("/", (req, res) => {
  res.send("API is working 😎");
});
router.use("/admin", adminRoutes);
router.use("/common", commonRoutes);
router.use("/users", userRoutes);
router.use("/vendors", vendorRoutes);
export default router;
