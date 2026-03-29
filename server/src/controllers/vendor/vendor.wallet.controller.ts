/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { VendorWallet } from "../../models/VendorWallet.model";

const toNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function toObjectId(id: any) {
  if (!id) return null;
  const s = String(id);
  if (!Types.ObjectId.isValid(s)) return null;
  return new Types.ObjectId(s);
}

function normalizeBalances(balances: any) {
  return {
    hold: toNum(balances?.hold, 0),
    available: toNum(balances?.available, 0),
    paid: toNum(balances?.paid, 0),
    deduction: toNum(balances?.deduction, 0),
  };
}

/**
 * Vendor: GET /api/vendors/wallet
 * Query:
 *  - page (default 1)
 *  - limit (default 20, max 100)
 *  - status (optional: HOLD|AVAILABLE|PAID|REVERSED|FAILED)
 *  - type (optional)
 */
export const vendorGetMyWallet = async (req: Request, res: Response) => {
  try {
    const vendorIdRaw = (req as any)?.vendor?._id || (req as any)?.vendorId;
    const vid = toObjectId(vendorIdRaw);
    if (!vid) return res.status(401).json({ message: "Unauthorized (vendor)" });

    const page = Math.max(1, toNum(req.query.page, 1));
    const limit = Math.min(100, Math.max(5, toNum(req.query.limit, 20)));
    const skip = (page - 1) * limit;

    const status = String(req.query.status || "").toUpperCase().trim();
    const type = String(req.query.type || "").toUpperCase().trim();

    let wallet: any = await VendorWallet.findOne({ vendorId: vid }).lean();

    if (!wallet) {
      const created = await VendorWallet.create({
        vendorId: vid,
        balances: { hold: 0, available: 0, paid: 0, deduction: 0 },
        transactions: [],
        stats: { totalCredits: 0, totalDebits: 0, lastTxnAt: new Date() },
      });
      wallet = created.toObject();
    }

    const balances = normalizeBalances(wallet?.balances);
    const stats = wallet?.stats || { totalCredits: 0, totalDebits: 0, lastTxnAt: null };

    const grossAvailable = balances.available;
    const deduction = balances.deduction;
    const netReleasable = round2(Math.max(0, grossAvailable - deduction));

    const allTxns = Array.isArray(wallet?.transactions) ? wallet.transactions : [];

    let filtered = allTxns;
    if (status) {
      filtered = filtered.filter((t: any) => String(t?.status || "").toUpperCase() === status);
    }
    if (type) {
      filtered = filtered.filter((t: any) => String(t?.type || "").toUpperCase() === type);
    }

    const totalTxns = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalTxns / limit));
    const transactions = filtered.slice(skip, skip + limit);

    return res.json({
      message: "Vendor wallet",
      data: {
        vendorId: vid.toString(),

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

        transactions,

        page,
        limit,
        totalTxns,
        totalPages,
      },
    });
  } catch (e: any) {
    console.error("vendorGetMyWallet error:", e);
    return res.status(500).json({
      message: "Failed to load wallet",
      error: e?.message || "Unknown error",
    });
  }
};