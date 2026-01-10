"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bcrypt_1 = __importDefault(require("bcrypt"));
const db_js_1 = __importDefault(require("../config/db.js"));
const Admin_model_js_1 = __importDefault(require("../models/Admin.model.js"));
async function seedAdmin() {
    try {
        await (0, db_js_1.default)();
        const email = process.env.ADMIN_EMAIL;
        const password = process.env.ADMIN_PASSWORD;
        if (!email || !password)
            throw new Error("ADMIN_EMAIL or ADMIN_PASSWORD missing in .env");
        const exists = await Admin_model_js_1.default.findOne({ email });
        if (exists) {
            console.log("⚠️ Admin already exists. Skipping seeding...");
            process.exit(0);
        }
        const hashed = await bcrypt_1.default.hash(password, 12);
        await Admin_model_js_1.default.create({
            email,
            password: hashed
        });
        console.log("✅ Admin created successfully!");
        process.exit(0);
    }
    catch (err) {
        console.error("❌ Seeder Error:", err);
        process.exit(1);
    }
}
seedAdmin();
