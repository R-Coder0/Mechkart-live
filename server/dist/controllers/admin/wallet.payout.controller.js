"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminPayoutFailed = exports.adminPayoutRelease = void 0;
const vendorWallet_payout_service_1 = require("../../services/vendorWallet.payout.service");
const parseOptionalAmount = (v) => {
    if (v === undefined || v === null || String(v).trim() === "")
        return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
};
const adminPayoutRelease = async (req, res) => {
    try {
        const vendorId = String(req.body?.vendorId || "").trim();
        const amount = parseOptionalAmount(req.body?.amount);
        const method = String(req.body?.method || "MANUAL").toUpperCase() || "MANUAL";
        const reference = String(req.body?.reference || "").trim();
        const note = String(req.body?.note || "").trim();
        const result = await (0, vendorWallet_payout_service_1.adminReleaseVendorPayout)({
            vendorId,
            amount,
            method,
            reference,
            note,
            meta: {
                adminId: req?.admin?._id ? String(req.admin._id) : null,
                source: "adminPayoutRelease",
            },
        });
        if (!result.ok) {
            return res.status(400).json({ message: "Payout release failed", data: result });
        }
        return res.json({ message: "Payout released", data: result });
    }
    catch (e) {
        return res.status(500).json({ message: e?.message || "Payout release error" });
    }
};
exports.adminPayoutRelease = adminPayoutRelease;
const adminPayoutFailed = async (req, res) => {
    try {
        const vendorId = String(req.body?.vendorId || "").trim();
        const amount = Number(req.body?.amount || 0);
        const method = String(req.body?.method || "MANUAL").toUpperCase() || "MANUAL";
        const reference = String(req.body?.reference || "").trim();
        const reason = String(req.body?.reason || "Payout failed").trim();
        const result = await (0, vendorWallet_payout_service_1.adminLogPayoutFailed)({
            vendorId,
            amount,
            method,
            reference,
            reason,
            meta: {
                adminId: req?.admin?._id ? String(req.admin._id) : null,
                source: "adminPayoutFailed",
            },
        });
        if (!result.ok) {
            return res.status(400).json({ message: "Payout failed log error", data: result });
        }
        return res.json({ message: "Payout failure logged", data: result });
    }
    catch (e) {
        return res.status(500).json({ message: e?.message || "Payout failed log error" });
    }
};
exports.adminPayoutFailed = adminPayoutFailed;
