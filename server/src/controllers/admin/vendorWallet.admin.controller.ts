/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Order } from "../../models/Order.model"; // ✅ adjust path
import { applyWalletEffectsForOrder } from "../../services/vendorWallet.service";
import { unlockDueHoldToAvailable } from "../../services/vendorWallet.unlock.service";

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



export const adminRunWalletUnlock = async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit || 100);
    const result = await unlockDueHoldToAvailable({ limit });
    return res.json({ message: "Wallet unlock job executed", data: result });
  } catch (e: any) {
    console.error("adminRunWalletUnlock error:", e);
    return res.status(500).json({ message: "Unlock failed", error: e?.message || "Unknown error" });
  }
};
