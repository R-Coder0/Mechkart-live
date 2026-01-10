"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config"); // must be first, loads .env
const app_js_1 = __importDefault(require("./app.js"));
const PORT = process.env.PORT || 5000;
app_js_1.default.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
