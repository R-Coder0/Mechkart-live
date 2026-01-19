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
 * Shipment (multi-vendor ready)
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

  // ✅ future: multivendor mapping
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
    orderId?: string | null;      // shiprocket order_id
    shipmentId?: number | null;   // shiprocket shipment_id
    awb?: string | null;
    courierName?: string | null;
    courierCompanyId?: number | null;

    labelUrl?: string | null;
    manifestUrl?: string | null;
    invoiceUrl?: string | null;

    pickupScheduledAt?: Date | null;

    tracking?: any; // later: store last tracking snapshot
    raw?: any;      // save raw API responses (optional)
  } | null;

  status: ShipmentStatus;

  createdAt: Date;
  updatedAt: Date;
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

  appliedOffer?:
    | {
        offerId: Types.ObjectId;
        name: string;
        mode: "AUTO" | "COUPON";
        couponCode?: string | null;
        offerType: "FLAT" | "PERCENT";
        value: number;
        discountAmount: number;
      }
    | null;

  contact: IOrderContact;
  address: IOrderAddress;

  paymentMethod: "COD" | "ONLINE";
  paymentStatus: "PENDING" | "PAID" | "FAILED";
  status: "PLACED" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

  // Razorpay snapshot
  pg?:
    | {
        provider: "RAZORPAY";
        orderId?: string | null;
        paymentId?: string | null;
        signature?: string | null;
        amount?: number | null;
        currency?: string | null;
        verifiedAt?: Date | null;
        raw?: any;
      }
    | null;

  // COD confirmation snapshot
  cod?: {
    confirmedAt?: Date | null;
    confirmedBy?: Types.ObjectId | null;
  } | null;

  // ✅ NEW: shipments array (multi-vendor ready)
  shipments?: IOrderShipment[];

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

    colorKey: { type: String, default: null },
    qty: { type: Number, required: true, min: 1 },

    title: { type: String, required: true, trim: true },
    image: { type: String, default: null },

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
    colorKey: { type: String, default: null },
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

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const OrderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    orderCode: { type: String, required: true, unique: true, index: true, trim: true },

    parentOrderId: { type: Schema.Types.ObjectId, ref: "Order", default: null, index: true },

    items: { type: [OrderItemSchema], required: true },

    totals: {
      subtotal: { type: Number, required: true },
      mrpTotal: { type: Number, required: true },
      savings: { type: Number, required: true },
      discount: { type: Number, required: true, default: 0 },
      grandTotal: { type: Number, required: true, default: 0 },
    },

    appliedOffer: {
      type: {
        offerId: { type: Schema.Types.ObjectId, ref: "Offer" },
        name: { type: String, trim: true },
        mode: { type: String, enum: ["AUTO", "COUPON"] },
        couponCode: { type: String, default: null, trim: true },
        offerType: { type: String, enum: ["FLAT", "PERCENT"] },
        value: { type: Number },
        discountAmount: { type: Number, default: 0 },
      },
      default: null,
    },

    contact: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, trim: true },
    },

    address: {
      fullName: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      addressLine1: { type: String, required: true, trim: true },
      addressLine2: { type: String, trim: true },
      landmark: { type: String, trim: true },
    },

    paymentMethod: { type: String, enum: ["COD", "ONLINE"], required: true },
    paymentStatus: { type: String, enum: ["PENDING", "PAID", "FAILED"], default: "PENDING" },

    status: {
      type: String,
      enum: ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
      default: "PLACED",
    },

    pg: {
      type: {
        provider: { type: String, enum: ["RAZORPAY"], default: "RAZORPAY" },
        orderId: { type: String, default: null, trim: true },
        paymentId: { type: String, default: null, trim: true },
        signature: { type: String, default: null, trim: true },
        amount: { type: Number, default: null },
        currency: { type: String, default: "INR", trim: true },
        verifiedAt: { type: Date, default: null },
        raw: { type: Schema.Types.Mixed, default: null },
      },
      default: null,
    },

    cod: {
      type: {
        confirmedAt: { type: Date, default: null },
        confirmedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
      },
      default: null,
    },

    // ✅ NEW
    shipments: { type: [OrderShipmentSchema], default: [] },
  },
  { timestamps: true }
);

// keep shipment.updatedAt fresh automatically when saving order
OrderSchema.pre("save", function (next) {
  const doc: any = this;
  if (Array.isArray(doc.shipments)) {
    doc.shipments.forEach((s: any) => {
      if (s && !s.createdAt) s.createdAt = new Date();
      s.updatedAt = new Date();
    });
  }
  next();
});

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);
