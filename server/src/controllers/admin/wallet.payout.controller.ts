/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { adminReleaseVendorPayout, adminLogPayoutFailed } from "../../services/vendorWallet.payout.service";

export const adminPayoutRelease = async (req: Request, res: Response) => {
  try {
    const vendorId = String(req.body?.vendorId || "").trim();
    const amount = Number(req.body?.amount || 0);

    const method = (String(req.body?.method || "MANUAL").toUpperCase() as any) || "MANUAL";
    const reference = String(req.body?.reference || "").trim();
    const note = String(req.body?.note || "").trim();

    const result = await adminReleaseVendorPayout({
      vendorId,
      amount,
      method,
      reference,
      note,
      meta: {
        adminId: (req as any)?.admin?._id ? String((req as any).admin._id) : null,
        source: "adminPayoutRelease",
      },
    });

    if (!result.ok) {
      return res.status(400).json({ message: "Payout release failed", data: result });
    }

    return res.json({ message: "Payout released", data: result });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Payout release error" });
  }
};

export const adminPayoutFailed = async (req: Request, res: Response) => {
  try {
    const vendorId = String(req.body?.vendorId || "").trim();
    const amount = Number(req.body?.amount || 0);

    const method = (String(req.body?.method || "MANUAL").toUpperCase() as any) || "MANUAL";
    const reference = String(req.body?.reference || "").trim();
    const reason = String(req.body?.reason || "Payout failed").trim();

    const result = await adminLogPayoutFailed({
      vendorId,
      amount,
      method,
      reference,
      reason,
      meta: {
        adminId: (req as any)?.admin?._id ? String((req as any).admin._id) : null,
        source: "adminPayoutFailed",
      },
    });

    if (!result.ok) {
      return res.status(400).json({ message: "Payout failed log error", data: result });
    }

    return res.json({ message: "Payout failure logged", data: result });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Payout failed log error" });
  }
};
