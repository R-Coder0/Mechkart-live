"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const base = path_1.default.join(process.cwd(), "src");
const structure = {
    "controllers/admin/auth.controller.ts": `export const adminLogin = (req, res) => {};`,
    "controllers/admin/product.controller.ts": `export const adminProduct = (req, res) => {};`,
    "controllers/admin/order.controller.ts": `export const adminOrders = (req, res) => {};`,
    "controllers/admin/dashboard.controller.ts": `export const adminDashboard = (req, res) => {};`,
    "controllers/user/user.controller.ts": `export const userCtrl = (req, res) => {};`,
    "controllers/vendor/vendor.controller.ts": `export const vendorCtrl = (req, res) => {};`,
    "controllers/common/common.controller.ts": `export const commonCtrl = (req, res) => {};`,
    "middleware/auth.middleware.ts": `export const auth = (req, res, next) => { next(); };`,
    "middleware/error.middleware.ts": `export const errorHandler = (err, req, res, next) => { res.status(500).json({ msg: err.message }); };`,
    "middleware/upload.middleware.ts": `export const upload = () => {};`,
    "models/User.model.ts": `const user = {}; export default user;`,
    "models/Admin.model.ts": `const admin = {}; export default admin;`,
    "models/Vendor.model.ts": `const vendor = {}; export default vendor;`,
    "models/Product.model.ts": `const product = {}; export default product;`,
    "models/Category.model.ts": `const category = {}; export default category;`,
    "models/Order.model.ts": `const order = {}; export default order;`,
    "routes/admin.routes.ts": `import { Router } from "express"; const router = Router(); export default router;`,
    "routes/user.routes.ts": `import { Router } from "express"; const router = Router(); export default router;`,
    "routes/vendor.routes.ts": `import { Router } from "express"; const router = Router(); export default router;`,
    "routes/index.ts": `import { Router } from "express"; const router = Router(); export default router;`,
    "utils/response.ts": `export const sendResponse = (res, status, data) => res.status(status).json(data);`,
    "utils/jwt.ts": `export const signToken = () => {};`,
    "utils/logger.ts": `export const logger = console.log;`,
    "utils/email.ts": `export const sendEmail = () => {};`
};
function createFiles() {
    Object.keys(structure).forEach((filePath) => {
        const fullPath = path_1.default.join(base, filePath);
        const dir = path_1.default.dirname(fullPath);
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
        if (!fs_1.default.existsSync(fullPath)) {
            fs_1.default.writeFileSync(fullPath, structure[filePath]);
            console.log("📁 Created:", filePath);
        }
        else {
            console.log("⚠️ Skipped (exists):", filePath);
        }
    });
    console.log("\n🎉 All backend files generated successfully!");
}
createFiles();
