/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express";
import { Category } from "../../models/Category.model";
import { Types } from "mongoose";

const makeSlug = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");

/**
 * IMPORTANT:
 * DB me filesystem path (C:\... or /home/...) save mat karo.
 * Web path save karo so that frontend can load it via /uploads/<filename>
 */
const imagePathToStore = (req: Request) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return "";
  // multer diskStorage gives filename always
  return `/uploads/${file.filename}`;
};

export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, description, parentCategory } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const slug = makeSlug(name);

    // unique name or slug check
    const existing = await Category.findOne({
      $or: [{ name }, { slug }],
    });

    if (existing) {
      return res
        .status(409)
        .json({ message: "Category with same name/slug already exists" });
    }

    let parentId: Types.ObjectId | null = null;

    if (parentCategory) {
      if (!Types.ObjectId.isValid(parentCategory)) {
        return res.status(400).json({ message: "Invalid parent category id" });
      }

      const parent = await Category.findById(parentCategory);
      if (!parent) {
        return res.status(404).json({ message: "Parent category not found" });
      }

      parentId = parent._id;
    }

    const createdBy = (req as any).admin?._id || null;

    // ✅ category image from multer (field: "image")
    const image = imagePathToStore(req);

    const category = await Category.create({
      name,
      slug,
      description,
      parentCategory: parentId,
      createdBy,
      image,
    });

    return res.status(201).json({
      message: "Category created successfully",
      data: category,
    });
  } catch (err) {
    next(err);
  }
};

export const getAllCategories = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categories = await Category.find()
      .populate("parentCategory", "name slug image")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Categories fetched successfully",
      data: categories,
    });
  } catch (err) {
    next(err);
  }
};

export const getCategoryById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id).populate(
      "parentCategory",
      "name slug image"
    );

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.status(200).json({
      message: "Category fetched successfully",
      data: category,
    });
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { name, description, parentCategory, isActive } = req.body;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // ✅ name + slug update with conflict check (ignore current doc)
    if (name) {
      const newSlug = makeSlug(name);

      const conflict = await Category.findOne({
        _id: { $ne: category._id },
        $or: [{ name }, { slug: newSlug }],
      });

      if (conflict) {
        return res
          .status(409)
          .json({ message: "Category with same name/slug already exists" });
      }

      category.name = name;
      category.slug = newSlug;
    }

    if (typeof description !== "undefined") {
      category.description = description;
    }

    if (typeof isActive !== "undefined") {
      category.isActive = isActive;
    }

    if (typeof parentCategory !== "undefined") {
      if (parentCategory === null || parentCategory === "") {
        category.parentCategory = null;
      } else {
        if (!Types.ObjectId.isValid(parentCategory)) {
          return res
            .status(400)
            .json({ message: "Invalid parent category id" });
        }

        if (String(category._id) === String(parentCategory)) {
          return res
            .status(400)
            .json({ message: "Category cannot be parent of itself" });
        }

        const parent = await Category.findById(parentCategory);
        if (!parent) {
          return res.status(404).json({ message: "Parent category not found" });
        }

        category.parentCategory = parent._id;
      }
    }

    // ✅ update image only if new file uploaded
    const image = imagePathToStore(req);
    if (image) {
      category.image = image;
    }

    await category.save();

    return res.status(200).json({
      message: "Category updated successfully",
      data: category,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    await category.deleteOne();

    return res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    next(err);
  }
};
