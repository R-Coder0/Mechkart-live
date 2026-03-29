/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Order } from "../../models/Order.model";
import { applyWalletEffectsForOrder } from "../../services/vendorWallet.service";
import { Vendor } from "../../models/Vendor.model";
import { adminLogPayoutFailed } from "../../services/vendorWallet.payout.service";
import { unlockDueHoldToAvailable } from "../../services/vendorWallet.unlock.service";

import { Types } from "mongoose";
import { VendorWallet } from "../../models/VendorWallet.model";

const toStr = (v: any) => String(v ?? "").trim();

const toNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const isValidObjectId = (id: any) => Types.ObjectId.isValid(String(id || ""));

const normalizeBalances = (balances: any) => {
  return {
    hold: toNum(balances?.hold, 0),
    available: toNum(balances?.available, 0),
    paid: toNum(balances?.paid, 0),
    deduction: toNum(balances?.deduction, 0),
  };
};

export async function adminSyncWalletForOrder(req: Request, res: Response) {
  try {
    const orderId = String(req.params.orderId || "");
    if (!orderId) return res.status(400).json({ message: "orderId required" });

    const order = await Order.findById(orderId)
      .populate("subOrders.vendorId")
      .populate("subOrders.items.productId");

    if (!order) return res.status(404).json({ message: "Order not found" });

    const results = await applyWalletEffectsForOrder(order);

    return res.json({
      message: "Wallet sync applied",
      data: { orderId, orderCode: order.orderCode, results },
    });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Wallet sync failed" });
  }
}

// ----------------------------------------------------
// GET: Vendor wallet summary + txns (admin view)
// GET /api/admin/wallet/vendor/:vendorId
// ----------------------------------------------------
export const adminGetVendorWallet = async (req: Request, res: Response) => {
  try {
    const vendorId = toStr(req.params.vendorId);
    if (!isValidObjectId(vendorId)) return res.status(400).json({ message: "Invalid vendorId" });

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const now = new Date();

    const vendor = await Vendor.findById(vendorId)
      .select("name email phone company payment status")
      .lean()
      .exec();

    const wallet = await VendorWallet.findOne({ vendorId: new Types.ObjectId(vendorId) })
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
    let nextUnlockAt: Date | null = null;

    for (const t of txns) {
      const type = String(t?.type || "");
      const status = String(t?.status || "");
      if (type !== "DELIVERED_HOLD_CREDIT") continue;
      if (status !== "HOLD") continue;

      const unlockAt = t?.unlockAt ? new Date(t.unlockAt) : null;
      if (!unlockAt) continue;

      const amt = Math.max(0, toNum(t?.amount, 0));
      if (unlockAt.getTime() <= now.getTime()) {
        dueHoldAmount += amt;
        dueHoldCount += 1;
      } else {
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
  } catch (e: any) {
    console.error("adminGetVendorWallet error:", e);
    return res.status(500).json({
      message: "Failed to fetch wallet",
      error: e?.message || "Unknown error",
    });
  }
};

// ----------------------------------------------------
// LIST: wallets (admin)
// GET /api/admin/vendor-wallet?due=1
// due=1 => net releasable > 0
// ----------------------------------------------------
export const adminListVendorWallets = async (req: Request, res: Response) => {
  try {
    const due = String(req.query.due || "") === "1";
    const q = toStr(req.query.q);

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const match: any = {};
    if (q) {
      if (isValidObjectId(q)) {
        match._id = new Types.ObjectId(q);
      } else {
        match.$or = [
          { "name.first": { $regex: q, $options: "i" } },
          { "name.last": { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
          { phone: { $regex: q, $options: "i" } },
          { "company.name": { $regex: q, $options: "i" } },
        ];
      }
    }

    const pipeline: any[] = [
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

    pipeline.push(
      { $sort: { "wallet.updatedAt": -1, createdAt: -1 } },
      {
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
      }
    );

    const countPipeline = [...pipeline, { $count: "total" }];
    const itemsPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [items, countArr] = await Promise.all([
      Vendor.aggregate(itemsPipeline),
      Vendor.aggregate(countPipeline),
    ]);

    const total = Number(countArr?.[0]?.total || 0);

    return res.json({
      message: "Vendor wallets fetched",
      data: { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (e: any) {
    console.error("adminListVendorWallets error:", e);
    return res.status(500).json({ message: "Failed to fetch wallets", error: e?.message || "Unknown error" });
  }
};

// ----------------------------------------------------
// POST: Log payout failed
// POST /api/admin/vendor-wallet/payout/failed
// ----------------------------------------------------
export const adminPayoutFailed = async (req: Request, res: Response) => {
  try {
    const vendorId = toStr(req.body.vendorId);
    if (!isValidObjectId(vendorId)) return res.status(400).json({ message: "Invalid vendorId" });

    const amount = Math.max(0, toNum(req.body.amount, 0));
    if (!amount) return res.status(400).json({ message: "amount required" });

    const method = toStr(req.body.method).toUpperCase() || "MANUAL";
    const reference = toStr(req.body.reference);
    const manualKey = toStr(req.body.manualKey);
    const reason = toStr(req.body.reason);

    const result = await adminLogPayoutFailed({
      vendorId,
      amount,
      method: method as any,
      reference: reference || undefined,
      manualKey: manualKey || undefined,
      reason: reason || "Payout failed",
      meta: {
        byAdminId: (req as any)?.admin?._id || null,
        byAdminEmail: (req as any)?.admin?.email || null,
      },
    });

    if (!result?.ok) return res.status(400).json({ message: "Payout failed log error", data: result });

    return res.json({ message: "Payout failure logged", data: result });
  } catch (e: any) {
    console.error("adminPayoutFailed error:", e);
    return res.status(500).json({ message: "Payout failed error", error: e?.message || "Unknown error" });
  }
};

// ----------------------------------------------------
// POST/GET: Run unlock job
// GET /api/admin/vendor-wallet/unlock
// ----------------------------------------------------
export const adminRunWalletUnlock = async (_req: Request, res: Response) => {
  try {
    const result = await unlockDueHoldToAvailable(new Date());
    return res.json({ message: "Wallet unlock executed", data: result });
  } catch (e: any) {
    console.error("adminRunWalletUnlock error:", e);
    return res.status(500).json({ message: "Unlock failed", error: e?.message || "Unknown error" });
  }
};