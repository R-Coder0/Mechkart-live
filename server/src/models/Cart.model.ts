import { Schema, model, Types, Document } from "mongoose";

/**
 * Cart Item
 * Identified by: productId + variantId + colorKey
 */
export interface ICartItem {
  productId: Types.ObjectId;

  // ✅ Snapshot public code (CH000001 / MECH999999 etc.)
  productCode?: string; // from Product.productId

  // OPTIONAL (null for non-variant products)
  variantId?: Types.ObjectId | null;

  // OPTIONAL (visual-only, normalized lowercase)
  colorKey?: string | null;

  qty: number;
  isSelected: boolean;


  // snapshots (UI safe)
  title: string;
  image: string;

  mrp: number;
  salePrice: number;

  addedAt: Date;
  updatedAt: Date;
}

/**
 * Cart Document
 * ownerKey = "u:<userId>" OR "g:<guestId>"
 */
export interface ICart extends Document {
  ownerKey: string;

  userId?: Types.ObjectId | null;
  guestId?: string | null;

  items: ICartItem[];

  createdAt: Date;
  updatedAt: Date;
}

/* -------------------- Cart Item Schema -------------------- */
const CartItemSchema = new Schema<ICartItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    // ✅ Snapshot public code
    productCode: {
      type: String,
      default: "",
      trim: true,
    },

    // OPTIONAL
    variantId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
      // ref: "Variant", // optional: only if you have a Variant collection
    },

    colorKey: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },

    qty: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    isSelected: {
      type: Boolean,
      default: true, // ✅ CRITICAL
    },


    // snapshots
    title: { type: String, required: true, trim: true },
    image: { type: String, required: true, trim: true },

    mrp: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, required: true, min: 0 },

    addedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

/* -------------------- Cart Schema -------------------- */
const CartSchema = new Schema<ICart>(
  {
    ownerKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    guestId: {
      type: String,
      default: null,
      trim: true,
    },

    items: { type: [CartItemSchema], default: [] },
  },
  { timestamps: true }
);

/* -------------------- Hooks -------------------- */
CartSchema.pre("save", function (next) {
  try {
    const cart = this as ICart;
    const now = new Date();

    if (Array.isArray(cart.items)) {
      cart.items.forEach((it) => {
        // ensure dates
        if (!it.addedAt) it.addedAt = now;
        it.updatedAt = now;

        // normalize colorKey
        if (typeof it.colorKey === "string") {
          const ck = it.colorKey.trim().toLowerCase();
          it.colorKey = ck.length ? ck : null;
        }

        // normalize productCode/title/image
        if (typeof it.productCode === "string") it.productCode = it.productCode.trim();
        if (typeof (it as any).isSelected !== "boolean") {
          (it as any).isSelected = true;
        }
        if (typeof it.title === "string") it.title = it.title.trim();
        if (typeof it.image === "string") it.image = it.image.trim();
      });
    }

    next();
  } catch (e) {
    next(e as any);
  }
});

export const Cart = model<ICart>("Cart", CartSchema);
