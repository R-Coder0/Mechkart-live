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

/* =========================
 * Helpers
 * ========================= */
const idStr = (v: any) => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (v instanceof Types.ObjectId) return String(v);
  if ((v as any)?._id) return String((v as any)._id);
  return String(v);
};

function isWithinReturnWindow(deliveredAt: any) {
  if (!deliveredAt) return false;
  const t = new Date(deliveredAt).getTime();
  if (!Number.isFinite(t)) return false;

  const now = Date.now();
  const days = (now - t) / (1000 * 60 * 60 * 24);
  return days <= RETURN_WINDOW_DAYS;
}

function normalizeBankDetails(input: any) {
  const b = input || {};
  return {
    accountHolderName: toStr(b.accountHolderName),
    accountNumber: toStr(b.accountNumber),
    ifsc: toStr(b.ifsc).toUpperCase(),
    bankName: toStr(b.bankName) || null,
    upiId: toStr(b.upiId) || null,
  };
}

function validateCodBankDetails(bank: any) {
  if (!bank) return "Bank details are required for COD returns.";
  if (!toStr(bank.accountHolderName)) return "Account holder name is required.";
  if (!toStr(bank.accountNumber)) return "Account number is required.";
  if (!toStr(bank.ifsc)) return "IFSC is required.";
  return null;
}

function buildItemMap(subOrders: any[]) {
  const map = new Map<
    string,
    { subOrder: any; orderedQty: number; returnedQty: number }
  >();

  for (const so of subOrders || []) {
    for (const it of so.items || []) {
      const pid = idStr(it.productId);
      const vid = it.variantId ? idStr(it.variantId) : "";
      const ck = it.colorKey ? toStr(it.colorKey).toLowerCase() : "";
      const key = `${pid}__${vid}__${ck}`;

      if (!map.has(key)) {
        map.set(key, { subOrder: so, orderedQty: 0, returnedQty: 0 });
      }

      map.get(key)!.orderedQty += Math.max(1, toNum(it.qty, 1));

      // already returned qty (exclude rejected)
      for (const ret of so.returns || []) {
        if (ret.status === "REJECTED") continue;

        for (const rit of ret.items || []) {
          const rpid = idStr(rit.productId);
          const rvid = rit.variantId ? idStr(rit.variantId) : "";
          const rck = rit.colorKey ? toStr(rit.colorKey).toLowerCase() : "";
          const rkey = `${rpid}__${rvid}__${rck}`;

          if (rkey === key) {
            map.get(key)!.returnedQty += Math.max(0, toNum(rit.qty, 0));
          }
        }
      }
    }
  }

  return map;
}

function parseItems(rawItems: any) {
  // supports array OR JSON-stringified array
  if (Array.isArray(rawItems)) return rawItems;

  if (typeof rawItems === "string" && rawItems.trim()) {
    try {
      const parsed = JSON.parse(rawItems);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return null; // invalid JSON
    }
  }

  return [];
}

function parseBankDetails(raw: any) {
  if (!raw) return null;

  if (typeof raw === "string" && raw.trim()) {
    try {
      return JSON.parse(raw);
    } catch {
      return "__INVALID__";
    }
  }

  return raw;
}

/* =========================
 * Return item snapshot helpers
 * ========================= */

function findSubOrderItemByKey(subOrder: any, pid: string, vid: string, ck: string) {
  const list = Array.isArray(subOrder?.items) ? subOrder.items : [];

  return list.find((it: any) => {
    const xpid = idStr(it?.productId);
    const xvid = it?.variantId ? idStr(it.variantId) : "";
    const xck = it?.colorKey ? toStr(it.colorKey).toLowerCase() : "";

    return xpid === pid && xvid === vid && xck === ck;
  });
}

function pickReturnItemSnapshot(orderItem: any) {
  const productObj =
    orderItem?.productId && typeof orderItem.productId === "object"
      ? orderItem.productId
      : null;

  const title =
    toStr(orderItem?.title) ||
    toStr(orderItem?.name) ||
    toStr(productObj?.title) ||
    toStr(productObj?.name) ||
    "";

  const productCode =
    toStr(orderItem?.productCode) ||
    toStr(orderItem?.sku) ||
    toStr(productObj?.productCode) ||
    toStr(productObj?.sku) ||
    "";

  const image =
    toStr(orderItem?.image) ||
    toStr(orderItem?.featureImage) ||
    toStr(productObj?.featureImage) ||
    (Array.isArray(productObj?.galleryImages)
      ? toStr(productObj.galleryImages[0])
      : "") ||
    "";

  const variantLabel =
    toStr(orderItem?.variantLabel) ||
    toStr(orderItem?.variantName) ||
    toStr(orderItem?.variantText) ||
    toStr(orderItem?.variantSnapshot?.label) ||
    toStr(orderItem?.variantSnapshot?.comboText) ||
    toStr(orderItem?.variantSnapshot?.size) ||
    toStr(orderItem?.variantSnapshot?.weight) ||
    "";

  const finalLineTotal =
    Number.isFinite(Number(orderItem?.finalLineTotal))
      ? Number(orderItem.finalLineTotal)
      : Number.isFinite(Number(orderItem?.lineTotal))
      ? Number(orderItem.lineTotal)
      : Number.isFinite(Number(orderItem?.baseLineTotal))
      ? Number(orderItem.baseLineTotal)
      : 0;

  return {
    title: title || null,
    productCode: productCode || null,
    image: image || null,
    variantLabel: variantLabel || null,
    finalLineTotal: finalLineTotal || 0,
  };
}

/* =========================
 * POST Return Request (Vendor-wise split)
 * ========================= */
// POST /api/users/orders/:orderId/return-request
export const createReturnRequest = async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { orderId } = req.params;
    if (!Types.ObjectId.isValid(orderId))
      return res.status(400).json({ message: "Invalid orderId" });

    const reason = toStr((req.body as any)?.reason);
    const note = toStr((req.body as any)?.note);

    if (!reason)
      return res.status(400).json({ message: "Return reason is required" });

    const order: any = await Order.findOne({
      _id: new Types.ObjectId(orderId),
      userId: new Types.ObjectId(String(userId)),
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    if (!Array.isArray(order.subOrders) || !order.subOrders.length)
      return res.status(400).json({ message: "Invalid order structure" });

    // items parsing
    const rawItems = (req.body as any)?.items;
    const bodyItems = parseItems(rawItems);

    if (bodyItems === null) {
      return res.status(400).json({ message: "Invalid items format" });
    }
    if (!bodyItems.length) {
      return res
        .status(400)
        .json({ message: "Select at least one item for return" });
    }

    const itemMap = buildItemMap(order.subOrders);
    const vendorBuckets = new Map<string, any[]>();

    // Validate + bucket items vendor-wise (subOrder-wise)
    for (const r of bodyItems) {
      const pid = idStr(r?.productId);
      const vid = r?.variantId ? idStr(r.variantId) : "";
      const ck = r?.colorKey ? toStr(r.colorKey).toLowerCase() : "";

      if (!pid || !Types.ObjectId.isValid(pid)) {
        return res.status(400).json({ message: "Invalid return item" });
      }

      const key = `${pid}__${vid}__${ck}`;
      const entry = itemMap.get(key);

      if (!entry)
        return res.status(400).json({ message: "Invalid return item" });

      const availableQty = entry.orderedQty - entry.returnedQty;
      const reqQty = Math.max(1, toNum(r?.qty, 1));

      if (reqQty > availableQty)
        return res
          .status(400)
          .json({ message: "Return qty exceeds allowed qty" });

      const soId = String(entry.subOrder._id);

      if (!vendorBuckets.has(soId)) vendorBuckets.set(soId, []);

      const matchedOrderItem = findSubOrderItemByKey(entry.subOrder, pid, vid, ck);
      const snap = matchedOrderItem ? pickReturnItemSnapshot(matchedOrderItem) : null;

      vendorBuckets.get(soId)!.push({
        productId: new Types.ObjectId(pid),
        qty: reqQty,
        variantId:
          vid && Types.ObjectId.isValid(vid) ? new Types.ObjectId(vid) : null,
        colorKey: ck || null,

        // snapshot fields for admin/vendor/user UI
        title: snap?.title || null,
        productCode: snap?.productCode || null,
        image: snap?.image || null,
        variantLabel: snap?.variantLabel || null,
        finalLineTotal: snap?.finalLineTotal || 0,
      });
    }

    // Payment method / bank details (COD only)
    const pm = String(order.paymentMethod || "").toUpperCase();
    let bankDetails: any = null;

    if (pm === "COD") {
      const parsed = parseBankDetails((req.body as any)?.bankDetails);
      if (parsed === "__INVALID__") {
        return res.status(400).json({ message: "Invalid bankDetails format" });
      }

      bankDetails = normalizeBankDetails(parsed);
      const bankErr = validateCodBankDetails(bankDetails);
      if (bankErr) return res.status(400).json({ message: bankErr });
    }

    // Create return inside each subOrder
    for (const [soId, items] of vendorBuckets.entries()) {
      const subOrder = order.subOrders.id(soId);
      if (!subOrder)
        return res.status(400).json({ message: "SubOrder not found" });

      if (subOrder.status !== "DELIVERED")
        return res
          .status(400)
          .json({ message: "Only delivered items can be returned" });

      const deliveredAt = subOrder.shipment?.updatedAt || order.updatedAt;
      if (!isWithinReturnWindow(deliveredAt))
        return res.status(400).json({ message: "Return window expired" });

      const active = (subOrder.returns || []).find(
        (r: any) => r.status !== "REJECTED" && r.status !== "REFUNDED"
      );

      if (active)
        return res.status(409).json({
          message: "Return already active for this vendor",
        });

      subOrder.returns.push({
        requestedAt: new Date(),
        reason,
        note: note || null,
        images: [],
        bankDetails: bankDetails || null,
        items,
        status: "REQUESTED",
        handledByRole: null,
        handledById: null,
        approvedAt: null,
        rejectedAt: null,
        rejectReason: null,
        receivedAt: null,
        returnShipment: null,
      });
    }

    await order.save();

    return res.json({ message: "Return request submitted successfully" });
  } catch (err: any) {
    console.error("createReturnRequest error:", err);
    return res.status(500).json({
      message: "Return request failed",
      error: err?.message || "Unknown error",
    });
  }
};

/* =========================
 * GET Return Requests (User View)
 * ========================= */
// GET /api/users/orders/:orderId/return-request
export const getReturnRequest = async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { orderId } = req.params;
    if (!Types.ObjectId.isValid(orderId))
      return res.status(400).json({ message: "Invalid orderId" });

    const order: any = await Order.findOne(
      {
        _id: new Types.ObjectId(orderId),
        userId: new Types.ObjectId(String(userId)),
      },
      {
        subOrders: 1,
        orderCode: 1,
        paymentMethod: 1,
        status: 1,
        updatedAt: 1,
        createdAt: 1,
      }
    ).lean();

    if (!order) return res.status(404).json({ message: "Order not found" });

    return res.json({
      message: "Return requests",
      data: order.subOrders || [],
    });
  } catch (err: any) {
    console.error("getReturnRequest error:", err);
    return res.status(500).json({
      message: "Failed",
      error: err?.message || "Unknown error",
    });
  }
};