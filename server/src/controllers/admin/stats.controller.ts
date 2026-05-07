import { Order } from "../../models/Order.model.js";
import {Product} from "../../models/Product.model.js";
import { User } from "../../models/User.model.js";
import { Vendor } from "../../models/Vendor.model.js";

const ORDER_STATUSES = ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];
const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "COD_PENDING_CONFIRMATION"];
const orderTotalExpr = {
  $ifNull: [
    "$totals.grandTotal",
    {
      $ifNull: ["$totalAmount", { $ifNull: ["$totals.subtotal", 0] }],
    },
  ],
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shortDay(date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function countMap(rows, keys) {
  const base = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const row of rows || []) {
    if (row?._id) base[row._id] = Number(row.count || 0);
  }
  return base;
}

export const getAdminStats = async (req, res) => {
  try {
    const today = startOfToday();
    const sevenDaysAgo = addDays(today, -6);
    const revenueMatch = { paymentStatus: "PAID", status: { $ne: "CANCELLED" } };

    const [
      totalUsers,
      totalVendors,
      pendingVendors,
      totalProducts,
      activeProducts,
      pendingVendorProducts,
      totalOrders,
      todayOrders,
      revenueAgg,
      todayRevenueAgg,
      weeklyAgg,
      orderStatusAgg,
      paymentStatusAgg,
      lowStock,
      latestOrders,
    ] = await Promise.all([
      User.countDocuments(),
      Vendor.countDocuments(),
      Vendor.countDocuments({ status: "PENDING" }),
      Product.countDocuments(),
      Product.countDocuments({ isActive: true, approvalStatus: "APPROVED" }),
      Product.countDocuments({ ownerType: "VENDOR", approvalStatus: "PENDING" }),
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.aggregate([
        { $match: revenueMatch },
        { $group: { _id: null, total: { $sum: orderTotalExpr }, orders: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { ...revenueMatch, createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: orderTotalExpr }, orders: { $sum: 1 } } },
      ]),
      Order.aggregate([
      {
        $match: {
            ...revenueMatch,
            createdAt: { $gte: sevenDaysAgo },
          },
      },
      {
        $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "Asia/Kolkata",
              },
            },
            total: { $sum: orderTotalExpr },
            orders: { $sum: 1 },
          },
        },
      { $sort: { "_id": 1 } }
      ]),
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Order.aggregate([{ $group: { _id: "$paymentStatus", count: { $sum: 1 } } }]),
      Product.find({
        isActive: true,
        approvalStatus: "APPROVED",
        $or: [{ isLowStock: true }, { totalStock: { $lte: 10 } }],
      })
        .select("productId title totalStock lowStockThreshold ownerType vendorId")
        .sort({ totalStock: 1, updatedAt: -1 })
        .limit(8)
        .lean(),
      Order.find()
        .select("orderCode contact totals paymentMethod paymentStatus status createdAt")
        .sort({ createdAt: -1, _id: -1 })
        .limit(8)
        .lean(),
    ]);

    const totalRevenue = Number(revenueAgg[0]?.total || 0);
    const todayRevenue = Number(todayRevenueAgg[0]?.total || 0);
    const weeklyByDate = Object.fromEntries((weeklyAgg || []).map((row) => [row._id, row]));
    const weeklyRevenue = Array.from({ length: 7 }).map((_, idx) => {
      const date = addDays(sevenDaysAgo, idx);
      const key = dateKey(date);
      const row = weeklyByDate[key] || {};
      return {
        _id: key,
        day: shortDay(date),
        total: Number(row.total || 0),
        orders: Number(row.orders || 0),
      };
    });

    res.json({
      message: "Stats fetched successfully",
      data: {
        totalUsers,
        totalVendors,
        pendingVendors,
        totalProducts,
        activeProducts,
        pendingVendorProducts,
        totalOrders,
        todayOrders,
        totalRevenue,
        todayRevenue,
        paidOrders: Number(revenueAgg[0]?.orders || 0),
        todayPaidOrders: Number(todayRevenueAgg[0]?.orders || 0),
        orderStatusCounts: countMap(orderStatusAgg, ORDER_STATUSES),
        paymentStatusCounts: countMap(paymentStatusAgg, PAYMENT_STATUSES),
        weeklyRevenue,
        lowStock,
        latestOrders,
      },
    });
  } catch (err) {
    console.error("Stats Error:", err);
    res.status(500).json({ message: "Stats failed", error: err?.message || "Unknown error" });
  }
};

export const getAdminNotificationCounts = async (_req, res) => {
  try {
    const [
      pendingVendorCount,
      approvedVendorCount,
      rejectedVendorCount,
      disabledVendorCount,
      allVendorCount,

      pendingVendorProductCount,
      approvedVendorProductCount,
      rejectedVendorProductCount,
      allVendorProductCount,

      newOrderCount,
      confirmedOrderCount,
      shippedOrderCount,
      allOrderCount,

      requestedReturnCount,
    ] = await Promise.all([
      Vendor.countDocuments({ status: "PENDING" }),
      Vendor.countDocuments({ status: "APPROVED" }),
      Vendor.countDocuments({ status: "REJECTED" }),
      Vendor.countDocuments({ status: "DISABLED" }),
      Vendor.countDocuments(),

      Product.countDocuments({ ownerType: "VENDOR", approvalStatus: "PENDING" }),
      Product.countDocuments({ ownerType: "VENDOR", approvalStatus: "APPROVED" }),
      Product.countDocuments({ ownerType: "VENDOR", approvalStatus: "REJECTED" }),
      Product.countDocuments({ ownerType: "VENDOR" }),

      Order.countDocuments({ status: "PLACED" }),
      Order.countDocuments({ status: "CONFIRMED" }),
      Order.countDocuments({ status: "SHIPPED" }),
      Order.countDocuments(),

      Order.aggregate([
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
  } catch (err) {
    console.error("Admin notification counts error:", err);
    return res.status(500).json({
      message: "Failed to fetch admin notification counts",
      error: err?.message || "Unknown error",
    });
  }
};
