/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { Order } from "../../models/Order.model";

const toStr = (v: any) => String(v ?? "").trim();

const toNum = (v: any, fb = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
};

const RETURN_WINDOW_DAYS = Number(process.env.RETURN_WINDOW_DAYS || 7);
const MAX_RETURN_IMAGES = 5;

function isWithinReturnWindow(deliveredAt: any) {
    if (!deliveredAt) return false;
    const t = new Date(deliveredAt).getTime();
    if (!Number.isFinite(t)) return false;

    const now = Date.now();
    const days = (now - t) / (1000 * 60 * 60 * 24);
    return days <= RETURN_WINDOW_DAYS;
}

/**
 * Try to infer deliveredAt.
 * - Prefer order.deliveredAt if you have it
 * - Else fall back to order.updatedAt (your flow sets updatedAt when DELIVERED)
 */
function getDeliveredAt(order: any) {
    return order?.deliveredAt || order?.updatedAt || order?.createdAt || null;
}

/**
 * Optional partial return:
 * body.items = [{ productId, qty, variantId?, colorKey? }]
 * If not sent => full order return request
 */
function normalizeReturnItems(bodyItems: any, orderItems: any[]) {
    if (!Array.isArray(bodyItems) || !bodyItems.length) return undefined;

    const normalized = bodyItems
        .map((x: any) => ({
            productId: toStr(x?.productId),
            qty: Math.max(1, toNum(x?.qty, 1)),
            variantId: x?.variantId ? toStr(x.variantId) : null,
            colorKey: x?.colorKey ? toStr(x.colorKey) : null,
        }))
        .filter((x) => Types.ObjectId.isValid(x.productId));

    if (!normalized.length) return undefined;

    // Validate: each item exists in order + qty not more than ordered qty
    const orderMap = new Map<string, number>();
    for (const it of orderItems || []) {
        const pid = toStr(it?.productId);
        const vid = it?.variantId ? toStr(it.variantId) : "";
        const ck = it?.colorKey ? toStr(it.colorKey).toLowerCase() : "";
        const key = `${pid}__${vid}__${ck}`;
        orderMap.set(key, (orderMap.get(key) || 0) + Math.max(1, toNum(it?.qty, 1)));
    }

    for (const r of normalized) {
        const key = `${toStr(r.productId)}__${r.variantId || ""}__${(r.colorKey || "").toLowerCase()}`;
        const allowedQty = orderMap.get(key) || 0;
        if (allowedQty <= 0) return { error: "Invalid return items (item not found in order)" };
        if (r.qty > allowedQty) return { error: "Invalid return qty (more than ordered)" };
    }

    return normalized.map((r) => ({
        productId: new Types.ObjectId(r.productId),
        qty: r.qty,
        variantId: r.variantId && Types.ObjectId.isValid(r.variantId) ? new Types.ObjectId(r.variantId) : null,
        colorKey: r.colorKey || null,
    }));
}

function normalizeImages(input: any) {
    const arr = Array.isArray(input) ? input : [];
    const cleaned = arr.map(toStr).filter(Boolean);
    // allow only max 5
    return cleaned.slice(0, MAX_RETURN_IMAGES);
}

function normalizeBankDetails(input: any) {
    const b = input || {};
    const accountHolderName = toStr(b.accountHolderName);
    const accountNumber = toStr(b.accountNumber);
    const ifsc = toStr(b.ifsc).toUpperCase();

    const bankName = toStr(b.bankName) || null;
    const upiId = toStr(b.upiId) || null;

    return {
        accountHolderName,
        accountNumber,
        ifsc,
        bankName,
        upiId,
    };
}

function validateCodBankDetails(bank: any) {
    if (!bank) return "Bank details are required for COD returns.";
    if (!toStr(bank.accountHolderName)) return "Account holder name is required.";
    if (!toStr(bank.accountNumber)) return "Account number is required.";
    if (!toStr(bank.ifsc)) return "IFSC is required.";
    return null;
}

// POST /api/users/orders/:orderId/return-request
export const createReturnRequest = async (req: Request, res: Response) => {
    try {
        const userId = (req as any)?.user?._id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const { orderId } = req.params;
        if (!Types.ObjectId.isValid(orderId)) return res.status(400).json({ message: "Invalid orderId" });

        const reason = toStr(req.body?.reason);
        const note = toStr(req.body?.note); // optional
        const files = ((req as any).files || []) as any[];
        const images = Array.isArray(files)
            ? files.slice(0, MAX_RETURN_IMAGES).map((f) => `/uploads/${f.filename}`).filter(Boolean)
            : [];
        if (!reason) return res.status(400).json({ message: "Return reason is required" });
        if (Array.isArray(req.body?.images) && req.body.images.length > MAX_RETURN_IMAGES) {
            return res.status(400).json({ message: `Max ${MAX_RETURN_IMAGES} images allowed` });
        }

        const order: any = await Order.findOne({
            _id: new Types.ObjectId(orderId),
            userId: new Types.ObjectId(String(userId)),
        });

        if (!order) return res.status(404).json({ message: "Order not found" });

        const st = String(order.status || "").toUpperCase();
        if (st !== "DELIVERED") {
            return res.status(400).json({ message: "Only DELIVERED orders can be returned" });
        }

        // block if already requested and not rejected
        const existing = order?.return;
        if (existing?.status && String(existing.status).toUpperCase() !== "REJECTED") {
            return res.status(409).json({ message: "Return already requested for this order" });
        }

        // return window
        const deliveredAt = getDeliveredAt(order);
        if (!isWithinReturnWindow(deliveredAt)) {
            return res.status(400).json({ message: `Return window expired (>${RETURN_WINDOW_DAYS} days)` });
        }

        // optional partial return items
        const normalizedItems = normalizeReturnItems(req.body?.items, order?.items || []);
        if ((normalizedItems as any)?.error) {
            return res.status(400).json({ message: (normalizedItems as any).error });
        }

        // COD bank details required
        const pm = String(order?.paymentMethod || "").toUpperCase();
        let bankDetails: any = null;

        if (pm === "COD") { 
            const raw = req.body?.bankDetails;

            let parsed: any = null;
            if (raw) {
                try {
                    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
                } catch {
                    return res.status(400).json({ message: "Invalid bank details format" });
                }
            }

            bankDetails = normalizeBankDetails(parsed);

            const bankErr = validateCodBankDetails(bankDetails);
            if (bankErr) return res.status(400).json({ message: bankErr });
        }

        order.return = {
            requestedAt: new Date(),
            reason,
            note: note || null,
            images, // ✅ store
            bankDetails: bankDetails || null, // ✅ store for COD
            items: Array.isArray(normalizedItems) ? normalizedItems : undefined,
            status: "REQUESTED",

            approvedAt: null,
            approvedBy: null,
            rejectedAt: null,
            rejectReason: null,

            returnShipment: null,
        };

        // IMPORTANT: do NOT change order.status (enum doesn't have RETURN_REQUESTED)

        await order.save();

        return res.json({ message: "Return request submitted", data: order });
    } catch (err: any) {
        console.error("createReturnRequest error:", err);
        return res.status(500).json({ message: "Return request failed", error: err?.message || "Unknown error" });
    }
};

// GET /api/users/orders/:orderId/return-request
export const getReturnRequest = async (req: Request, res: Response) => {
    try {
        const userId = (req as any)?.user?._id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const { orderId } = req.params;
        if (!Types.ObjectId.isValid(orderId)) return res.status(400).json({ message: "Invalid orderId" });

        const order: any = await Order.findOne(
            { _id: new Types.ObjectId(orderId), userId: new Types.ObjectId(String(userId)) },
            {
                return: 1,
                status: 1,
                orderCode: 1,
                paymentMethod: 1,
                updatedAt: 1,
                createdAt: 1,
            }
        ).lean();

        if (!order) return res.status(404).json({ message: "Order not found" });

        return res.json({ message: "Return request", data: order?.return || null });
    } catch (err: any) {
        console.error("getReturnRequest error:", err);
        return res.status(500).json({ message: "Failed", error: err?.message || "Unknown error" });
    }
};
