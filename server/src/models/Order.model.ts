import mongoose, { Schema, Types, Document, Model } from "mongoose";

/* =========================
 * Order Item
 * ========================= */
export interface IOrderItem {
  productId: Types.ObjectId;
  productCode: string;

  variantId?: Types.ObjectId | null;
  variantText?: string | null;

  colorKey?: string | null;
  qty: number;

  title: string;
  image?: string | null;
  mrp: number;
  salePrice: number;
}

/* =========================
 * Address Snapshot
 * ========================= */
export interface IOrderAddress {
  fullName: string;
  phone: string;
  pincode: string;
  state: string;
  city: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
}

/* =========================
 * Contact Snapshot
 * ========================= */
export interface IOrderContact {
  name: string;
  phone: string;
  email?: string;
}

/* =========================
 * Shipment
 * ========================= */
export type ShipmentStatus =
  | "CREATED"
  | "AWB_ASSIGNED"
  | "PICKUP_SCHEDULED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

export interface IShipmentItemRef {
  productId: Types.ObjectId;
  qty: number;
  variantId?: Types.ObjectId | null;
  colorKey?: string | null;
}

export interface IOrderShipment {
  provider: "SHIPROCKET";
  vendorId?: Types.ObjectId | null;

  items: IShipmentItemRef[];

  pickup?: {
    name?: string;
    phone?: string;
    pincode?: string;
    state?: string;
    city?: string;
    addressLine1?: string;
    addressLine2?: string;
  } | null;

  shiprocket?: {
    orderId?: string | null;
    shipmentId?: number | null;
    awb?: string | null;
    courierName?: string | null;
    courierCompanyId?: number | null;

    labelUrl?: string | null;
    manifestUrl?: string | null;
    invoiceUrl?: string | null;

    pickupScheduledAt?: Date | null;
    tracking?: any;
    raw?: any;
  } | null;

  status: ShipmentStatus;

  createdAt: Date;
  updatedAt: Date;
}

/* =========================
 * RETURN & REFUND
 * ========================= */

export type ReturnStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "PICKUP_CREATED"
  | "RECEIVED"
  | "REFUNDED";

export interface IReturnBankDetails {
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  bankName?: string | null;
  upiId?: string | null;
}

export interface IOrderReturn {
  requestedAt: Date;
  reason: string;

  // ✅ optional description (not mandatory)
  note?: string | null;

  // ✅ user can upload up to 5 images (urls stored)
  images?: string[];

  // ✅ COD refund needs bank details (captured at request time)
  bankDetails?: IReturnBankDetails | null;

  // optional: partial return
  items?: {
    productId: Types.ObjectId;
    qty: number;
    variantId?: Types.ObjectId | null;
    colorKey?: string | null;
  }[];

  status: ReturnStatus;

  approvedAt?: Date | null;
  approvedBy?: Types.ObjectId | null;

  rejectedAt?: Date | null;
  rejectReason?: string | null;

  // optional: return shipment snapshot (future use)
  returnShipment?: IOrderShipment | null;
}

export type RefundStatus = "PENDING" | "PROCESSED" | "FAILED";

export interface IOrderRefund {
  method: "COD" | "ONLINE";
  amount: number;

  status: RefundStatus;

  provider?: "RAZORPAY" | "MANUAL";
  refundId?: string | null;

  processedAt?: Date | null;
  raw?: any;
}

/* =========================
 * Order
 * ========================= */
export interface IOrder extends Document {
  userId: Types.ObjectId;
  orderCode: string;

  parentOrderId?: Types.ObjectId | null;

  items: IOrderItem[];

  totals: {
    subtotal: number;
    mrpTotal: number;
    savings: number;
    discount: number;
    grandTotal: number;
  };

  appliedOffer?: {
    offerId: Types.ObjectId;
    name: string;
    mode: "AUTO" | "COUPON";
    couponCode?: string | null;
    offerType: "FLAT" | "PERCENT";
    value: number;
    discountAmount: number;
  } | null;

  contact: IOrderContact;
  address: IOrderAddress;

  paymentMethod: "COD" | "ONLINE";
  paymentStatus: "PENDING" | "PAID" | "FAILED";

  // NOTE: keep original order flow status only
  status: "PLACED" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

  // Razorpay + COD snapshots
  pg?: any;
  cod?: any;

  shipments?: IOrderShipment[];

  // ✅ Return & refund separate (does NOT change order.status)
  return?: IOrderReturn | null;
  refund?: IOrderRefund | null;

  createdAt: Date;
  updatedAt: Date;
}

/* =========================
 * Schemas
 * ========================= */

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productCode: { type: String, required: true, trim: true },

    variantId: { type: Schema.Types.ObjectId, default: null },
    variantText: { type: String, default: null, trim: true },

    colorKey: { type: String, default: null, trim: true },
    qty: { type: Number, required: true, min: 1 },

    title: { type: String, required: true, trim: true },
    image: { type: String, default: null, trim: true },

    mrp: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ShipmentItemRefSchema = new Schema<IShipmentItemRef>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    qty: { type: Number, required: true, min: 1 },
    variantId: { type: Schema.Types.ObjectId, default: null },
    colorKey: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const OrderShipmentSchema = new Schema<IOrderShipment>(
  {
    provider: { type: String, enum: ["SHIPROCKET"], required: true, default: "SHIPROCKET" },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", default: null },

    items: { type: [ShipmentItemRefSchema], default: [] },

    pickup: {
      type: {
        name: { type: String, trim: true },
        phone: { type: String, trim: true },
        pincode: { type: String, trim: true },
        state: { type: String, trim: true },
        city: { type: String, trim: true },
        addressLine1: { type: String, trim: true },
        addressLine2: { type: String, trim: true },
      },
      default: null,
    },

    shiprocket: {
      type: {
        orderId: { type: String, default: null, trim: true },
        shipmentId: { type: Number, default: null },
        awb: { type: String, default: null, trim: true },
        courierName: { type: String, default: null, trim: true },
        courierCompanyId: { type: Number, default: null },

        labelUrl: { type: String, default: null, trim: true },
        manifestUrl: { type: String, default: null, trim: true },
        invoiceUrl: { type: String, default: null, trim: true },

        pickupScheduledAt: { type: Date, default: null },

        tracking: { type: Schema.Types.Mixed, default: null },
        raw: { type: Schema.Types.Mixed, default: null },
      },
      default: null,
    },

    status: {
      type: String,
      enum: ["CREATED", "AWB_ASSIGNED", "PICKUP_SCHEDULED", "IN_TRANSIT", "DELIVERED", "CANCELLED"],
      default: "CREATED",
    },
  },
  { timestamps: true }
);

/** ✅ NEW: Bank details schema for COD returns */
const ReturnBankDetailsSchema = new Schema<IReturnBankDetails>(
  {
    accountHolderName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    ifsc: { type: String, required: true, trim: true },
    bankName: { type: String, default: null, trim: true },
    upiId: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const OrderReturnSchema = new Schema<IOrderReturn>(
  {
    requestedAt: { type: Date, default: Date.now },
    reason: { type: String, required: true, trim: true },

    // optional description
    note: { type: String, default: null, trim: true },

    // ✅ up to 5 images (urls)
    images: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr: any) {
          if (!Array.isArray(arr)) return true;
          return arr.length <= 5;
        },
        message: "You can upload up to 5 images only.",
      },
    },

    // ✅ COD bank details snapshot
    bankDetails: { type: ReturnBankDetailsSchema, default: null },

    items: {
      type: [
        {
          productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
          qty: { type: Number, required: true, min: 1 },
          variantId: { type: Schema.Types.ObjectId, default: null },
          colorKey: { type: String, default: null, trim: true },
        },
      ],
      default: undefined, // optional
    },

    status: {
      type: String,
      enum: ["REQUESTED", "APPROVED", "REJECTED", "PICKUP_CREATED", "RECEIVED", "REFUNDED"],
      default: "REQUESTED",
    },

    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },

    rejectedAt: { type: Date, default: null },
    rejectReason: { type: String, default: null, trim: true },

    returnShipment: { type: OrderShipmentSchema, default: null },
  },
  { _id: false }
);

const OrderRefundSchema = new Schema<IOrderRefund>(
  {
    method: { type: String, enum: ["COD", "ONLINE"], required: true },
    amount: { type: Number, required: true, min: 0 },

    status: { type: String, enum: ["PENDING", "PROCESSED", "FAILED"], default: "PENDING" },

    provider: { type: String, enum: ["RAZORPAY", "MANUAL"], default: null },
    refundId: { type: String, default: null, trim: true },

    processedAt: { type: Date, default: null },
    raw: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderCode: { type: String, required: true, unique: true, index: true, trim: true },

    parentOrderId: { type: Schema.Types.ObjectId, ref: "Order", default: null, index: true },

    items: { type: [OrderItemSchema], required: true },

    totals: {
      type: {
        subtotal: { type: Number, required: true, default: 0 },
        mrpTotal: { type: Number, required: true, default: 0 },
        savings: { type: Number, required: true, default: 0 },
        discount: { type: Number, required: true, default: 0 },
        grandTotal: { type: Number, required: true, default: 0 },
      },
      required: true,
    },

    appliedOffer: { type: Schema.Types.Mixed, default: null },

    contact: {
      type: {
        name: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        email: { type: String, default: null, trim: true },
      },
      required: true,
    },

    address: {
      type: {
        fullName: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        pincode: { type: String, required: true, trim: true },
        state: { type: String, required: true, trim: true },
        city: { type: String, required: true, trim: true },
        addressLine1: { type: String, required: true, trim: true },
        addressLine2: { type: String, default: null, trim: true },
        landmark: { type: String, default: null, trim: true },
      },
      required: true,
    },

    paymentMethod: { type: String, enum: ["COD", "ONLINE"], required: true },
    paymentStatus: { type: String, enum: ["PENDING", "PAID", "FAILED"], default: "PENDING" },

    status: {
      type: String,
      enum: ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
      default: "PLACED",
    },

    pg: { type: Schema.Types.Mixed, default: null },
    cod: { type: Schema.Types.Mixed, default: null },

    shipments: { type: [OrderShipmentSchema], default: [] },

    // ✅ return & refund
    return: { type: OrderReturnSchema, default: null },
    refund: { type: OrderRefundSchema, default: null },
  },
  { timestamps: true }
);

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);
