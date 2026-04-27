"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRunWalletUnlock = exports.adminPayoutFailed = exports.adminListVendorWallets = exports.adminGetVendorWallet = void 0;
exports.adminSyncWalletForOrder = adminSyncWalletForOrder;
const Order_model_1 = require("../../models/Order.model");
const vendorWallet_service_1 = require("../../services/vendorWallet.service");
const Vendor_model_1 = require("../../models/Vendor.model");
const vendorWallet_payout_service_1 = require("../../services/vendorWallet.payout.service");
const vendorWallet_unlock_service_1 = require("../../services/vendorWallet.unlock.service");
const mongoose_1 = require("mongoose");
const VendorWallet_model_1 = require("../../models/VendorWallet.model");
const toStr = (v) => String(v ?? "").trim();
const toNum = (v, fb = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
};
const round2 = (n) => Math.round(n * 100) / 100;
const isValidObjectId = (id) => mongoose_1.Types.ObjectId.isValid(String(id || ""));
const normalizeBalances = (balances) => {
    return {
        hold: toNum(balances?.hold, 0),
        available: toNum(balances?.available, 0),
        paid: toNum(balances?.paid, 0),
        deduction: toNum(balances?.deduction, 0),
    };
};
async function adminSyncWalletForOrder(req, res) {
    try {
        const orderId = String(req.params.orderId || "");
        if (!orderId)
            return res.status(400).json({ message: "orderId required" });
        const order = await Order_model_1.Order.findById(orderId)
            .populate("subOrders.vendorId")
            .populate("subOrders.items.productId");
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        const results = await (0, vendorWallet_service_1.applyWalletEffectsForOrder)(order);
        return res.json({
            message: "Wallet sync applied",
            data: { orderId, orderCode: order.orderCode, results },
        });
    }
    catch (e) {
        return res.status(500).json({ message: e?.message || "Wallet sync failed" });
    }
}
// ----------------------------------------------------
// GET: Vendor wallet summary + txns (admin view)
// GET /api/admin/wallet/vendor/:vendorId
// ----------------------------------------------------
const adminGetVendorWallet = async (req, res) => {
    try {
        const vendorId = toStr(req.params.vendorId);
        if (!isValidObjectId(vendorId))
            return res.status(400).json({ message: "Invalid vendorId" });
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(10, Number(req.query.limit || 20)));
        const skip = (page - 1) * limit;
        const now = new Date();
        const vendor = await Vendor_model_1.Vendor.findById(vendorId)
            .select("name email phone company payment status")
            .lean()
            .exec();
        const wallet = await VendorWallet_model_1.VendorWallet.findOne({ vendorId: new mongoose_1.Types.ObjectId(vendorId) })
            .lean()
            .exec();
        if (!wallet) {
            return res.json({
                message: "Wallet not found (will be auto-created on first credit)",
                data: {
                    vendorId,
                    vendor: vendor || null,
                    wallet: {
                        balances: { hold: 0, available: 0, paid: 0, deduction: 0 },
                        stats: { totalCredits: 0, totalDebits: 0, lastTxnAt: null },
                        summary: {
                            hold: 0,
                            grossAvailable: 0,
                            deduction: 0,
                            netReleasable: 0,
                            paid: 0,
                        },
                    },
                    unlockSummary: {
                        dueHoldAmount: 0,
                        dueHoldCount: 0,
                        nextUnlockAt: null,
                    },
                    transactions: [],
                    page,
                    limit,
                    totalTxns: 0,
                    totalPages: 1,
                },
            });
        }
        const balances = normalizeBalances(wallet?.balances);
        const stats = wallet?.stats || { totalCredits: 0, totalDebits: 0, lastTxnAt: null };
        const grossAvailable = balances.available;
        const deduction = balances.deduction;
        const netReleasable = round2(Math.max(0, grossAvailable - deduction));
        const txns = Array.isArray(wallet.transactions) ? wallet.transactions : [];
        let dueHoldAmount = 0;
        let dueHoldCount = 0;
        let nextUnlockAt = null;
        for (const t of txns) {
            const type = String(t?.type || "");
            const status = String(t?.status || "");
            if (type !== "DELIVERED_HOLD_CREDIT")
                continue;
            if (status !== "HOLD")
                continue;
            const unlockAt = t?.unlockAt ? new Date(t.unlockAt) : null;
            if (!unlockAt)
                continue;
            const amt = Math.max(0, toNum(t?.amount, 0));
            if (unlockAt.getTime() <= now.getTime()) {
                dueHoldAmount += amt;
                dueHoldCount += 1;
            }
            else {
                if (!nextUnlockAt || unlockAt.getTime() < nextUnlockAt.getTime()) {
                    nextUnlockAt = unlockAt;
                }
            }
        }
        const totalTxns = txns.length;
        const slice = txns.slice(skip, skip + limit);
        return res.json({
            message: "Vendor wallet fetched",
            data: {
                vendorId,
                vendor: vendor || null,
                wallet: {
                    balances,
                    stats,
                    summary: {
                        hold: balances.hold,
                        grossAvailable,
                        deduction,
                        netReleasable,
                        paid: balances.paid,
                    },
                },
                unlockSummary: {
                    dueHoldAmount,
                    dueHoldCount,
                    nextUnlockAt,
                },
                transactions: slice,
                page,
                limit,
                totalTxns,
                totalPages: Math.max(1, Math.ceil(totalTxns / limit)),
            },
        });
    }
    catch (e) {
        console.error("adminGetVendorWallet error:", e);
        return res.status(500).json({
            message: "Failed to fetch wallet",
            error: e?.message || "Unknown error",
        });
    }
};
exports.adminGetVendorWallet = adminGetVendorWallet;
// ----------------------------------------------------
// LIST: wallets (admin)
// GET /api/admin/vendor-wallet?due=1
// due=1 => net releasable > 0
// ----------------------------------------------------
const adminListVendorWallets = async (req, res) => {
    try {
        const due = String(req.query.due || "") === "1";
        const q = toStr(req.query.q);
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(10, Number(req.query.limit || 20)));
        const skip = (page - 1) * limit;
        const match = {};
        if (q) {
            if (isValidObjectId(q)) {
                match._id = new mongoose_1.Types.ObjectId(q);
            }
            else {
                match.$or = [
                    { "name.first": { $regex: q, $options: "i" } },
                    { "name.last": { $regex: q, $options: "i" } },
                    { email: { $regex: q, $options: "i" } },
                    { phone: { $regex: q, $options: "i" } },
                    { "company.name": { $regex: q, $options: "i" } },
                ];
            }
        }
        const pipeline = [
            { $match: match },
            {
                $lookup: {
                    from: "vendorwallets",
                    localField: "_id",
                    foreignField: "vendorId",
                    as: "wallet",
                },
            },
            { $unwind: { path: "$wallet", preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    walletHold: { $ifNull: ["$wallet.balances.hold", 0] },
                    walletAvailable: { $ifNull: ["$wallet.balances.available", 0] },
                    walletPaid: { $ifNull: ["$wallet.balances.paid", 0] },
                    walletDeduction: { $ifNull: ["$wallet.balances.deduction", 0] },
                },
            },
            {
                $addFields: {
                    walletNetReleasable: {
                        $max: [
                            0,
                            {
                                $subtract: ["$walletAvailable", "$walletDeduction"],
                            },
                        ],
                    },
                },
            },
        ];
        if (due) {
            pipeline.push({
                $match: { walletNetReleasable: { $gt: 0 } },
            });
        }
        pipeline.push({ $sort: { "wallet.updatedAt": -1, createdAt: -1 } }, {
            $project: {
                _id: 0,
                vendorId: "$_id",
                name: {
                    first: "$name.first",
                    last: "$name.last",
                },
                email: 1,
                phone: 1,
                company: {
                    name: "$company.name",
                    email: "$company.email",
                    gst: "$company.gst",
                },
                payment: {
                    upiId: "$payment.upiId",
                    bankAccount: "$payment.bankAccount",
                    ifsc: "$payment.ifsc",
                    qrImage: "$payment.qrImage",
                },
                status: 1,
                wallet: {
                    walletId: "$wallet._id",
                    balances: {
                        hold: "$walletHold",
                        available: "$walletAvailable",
                        paid: "$walletPaid",
                        deduction: "$walletDeduction",
                    },
                    summary: {
                        hold: "$walletHold",
                        grossAvailable: "$walletAvailable",
                        deduction: "$walletDeduction",
                        netReleasable: "$walletNetReleasable",
                        paid: "$walletPaid",
                    },
                    stats: "$wallet.stats",
                    updatedAt: "$wallet.updatedAt",
                },
                createdAt: 1,
                updatedAt: 1,
            },
        });
        const countPipeline = [...pipeline, { $count: "total" }];
        const itemsPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];
        const [items, countArr] = await Promise.all([
            Vendor_model_1.Vendor.aggregate(itemsPipeline),
            Vendor_model_1.Vendor.aggregate(countPipeline),
        ]);
        const total = Number(countArr?.[0]?.total || 0);
        return res.json({
            message: "Vendor wallets fetched",
            data: { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        });
    }
    catch (e) {
        console.error("adminListVendorWallets error:", e);
        return res.status(500).json({ message: "Failed to fetch wallets", error: e?.message || "Unknown error" });
    }
};
exports.adminListVendorWallets = adminListVendorWallets;
// ----------------------------------------------------
// POST: Log payout failed
// POST /api/admin/vendor-wallet/payout/failed
// ----------------------------------------------------
const adminPayoutFailed = async (req, res) => {
    try {
        const vendorId = toStr(req.body.vendorId);
        if (!isValidObjectId(vendorId))
            return res.status(400).json({ message: "Invalid vendorId" });
        const amount = Math.max(0, toNum(req.body.amount, 0));
        if (!amount)
            return res.status(400).json({ message: "amount required" });
        const method = toStr(req.body.method).toUpperCase() || "MANUAL";
        const reference = toStr(req.body.reference);
        const manualKey = toStr(req.body.manualKey);
        const reason = toStr(req.body.reason);
        const result = await (0, vendorWallet_payout_service_1.adminLogPayoutFailed)({
            vendorId,
            amount,
            method: method,
            reference: reference || undefined,
            manualKey: manualKey || undefined,
            reason: reason || "Payout failed",
            meta: {
                byAdminId: req?.admin?._id || null,
                byAdminEmail: req?.admin?.email || null,
            },
        });
        if (!result?.ok)
            return res.status(400).json({ message: "Payout failed log error", data: result });
        return res.json({ message: "Payout failure logged", data: result });
    }
    catch (e) {
        console.error("adminPayoutFailed error:", e);
        return res.status(500).json({ message: "Payout failed error", error: e?.message || "Unknown error" });
    }
};
exports.adminPayoutFailed = adminPayoutFailed;
// ----------------------------------------------------
// POST/GET: Run unlock job
// GET /api/admin/vendor-wallet/unlock
// ----------------------------------------------------
const adminRunWalletUnlock = async (_req, res) => {
    try {
        const result = await (0, vendorWallet_unlock_service_1.unlockDueHoldToAvailable)(new Date());
        return res.json({ message: "Wallet unlock executed", data: result });
    }
    catch (e) {
        console.error("adminRunWalletUnlock error:", e);
        return res.status(500).json({ message: "Unlock failed", error: e?.message || "Unknown error" });
    }
};
exports.adminRunWalletUnlock = adminRunWalletUnlock;
