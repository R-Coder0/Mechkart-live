"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = connectDB;
const mongoose_1 = __importDefault(require("mongoose"));
async function connectDB() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("❌ MONGO_URI missing in .env");
        }
        await mongoose_1.default.connect(process.env.MONGO_URI);
        console.log("🟢 MongoDB Connected");
    }
    catch (err) {
        console.error("🔴 MongoDB Connection Error", err);
    }
}
