import { Schema, model, Document, Types } from "mongoose";

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

export interface IProduct extends Document {
  productId: string; // MECH000001 etc.

  title: string;
  slug: string;
  description?: string;
  features?: string;

  featureImage?: string;
  galleryImages: string[];

  // ✅ NEW: product-level colors
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
  createdBy?: Types.ObjectId | null;
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

    // keep comboText (variant identity)
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

    // ✅ NEW: colors array on product
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

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true }
);

/**
 * Helper inside model:
 * totalStock = variants sum (if variants exist) else baseStock
 * isLowStock = totalStock <= lowStockThreshold
 */
const computeStock = (doc: IProduct) => {
  const variantsArr = Array.isArray(doc.variants) ? doc.variants : [];
  const hasVariants = variantsArr.length > 0;

  if (hasVariants) {
    doc.baseStock = 0;
    doc.totalStock = variantsArr.reduce(
      (sum, v) => sum + Number(v.quantity || 0),
      0
    );
  } else {
    doc.totalStock = Number(doc.baseStock || 0);
  }

  const threshold = Number(doc.lowStockThreshold ?? 5);
  doc.isLowStock = doc.totalStock <= threshold;
};

/**
 * Auto-generate productId = MECH000001, MECH000002, ...
 */
ProductSchema.pre<IProduct>("validate", async function (next) {
  try {
    if (this.isNew && !this.productId) {
      const last: { productId?: string } | null = await (this.constructor as any)
        .findOne({}, { productId: 1 })
        .sort({ createdAt: -1 })
        .lean();

      let nextNumber = 1;
      if (last?.productId) {
        const numericPart = last.productId.replace(/^CH/, "");
        const parsed = parseInt(numericPart, 10);
        if (!Number.isNaN(parsed)) nextNumber = parsed + 1;
      }

      this.productId = `CH${String(nextNumber).padStart(6, "0")}`;
    }

    // ✅ compute stock on validate as well (safe)
    computeStock(this);

    next();
  } catch (e) {
    next(e as any);
  }
});

ProductSchema.pre("findOneAndUpdate", function (next) {
  try {
    return next();
  } catch (err) {
    return next(err as any);
  }
});

export const Product = model<IProduct>("Product", ProductSchema);
