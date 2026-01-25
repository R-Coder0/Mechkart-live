import { Order } from "../../models/Order.model.js";
import {Product} from "../../models/Product.model.js";
import { User } from "../../models/User.model.js";
import { Vendor } from "../../models/Vendor.model.js";

export const getAdminStats = async (req, res) => {
  try {
    // Total Counts
    const totalUsers = await User.countDocuments();
    const totalVendors = await Vendor.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();

    // Total Revenue
    const revenueAgg = await Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);
    const totalRevenue = revenueAgg[0]?.total || 0;

    // Today Revenue
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRevenueAgg = await Order.aggregate([
      { $match: { paymentStatus: "paid", createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);
    const todayRevenue = todayRevenueAgg[0]?.total || 0;

    // Weekly Revenue Chart
    const last7Days = await Order.aggregate([
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
    const lowStock = await Product.find({ stock: { $lt: 10 } })
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
  } catch (err) {
    console.error("Stats Error:", err);
    res.status(500).json({ message: "Stats failed", error: err.message });
  }
};
