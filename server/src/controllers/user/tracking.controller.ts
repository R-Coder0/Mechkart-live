/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { Order } from "../../models/Order.model";
import { shiprocketTrackByAwb } from "../../services/shiprocket.service";

const getUserId = (req: Request) => (req as any).user?._id;
const toStr = (v: any) => String(v ?? "").trim();
const firstNonEmptyString = (...values: any[]) => {
  for (const value of values) {
    const text = toStr(value);
    if (text) return text;
  }
  return "";
};

function hydrateShiprocketShipment(shipment: any) {
  if (!shipment?.shiprocket) return shipment;

  const sr = shipment.shiprocket || {};
  const rawAwb = sr?.raw?.awb || {};
  const awb = firstNonEmptyString(
    sr?.awb,
    rawAwb?.awb_code,
    rawAwb?.awb,
    rawAwb?.response?.data?.awb_code,
    rawAwb?.response?.data?.awb,
    rawAwb?.data?.awb_code,
    rawAwb?.data?.awb,
    rawAwb?.response?.awb_code,
    rawAwb?.response?.awb
  );

  return {
    ...shipment,
    shiprocket: {
      ...sr,
      awb: awb || null,
    },
  };
}

/**
 * GET /users/orders/:orderId/tracking
 * Returns order + shipments + (optional) live tracking from Shiprocket (by AWB)
 */
export const getOrderTracking = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { orderId } = req.params;
    if (!Types.ObjectId.isValid(orderId)) return res.status(400).json({ message: "Invalid orderId" });

    const order: any = await Order.findOne({ _id: new Types.ObjectId(orderId), userId: new Types.ObjectId(userId) })
      .select("orderCode status paymentMethod paymentStatus shipments subOrders createdAt updatedAt")
      .lean();

    if (!order) return res.status(404).json({ message: "Order not found" });

    const shipmentsFromRoot = Array.isArray(order.shipments) ? order.shipments : [];
    const shipmentsFromSubOrders = Array.isArray(order.subOrders)
      ? order.subOrders
          .map((so: any) => so?.shipment)
          .filter((shipment: any) => shipment && shipment?.shiprocket?.shipmentId)
      : [];

    const shipments = (shipmentsFromRoot.length ? shipmentsFromRoot : shipmentsFromSubOrders).map((shipment: any) =>
      hydrateShiprocketShipment(shipment)
    );

    // ✅ OPTIONAL: Live tracking fetch for each shipment that has AWB
    // (Later we can cache, or move to webhook updates)
    const enriched = await Promise.all(
      shipments.map(async (s: any) => {
        const awb = toStr(s?.shiprocket?.awb);
        if (!awb) return s;

        try {
          const tr = await shiprocketTrackByAwb(awb);
          return {
            ...s,
            shiprocket: {
              ...(s.shiprocket || {}),
              tracking: tr,
            },
          };
        } catch (e: any) {
          // Don't fail endpoint if tracking API fails
          return s;
        }
      })
    );

    return res.json({
      message: "Tracking fetched",
      data: {
        orderId: order._id,
        orderCode: order.orderCode,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        shipments: enriched,
        createdAt: order.createdAt,
      },
    });
  } catch (err: any) {
    console.error("getOrderTracking error:", err);
    return res.status(500).json({ message: "Tracking fetch failed", error: err?.message || "Unknown error" });
  }
};
