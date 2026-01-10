import { Schema, model, Document, Types } from "mongoose";

export interface ICategory extends Document {
    _id: Types.ObjectId;
    name: string;
    slug: string;
    description?: string;
      image?: string;              // ✅ category image
    parentCategory?: Types.ObjectId | null;
    isActive: boolean;
    createdBy?: Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    // ✅ Category Image (for home, listing, mega menu)
    image: {
      type: String,
      default: "",
    },

    parentCategory: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);


export const Category = model<ICategory>("Category", CategorySchema);
