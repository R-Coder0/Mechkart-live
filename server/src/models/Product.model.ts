import { Schema, model, Document, Types } from "mongoose";
import { Counter } from "./Counter.model"; // ✅ ADD THIS

// -------------------- COLORS (Product level) --------------------
export interface IProductColor {
  _id?: Types.ObjectId;
  name: string;          // e.g. Black, Red
  hex?: string;          // optional: #000000
  images: string[];      // gallery for this color
  orderIndex: number;    // 0 = default first
}

export interface IProductVariant {
  _id?: Types.ObjectId;

  // commercial identity (pick one dimension)
  label?: string;
  weight?: string;
  size?: string;
  comboText?: string;

  // NOTE: keep for backward compatibility only (not used for combinations)
  color?: string;

  quantity: number;
  mrp: number;
  salePrice: number;

  // optional: for combo/style variants (when variant itself changes visuals)
  images: string[];
}

export interface IProductShip {
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  weightKg: number;
}

export interface IProduct extends Document {
  productId: string; // MECH000001 etc.

  title: string;
  slug: string;
  description?: string;
  features?: string;

  featureImage?: string;
  galleryImages: string[];

  // ✅ product-level colors
  colors: IProductColor[];

  mrp: number;
  salePrice: number;

  // STOCK (base + calculated)
  baseStock: number;          // used when no variants
  totalStock: number;         // auto-calc (variants sum OR baseStock)
  lowStockThreshold: number;  // default 5
  isLowStock: boolean;        // auto flag based on threshold

  variants: IProductVariant[];

  category: Types.ObjectId;
  subCategory?: Types.ObjectId | null;

  isActive: boolean;

  // ✅ NEW: ownership (multivendor)
  ownerType: "ADMIN" | "VENDOR";
  vendorId?: Types.ObjectId | null;

  // ✅ NEW: approval flow for vendor products
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  approvalNote?: string;

  // ✅ NEW: shipping dimensions on product
  ship: IProductShip;

  createdBy?: Types.ObjectId | null; // admin who created/approved (optional)
}

// -------------------- SCHEMAS --------------------
const ColorSchema = new Schema<IProductColor>(
  {
    name: { type: String, required: true, trim: true },
    hex: { type: String, default: "" },
    images: { type: [String], default: [] },
    orderIndex: { type: Number, default: 0 },
  },
  { _id: true }
);

const VariantSchema = new Schema<IProductVariant>(
  {
    label: { type: String },

    weight: { type: String },
    size: { type: String },

    comboText: { type: String },

    // keep color only for backward compatibility
    color: { type: String },

    quantity: { type: Number, required: true, default: 0 },
    mrp: { type: Number, required: true },
    salePrice: { type: Number, required: true },

    images: { type: [String], default: [] },
  },
  { _id: true }
);

const ShipSchema = new Schema<IProductShip>(
  {
    lengthCm: { type: Number, default: 20 },
    breadthCm: { type: Number, default: 15 },
    heightCm: { type: Number, default: 10 },
    weightKg: { type: Number, default: 0.5 },
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },

    description: { type: String },
    features: { type: String, default: "" },

    featureImage: { type: String },
    galleryImages: { type: [String], default: [] },

    // ✅ colors array on product
    colors: { type: [ColorSchema], default: [] },

    mrp: { type: Number, required: true },
    salePrice: { type: Number, required: true },

    baseStock: { type: Number, default: 0 },
    totalStock: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    isLowStock: { type: Boolean, default: false },

    variants: { type: [VariantSchema], default: [] },

    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subCategory: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    isActive: { type: Boolean, default: true },

    // ✅ multivendor fields
    ownerType: {
      type: String,
      enum: ["ADMIN", "VENDOR"],
      default: "ADMIN",
      index: true,
    },

    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },

    approvalStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "APPROVED", // ✅ admin-created products auto approved
      index: true,
    },

    approvalNote: { type: String, default: "" },

    // ✅ shipment defaults
    ship: { type: ShipSchema, default: () => ({}) },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true }
);

/**
 * Helper:
 * totalStock = variants sum (if variants exist) else baseStock
 * isLowStock = totalStock <= lowStockThreshold
 */
const computeStock = (doc: IProduct) => {
  const variantsArr = Array.isArray(doc.variants) ? doc.variants : [];
  const hasVariants = variantsArr.length > 0;

  if (hasVariants) {
    doc.baseStock = 0;
    doc.totalStock = variantsArr.reduce((sum, v) => sum + Number(v.quantity || 0), 0);
  } else {
    doc.totalStock = Number(doc.baseStock || 0);
  }

  const threshold = Number(doc.lowStockThreshold ?? 5);
  doc.isLowStock = doc.totalStock <= threshold;
};

/**
 * ✅ Auto-generate productId safely using Counter (atomic)
 */
ProductSchema.pre<IProduct>("validate", async function (next) {
  try {
    // ✅ productId generation (atomic, race-condition safe)
    if (this.isNew && !this.productId) {
      const PREFIX = "MECH";

      const counter = await Counter.findOneAndUpdate(
        { name: "productId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      ).lean();

      const nextNumber = counter?.seq ?? 1;
      this.productId = `${PREFIX}${String(nextNumber).padStart(6, "0")}`;
    }

    // ✅ ship defaults normalize
    if (!(this as any).ship) {
      (this as any).ship = { lengthCm: 20, breadthCm: 15, heightCm: 10, weightKg: 0.5 };
    } else {
      (this as any).ship.lengthCm = Number((this as any).ship.lengthCm ?? 20);
      (this as any).ship.breadthCm = Number((this as any).ship.breadthCm ?? 15);
      (this as any).ship.heightCm = Number((this as any).ship.heightCm ?? 10);
      (this as any).ship.weightKg = Number((this as any).ship.weightKg ?? 0.5);
    }

    computeStock(this);
    next();
  } catch (e) {
    next(e as any);
  }
});

export const Product = model<IProduct>("Product", ProductSchema);
