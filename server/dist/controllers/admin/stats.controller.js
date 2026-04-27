"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminNotificationCounts = exports.getAdminStats = void 0;
const Order_model_js_1 = require("../../models/Order.model.js");
const Product_model_js_1 = require("../../models/Product.model.js");
const User_model_js_1 = require("../../models/User.model.js");
const Vendor_model_js_1 = require("../../models/Vendor.model.js");
const getAdminStats = async (req, res) => {
    try {
        // Total Counts
        const totalUsers = await User_model_js_1.User.countDocuments();
        const totalVendors = await Vendor_model_js_1.Vendor.countDocuments();
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
const getAdminNotificationCounts = async (_req, res) => {
    try {
        const [pendingVendorCount, approvedVendorCount, rejectedVendorCount, disabledVendorCount, allVendorCount, pendingVendorProductCount, approvedVendorProductCount, rejectedVendorProductCount, allVendorProductCount, newOrderCount, confirmedOrderCount, shippedOrderCount, allOrderCount, requestedReturnCount,] = await Promise.all([
            Vendor_model_js_1.Vendor.countDocuments({ status: "PENDING" }),
            Vendor_model_js_1.Vendor.countDocuments({ status: "APPROVED" }),
            Vendor_model_js_1.Vendor.countDocuments({ status: "REJECTED" }),
            Vendor_model_js_1.Vendor.countDocuments({ status: "DISABLED" }),
            Vendor_model_js_1.Vendor.countDocuments(),
            Product_model_js_1.Product.countDocuments({ ownerType: "VENDOR", approvalStatus: "PENDING" }),
            Product_model_js_1.Product.countDocuments({ ownerType: "VENDOR", approvalStatus: "APPROVED" }),
            Product_model_js_1.Product.countDocuments({ ownerType: "VENDOR", approvalStatus: "REJECTED" }),
            Product_model_js_1.Product.countDocuments({ ownerType: "VENDOR" }),
            Order_model_js_1.Order.countDocuments({ status: "PLACED" }),
            Order_model_js_1.Order.countDocuments({ status: "CONFIRMED" }),
            Order_model_js_1.Order.countDocuments({ status: "SHIPPED" }),
            Order_model_js_1.Order.countDocuments(),
            Order_model_js_1.Order.aggregate([
                { $unwind: "$subOrders" },
                {
                    $project: {
                        returns: {
                            $ifNull: ["$subOrders.returns", []],
                        },
                    },
                },
                { $unwind: "$returns" },
                { $match: { "returns.status": "REQUESTED" } },
                { $count: "total" },
            ]),
        ]);
        const returnCount = Array.isArray(requestedReturnCount)
            ? Number(requestedReturnCount[0]?.total || 0)
            : 0;
        return res.json({
            message: "Admin notification counts fetched successfully",
            data: {
                sidebar: {
                    vendorsPending: pendingVendorCount,
                    vendorProductsPending: pendingVendorProductCount,
                    newOrders: newOrderCount,
                    returnsRequested: returnCount,
                },
                vendors: {
                    ALL: allVendorCount,
                    PENDING: pendingVendorCount,
                    APPROVED: approvedVendorCount,
                    REJECTED: rejectedVendorCount,
                    DISABLED: disabledVendorCount,
                },
                vendorProducts: {
                    ALL: allVendorProductCount,
                    PENDING: pendingVendorProductCount,
                    APPROVED: approvedVendorProductCount,
                    REJECTED: rejectedVendorProductCount,
                },
                orders: {
                    ALL: allOrderCount,
                    PLACED: newOrderCount,
                    CONFIRMED: confirmedOrderCount,
                    SHIPPED: shippedOrderCount,
                },
                returns: {
                    REQUESTED: returnCount,
                },
            },
        });
    }
    catch (err) {
        console.error("Admin notification counts error:", err);
        return res.status(500).json({
            message: "Failed to fetch admin notification counts",
            error: err?.message || "Unknown error",
        });
    }
};
exports.getAdminNotificationCounts = getAdminNotificationCounts;
