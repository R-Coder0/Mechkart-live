"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminStats = void 0;
const Order_model_js_1 = require("../../models/Order.model.js");
const Product_model_js_1 = require("../../models/Product.model.js");
const User_model_js_1 = require("../../models/User.model.js");
const Vendor_model_js_1 = __importDefault(require("../../models/Vendor.model.js"));
const getAdminStats = async (req, res) => {
    try {
        // Total Counts
        const totalUsers = await User_model_js_1.User.countDocuments();
        const totalVendors = await Vendor_model_js_1.default.countDocuments();
        const totalProducts = await Product_model_js_1.Product.countDocuments();
        const totalOrders = await Order_model_js_1.Order.countDocuments();
        // Total Revenue
        const revenueAgg = await Order_model_js_1.Order.aggregate([
            { $match: { paymentStatus: "paid" } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]);
        const totalRevenue = revenueAgg[0]?.total || 0;
        // Today Revenue
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayRevenueAgg = await Order_model_js_1.Order.aggregate([
            { $match: { paymentStatus: "paid", createdAt: { $gte: today } } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]);
        const todayRevenue = todayRevenueAgg[0]?.total || 0;
        // Weekly Revenue Chart
        const last7Days = await Order_model_js_1.Order.aggregate([
            {
                $match: {
                    paymentStatus: "paid",
                    createdAt: {
                        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                }
            },
            {
                $group: {
                    _id: { $dayOfWeek: "$createdAt" },
                    total: { $sum: "$totalAmount" }
                }
            },
            { $sort: { "_id": 1 } }
        ]);
        // Low Stock Products
        const lowStock = await Product_model_js_1.Product.find({ stock: { $lt: 10 } })
            .select("name stock");
        res.json({
            message: "Stats fetched successfully",
            data: {
                totalUsers,
                totalVendors,
                totalProducts,
                totalOrders,
                totalRevenue,
                todayRevenue,
                weeklyRevenue: last7Days,
                lowStock,
            },
        });
    }
    catch (err) {
        console.error("Stats Error:", err);
        res.status(500).json({ message: "Stats failed", error: err.message });
    }
};
exports.getAdminStats = getAdminStats;
