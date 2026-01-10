"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_routes_js_1 = __importDefault(require("./admin.routes.js"));
const common_routes_js_1 = __importDefault(require("./common.routes.js"));
const user_routes_js_1 = __importDefault(require("./user.routes.js"));
const router = (0, express_1.Router)();
// test route
router.get("/", (req, res) => {
    res.send("API is working 😎");
});
router.use("/admin", admin_routes_js_1.default);
router.use("/common", common_routes_js_1.default);
router.use("/users", user_routes_js_1.default);
exports.default = router;
