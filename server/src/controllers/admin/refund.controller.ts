/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import Razorpay from "razorpay";
import { Order } from "../../models/Order.model";

const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

function toStr(v: any) {
  return String(v ?? "").trim();
}
function toNum(v: any, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function rzpErr(err: any) {
  return {
    statusCode: err?.statusCode || err?.response?.status,
    message: err?.message,
    error: err?.error || err?.response?.data?.error,
    data: err?.response?.data,
  };
}

function maskKey(k: string) {
  if (!k) return "";
  if (k.length <= 8) return `${k.slice(0, 2)}***`;
  return `${k.slice(0, 6)}***${k.slice(-2)}`;
}

function keyModeHint(keyId: string) {
  if (keyId.startsWith("rzp_test_")) return "TEST";
  if (keyId.startsWith("rzp_live_")) return "LIVE";
  return "UNKNOWN";
}

function computeRefundPaiseFromOrder(order: any) {
  // Prefer pg.amount if present (paise)
  const pgAmountPaise = toNum(order?.pg?.amount, 0);
  if (pgAmountPaise > 0) return Math.round(pgAmountPaise);

  // fallback: totals are in rupees
  const rupees =
    toNum(order?.totals?.grandTotal, NaN) ||
    toNum(order?.totals?.subtotal, NaN) ||
    toNum(order?.refund?.amount, NaN) ||
    0;

  return Math.round(rupees * 100);
}

function logBlock(title: string, obj: any) {
  console.log(`\n========== ${title} ==========\n`, obj, `\n==============================\n`);
}

/**
 * COD refunds should have bankDetails present (entered by user at return request time)
 * We'll validate minimum fields.
 */
function validateBankDetails(bd: any) {
  const accountHolderName = toStr(bd?.accountHolderName);
  const accountNumber = toStr(bd?.accountNumber);
  const ifsc = toStr(bd?.ifsc).toUpperCase();
  const bankName = toStr(bd?.bankName);

  // minimal required
  if (!accountHolderName) return { ok: false, message: "Missing bankDetails.accountHolderName" };
  if (!accountNumber) return { ok: false, message: "Missing bankDetails.accountNumber" };
  if (!ifsc) return { ok: false, message: "Missing bankDetails.ifsc" };

  // rough IFSC sanity (optional strictness)
  if (ifsc.length < 8) return { ok: false, message: "Invalid IFSC" };

  return {
    ok: true,
    data: {
      accountHolderName,
      accountNumber,
      ifsc,
      bankName: bankName || null,
      upiId: toStr(bd?.upiId) || null,
    },
  };
}

// POST /api/admin/returns/:orderId/process-refund
export const adminProcessRefund = async (req: Request, res: Response) => {
  const reqId = `refund_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

  try {
    const { orderId } = req.params;

    logBlock("REFUND REQUEST START", {
      reqId,
      orderId,
      body: req.body,
      keyMode: keyModeHint(RZP_KEY_ID),
      keyIdMasked: maskKey(RZP_KEY_ID),
    });

    if (!Types.ObjectId.isValid(orderId)) {
      logBlock("REFUND FAIL: INVALID ORDER ID", { reqId, orderId });
      return res.status(400).json({ message: "Invalid orderId" });
    }

    const order: any = await Order.findById(orderId);
    if (!order) {
      logBlock("REFUND FAIL: ORDER NOT FOUND", { reqId, orderId });
      return res.status(404).json({ message: "Order not found" });
    }

    const retStatus = String(order?.return?.status || "").toUpperCase();
    const refundStatus = String(order?.refund?.status || "").toUpperCase();
    const pm = String(order?.paymentMethod || "").toUpperCase();
    const paymentId = toStr(order?.pg?.paymentId);

    logBlock("ORDER SNAPSHOT", {
      reqId,
      paymentMethod: pm,
      returnStatus: retStatus,
      refundStatus,
      pg: {
        paymentId,
        orderId: order?.pg?.orderId,
        amount: order?.pg?.amount,
        currency: order?.pg?.currency,
        verifiedAt: order?.pg?.verifiedAt,
      },
      totals: order?.totals,
      returnBankDetailsPresent: Boolean(order?.return?.bankDetails),
    });

    // Refund only after return APPROVED/RECEIVED (your flow)
    if (!["APPROVED", "RECEIVED"].includes(retStatus)) {
      logBlock("REFUND FAIL: RETURN STATUS NOT ALLOWED", { reqId, retStatus });
      return res.status(400).json({
        message: `Refund allowed only after APPROVED/RECEIVED (current: ${retStatus || "—"})`,
      });
    }

    if (refundStatus === "PROCESSED") {
      logBlock("REFUND BLOCKED: ALREADY PROCESSED", { reqId });
      return res.status(409).json({ message: "Refund already processed" });
    }

    // -------------------------
    // COD => manual refund
    // -------------------------
    if (pm === "COD") {
      // ✅ Enforce bankDetails to exist (user should provide)
      const bd = order?.return?.bankDetails;
      const chk = validateBankDetails(bd);
      if (!chk.ok) {
        logBlock("COD REFUND FAIL: BANK DETAILS MISSING/INVALID", { reqId, reason: chk.message });
        return res.status(400).json({
          message: "COD refund needs bank details from customer",
          error: chk.message,
        });
      }

      logBlock("COD REFUND: MARKING MANUAL", { reqId, bankDetails: chk.data });

      order.refund = {
        method: "COD",
        amount: toNum(order?.totals?.grandTotal, 0),
        status: "PROCESSED",
        provider: "MANUAL",
        refundId: null,
        processedAt: new Date(),
        raw: {
          note: "COD refund handled manually",
          bankDetails: chk.data,
        },
      };

      // ✅ Mark return as REFUNDED once manual processing done
      order.return = { ...(order.return || {}), status: "REFUNDED" };

      await order.save();

      logBlock("COD REFUND SUCCESS", { reqId });
      return res.json({ message: "COD refund marked as processed", data: order });
    }

    // -------------------------
    // ONLINE => Razorpay refund
    // -------------------------
    if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
      logBlock("REFUND FAIL: KEYS MISSING", { reqId });
      return res.status(500).json({ message: "Razorpay keys missing in env" });
    }

    if (!paymentId || !paymentId.startsWith("pay_")) {
      logBlock("REFUND FAIL: INVALID PAYMENT ID", { reqId, paymentId });
      return res.status(400).json({
        message: "Missing/invalid Razorpay paymentId (order.pg.paymentId must be pay_...)",
        meta: { paymentId },
      });
    }

    const bodyAmountRupees = toNum(req.body?.amount, NaN);
    const amountPaise = Number.isFinite(bodyAmountRupees)
      ? Math.round(bodyAmountRupees * 100)
      : computeRefundPaiseFromOrder(order);

    logBlock("AMOUNT COMPUTATION", {
      reqId,
      bodyAmountRupees: Number.isFinite(bodyAmountRupees) ? bodyAmountRupees : null,
      amountPaise,
      amountRupees: Math.round(amountPaise / 100),
    });

    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      logBlock("REFUND FAIL: INVALID AMOUNT", { reqId, amountPaise });
      return res.status(400).json({ message: "Invalid refund amount", meta: { amountPaise } });
    }

    const razorpay = new Razorpay({ key_id: RZP_KEY_ID, key_secret: RZP_KEY_SECRET });

    // Fetch payment snapshot
    let pay: any;
    try {
      pay = await razorpay.payments.fetch(paymentId);
      logBlock("RZP PAYMENT FETCH OK", {
        reqId,
        paymentId,
        pay: {
          id: pay?.id,
          status: pay?.status,
          amount: pay?.amount,
          refunded_amount: pay?.refunded_amount,
          currency: pay?.currency,
          method: pay?.method,
          captured: pay?.captured,
        },
      });
    } catch (e: any) {
      const picked = rzpErr(e);
      logBlock("RZP PAYMENT FETCH FAILED", { reqId, paymentId, picked });
      return res.status(picked.statusCode || 400).json({
        message: "Razorpay payment fetch failed",
        error: picked.error || picked.message || "Unknown error",
      });
    }

    const payStatus = String(pay?.status || "");
    const payAmount = Number(pay?.amount ?? 0);
    const refundedAmount = Number(pay?.refunded_amount ?? 0); // ✅ undefined -> 0

    if (payStatus !== "captured") {
      logBlock("REFUND FAIL: PAYMENT NOT CAPTURED", {
        reqId,
        paymentId,
        payStatus,
        payAmount,
        refundedAmount,
      });
      return res.status(400).json({
        message: `Payment not captured (status=${payStatus})`,
        meta: { paymentId, payStatus, payAmount, refundedAmount },
      });
    }

    const refundable = payAmount - refundedAmount;
    if (amountPaise > refundable) {
      logBlock("REFUND FAIL: EXCEEDS REFUNDABLE", {
        reqId,
        asked: amountPaise,
        refundable,
        payAmount,
        refundedAmount,
      });
      return res.status(400).json({
        message: "Refund amount exceeds refundable amount",
        meta: { payAmount, refundedAmount, refundable, asked: amountPaise },
      });
    }

    // Create refund
    try {
      // notes help debugging in Razorpay dashboard
      const refund = await razorpay.payments.refund(paymentId, {
        amount: amountPaise,
        notes: {
          orderId: String(order._id),
          orderCode: String(order.orderCode || ""),
          reason: String(order?.return?.reason || ""),
        },
      } as any);

      logBlock("RZP REFUND SUCCESS", {
        reqId,
        refund: {
          id: refund?.id,
          amount: refund?.amount,
          currency: refund?.currency,
          status: refund?.status,
          payment_id: refund?.payment_id,
        },
      });

      order.refund = {
        method: "ONLINE",
        amount: Math.round(amountPaise / 100), // store rupees
        status: "PROCESSED",
        provider: "RAZORPAY",
        refundId: refund?.id || null,
        processedAt: new Date(),
        raw: { refund, paySnapshot: pay },
      };

      order.return = { ...(order.return || {}), status: "REFUNDED" };
      await order.save();

      logBlock("REFUND FLOW COMPLETE", { reqId, orderId });
      return res.json({ message: "Refund processed", data: order });
    } catch (e: any) {
      const picked = rzpErr(e);
      logBlock("RZP REFUND FAILED", { reqId, paymentId, picked });

      order.refund = {
        method: "ONLINE",
        amount: Math.round(amountPaise / 100),
        status: "FAILED",
        provider: "RAZORPAY",
        refundId: null,
        processedAt: null,
        raw: {
          note: "SDK refund call failed",
          err: picked,
          paySnapshot: {
            id: pay?.id,
            status: payStatus,
            amount: payAmount,
            refunded_amount: refundedAmount,
            currency: pay?.currency,
            method: pay?.method,
          },
        },
      };
      await order.save();

      return res.status(picked.statusCode || 400).json({
        message: "Razorpay refund failed",
        error: picked.error || picked.message || "Unknown error",
      });
    }
  } catch (err: any) {
    console.error("adminProcessRefund error:", err);
    return res.status(500).json({
      message: "Refund failed",
      error: err?.message || "Unknown error",
    });
  }
};
