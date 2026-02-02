/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Order } from "../../models/Order.model"; // ✅ adjust path
import { applyWalletEffectsForOrder } from "../../services/vendorWallet.service";
import {
  adminReleaseVendorPayout,
  adminLogPayoutFailed,
} from "../../services/vendorWallet.payout.service"; // ✅ adjust path (where you kept merged payout file)

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
export const adminGetVendorWallet = async (req: Request, res: Response) => {
  try {
    const vendorId = toStr(req.params.vendorId);
    if (!isValidObjectId(vendorId)) return res.status(400).json({ message: "Invalid vendorId" });

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const wallet = await VendorWallet.findOne({ vendorId: new Types.ObjectId(vendorId) })
      .lean()
      .exec();

    if (!wallet) {
      return res.json({
        message: "Wallet not found (will be auto-created on first credit)",
        data: {
          vendorId,
          balances: { hold: 0, available: 0, paid: 0 },
          stats: { totalCredits: 0, totalDebits: 0, lastTxnAt: null },
          transactions: [],
          page,
          limit,
          totalTxns: 0,
          totalPages: 1,
        },
      });
    }

    const txns = Array.isArray(wallet.transactions) ? wallet.transactions : [];
    const totalTxns = txns.length;
    const slice = txns.slice(skip, skip + limit);

    return res.json({
      message: "Vendor wallet fetched",
      data: {
        vendorId,
        balances: wallet.balances,
        stats: wallet.stats,
        transactions: slice,
        page,
        limit,
        totalTxns,
        totalPages: Math.ceil(totalTxns / limit),
      },
    });
  } catch (e: any) {
    console.error("adminGetVendorWallet error:", e);
    return res.status(500).json({ message: "Failed to fetch wallet", error: e?.message || "Unknown error" });
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

    const filter: any = {};
    if (due) filter["balances.available"] = { $gt: 0 };

    // NOTE: vendor name search requires populate/join; wallet doesn't store vendorName.
    // If you want search by vendorName, either store vendorName snapshot in wallet
    // or query Vendor collection then filter vendorIds.
    // For now, q can match vendorId string (simple).
    if (q && isValidObjectId(q)) filter.vendorId = new Types.ObjectId(q);

    const [items, total] = await Promise.all([
      VendorWallet.find(filter)
        .select("vendorId balances stats updatedAt")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VendorWallet.countDocuments(filter),
    ]);

    return res.json({
      message: "Vendor wallets fetched",
      data: { items, page, limit, total, totalPages: Math.ceil(total / limit) },
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