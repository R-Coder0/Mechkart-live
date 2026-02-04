/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Order } from "../../models/Order.model"; // ✅ adjust path
import { applyWalletEffectsForOrder } from "../../services/vendorWallet.service";
import { Vendor } from "../../models/Vendor.model";
import {
  adminReleaseVendorPayout,
  adminLogPayoutFailed,
} from "../../services/vendorWallet.payout.service";
// ✅ adjust path (where you kept merged payout file)

import { unlockDueHoldToAvailable } from "../../services/vendorWallet.unlock.service"; // ✅ your unlock service

import { Types } from "mongoose";
import { VendorWallet } from "../../models/VendorWallet.model";
const toStr = (v: any) => String(v ?? "").trim();
const toNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const isValidObjectId = (id: any) => Types.ObjectId.isValid(String(id || ""));


export async function adminSyncWalletForOrder(req: Request, res: Response) {
  try {
    const orderId = String(req.params.orderId || "");
    if (!orderId) return res.status(400).json({ message: "orderId required" });

    const order = await Order.findById(orderId)
      .populate("subOrders.vendorId") // ok if you use ref; else remove
      .populate("subOrders.items.productId"); // optional (for totals not needed)

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
// GET /api/admin/vendor-wallet/:vendorId
// ----------------------------------------------------
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

    // ✅ fetch vendor details (so payout box works)
    const vendor = await Vendor.findById(vendorId)
      .select("name email phone company payment status")
      .lean()
      .exec();

    const wallet = await VendorWallet.findOne({ vendorId: new Types.ObjectId(vendorId) })
      .lean()
      .exec();

    // ✅ if no wallet yet
    if (!wallet) {
      return res.json({
        message: "Wallet not found (will be auto-created on first credit)",
        data: {
          vendorId,
          vendor: vendor || null,
          wallet: {
            balances: { hold: 0, available: 0, paid: 0 },
            stats: { totalCredits: 0, totalDebits: 0, lastTxnAt: null },
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

    const txns = Array.isArray(wallet.transactions) ? wallet.transactions : [];

    // ✅ Unlock summary compute
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
        vendor: vendor || null, // ✅ NOW payout details show again
        wallet: {
          balances: wallet.balances || { hold: 0, available: 0, paid: 0 },
          stats: wallet.stats || { totalCredits: 0, totalDebits: 0, lastTxnAt: null },
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
// LIST: wallets (admin) - optional filters (due payouts)
// GET /api/admin/vendor-wallet?due=1
// due=1 => available > 0
// ----------------------------------------------------
export const adminListVendorWallets = async (req: Request, res: Response) => {
  try {
    const due = String(req.query.due || "") === "1";
    const q = toStr(req.query.q);

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    // ---- vendor search filter ----
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

    // ---- aggregation from Vendor -> lookup wallet ----
    const pipeline: any[] = [
      { $match: match },

      // join wallet by vendorId
      {
        $lookup: {
          from: "vendorwallets", // collection name (lowercase plural by mongoose)
          localField: "_id",
          foreignField: "vendorId",
          as: "wallet",
        },
      },
      { $unwind: { path: "$wallet", preserveNullAndEmptyArrays: true } },
    ];

    // due filter uses wallet.balances.available
    if (due) {
      pipeline.push({
        $match: { "wallet.balances.available": { $gt: 0 } },
      });
    }

    // sorting: prioritize wallets updated, fallback vendor createdAt
    pipeline.push(
      { $sort: { "wallet.updatedAt": -1, createdAt: -1 } },
      {
        $project: {
          _id: 0,

          // ✅ IMPORTANT: always return real vendorId
          vendorId: "$_id",

          // vendor identity
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

          // payment details for payout screen
          payment: {
            upiId: "$payment.upiId",
            bankAccount: "$payment.bankAccount",
            ifsc: "$payment.ifsc",
            qrImage: "$payment.qrImage",
          },

          status: 1,

          // wallet snapshot (if missing => zeros)
          wallet: {
            walletId: "$wallet._id",
            balances: {
              hold: { $ifNull: ["$wallet.balances.hold", 0] },
              available: { $ifNull: ["$wallet.balances.available", 0] },
              paid: { $ifNull: ["$wallet.balances.paid", 0] },
            },
            stats: "$wallet.stats",
            updatedAt: "$wallet.updatedAt",
          },

          createdAt: 1,
          updatedAt: 1,
        },
      }
    );

    // total count (same pipeline without pagination)
    const countPipeline = [...pipeline, { $count: "total" }];

    // pagination
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


// // ----------------------------------------------------
// // POST: Release payout (AVAILABLE -> PAID)
// // POST /api/admin/vendor-wallet/payout/release
// // body: { vendorId, amount?, method?, reference?, manualKey?, note? }
// // amount blank => full available payout
// // ----------------------------------------------------
// export const adminPayoutRelease = async (req: Request, res: Response) => {
//   try {
//     const vendorId = toStr(req.body.vendorId);
//     if (!isValidObjectId(vendorId)) return res.status(400).json({ message: "Invalid vendorId" });

//     const method = toStr(req.body.method).toUpperCase() || "MANUAL";
//     const reference = toStr(req.body.reference);
//     const manualKey = toStr(req.body.manualKey);
//     const note = toStr(req.body.note);

//     // amount optional
//     const amountRaw = req.body.amount;
//     const amount =
//       amountRaw === undefined || amountRaw === null || (typeof amountRaw === "string" && !String(amountRaw).trim())
//         ? undefined
//         : toNum(amountRaw, 0);

//     const result = await adminReleaseVendorPayout({
//       vendorId,
//       amount,
//       method: method as any,
//       reference: reference || undefined,
//       manualKey: manualKey || undefined,
//       note: note || undefined,
//       meta: {
//         byAdminId: (req as any)?.admin?._id || null,
//         byAdminEmail: (req as any)?.admin?.email || null,
//       },
//     });

//     if (!result?.ok) return res.status(400).json({ message: "Payout release failed", data: result });

//     return res.json({ message: "Payout released", data: result });
//   } catch (e: any) {
//     console.error("adminPayoutRelease error:", e);
//     return res.status(500).json({ message: "Payout release error", error: e?.message || "Unknown error" });
//   }
// };

// ----------------------------------------------------
// POST: Log payout failed (NO balance change, only txn log)
// POST /api/admin/vendor-wallet/payout/failed
// body: { vendorId, amount, method?, reference?, manualKey?, reason? }
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
// POST/GET: Run unlock job (HOLD -> AVAILABLE when unlockAt <= now)
// GET /api/admin/vendor-wallet/unlock?limit=100
// ----------------------------------------------------
export const adminRunWalletUnlock = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
    const result = await unlockDueHoldToAvailable({ limit });
    return res.json({ message: "Wallet unlock executed", data: result });
  } catch (e: any) {
    console.error("adminRunWalletUnlock error:", e);
    return res.status(500).json({ message: "Unlock failed", error: e?.message || "Unknown error" });
  }
};