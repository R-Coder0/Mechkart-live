/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Product } from "../../models/Product.model";
import { Category } from "../../models/Category.model";

const makeSlug = (title: string) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

// helper – safely convert to number
const toNumber = (value: any): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

// helper – normalize galleryImages from body
const normalizeGalleryFromBody = (galleryImages: any): string[] => {
  if (!galleryImages) return [];
  if (Array.isArray(galleryImages)) return galleryImages;
  if (typeof galleryImages === "string") {
    if (galleryImages.includes(",")) {
      return galleryImages
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }
    return [galleryImages];
  }
  return [];
};

// helper – parse variants/colors (JSON string OR array OR object with numeric keys)
const normalizeArrayLike = (value: any): any[] => {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return normalizeArrayLike(parsed);
    } catch {
      return [];
    }
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);

    const numericKeys = keys
      .map((k) => ({ k, n: Number(k) }))
      .filter((x) => Number.isFinite(x.n))
      .sort((a, b) => a.n - b.n)
      .map((x) => x.k);

    if (numericKeys.length) {
      return numericKeys.map((k) => value[k]);
    }

    if (Array.isArray((value as any).variants)) return (value as any).variants;
    if (Array.isArray((value as any).colors)) return (value as any).colors;

    return [];
  }

  return [];
};

const normalizeVariants = (variants: any) => normalizeArrayLike(variants);
const normalizeColors = (colors: any) => normalizeArrayLike(colors);

/**
 * Convert req.files (array or object) into a flat array.
 * Works with both: upload.any() and upload.fields()
 */
const getAllFilesAsArray = (req: Request): Express.Multer.File[] => {
  const anyReq = req as any;
  const files = anyReq.files as
    | Express.Multer.File[]
    | { [field: string]: Express.Multer.File[] }
    | undefined;

  if (!files) return [];

  if (Array.isArray(files)) return files;

  return Object.values(files).flat();
};

/**
 * Extract main feature image + galleryImages paths from uploaded files
 */
const extractImagePaths = (req: Request) => {
  const allFiles = getAllFilesAsArray(req);

  let featureImagePath: string | undefined;
  const galleryPaths: string[] = [];

  for (const file of allFiles) {
    if (file.fieldname === "featureImage" && !featureImagePath) {
      featureImagePath = `/uploads/${file.filename}`;
    }
    if (file.fieldname === "galleryImages") {
      galleryPaths.push(`/uploads/${file.filename}`);
    }
  }

  return { featureImagePath, galleryPaths };
};

/**
 * Extract variant images grouped by variant index.
 * fieldname: variantImages[0], variantImages[1]...
 */
const extractVariantImages = (req: Request): Record<number, string[]> => {
  const allFiles = getAllFilesAsArray(req);
  const result: Record<number, string[]> = {};

  allFiles.forEach((file) => {
    const match = file.fieldname.match(/^variantImages\[(\d+)\]$/);
    if (!match) return;

    const idx = Number(match[1]);
    if (!result[idx]) result[idx] = [];

    result[idx].push(`/uploads/${file.filename}`);
  });

  return result;
};

/**
 * ✅ NEW: Extract color images grouped by color index.
 * fieldname: colorImages[0], colorImages[1]...
 */
const extractColorImages = (req: Request): Record<number, string[]> => {
  const allFiles = getAllFilesAsArray(req);
  const result: Record<number, string[]> = {};

  allFiles.forEach((file) => {
    const match = file.fieldname.match(/^colorImages\[(\d+)\]$/);
    if (!match) return;

    const idx = Number(match[1]);
    if (!result[idx]) result[idx] = [];

    result[idx].push(`/uploads/${file.filename}`);
  });

  return result;
};

/**
 * Build variants array with proper numeric fields + images merged in
 * If existingVariants passed, preserve old images when body doesn't send images and no uploads came.
 */
const buildVariants = (
  rawVariants: any,
  variantImagesMap: Record<number, string[]>,
  existingVariants: any[] = []
) => {
  const arr = normalizeVariants(rawVariants);

  return arr.map((v: any, idx: number) => {
    const existing =
      (v?._id &&
        existingVariants.find((ev: any) => String(ev._id) === String(v._id))) ||
      existingVariants[idx];

    const existingImages = Array.isArray(existing?.images) ? existing.images : [];

    // ✅ IMPORTANT:
    // - If "images" field exists in payload -> overwrite (even empty [] means remove all)
    // - Else preserve existing
    const hasImagesKey = v && Object.prototype.hasOwnProperty.call(v, "images");
    const incomingImages = Array.isArray(v?.images) ? v.images : [];

    const baseImages = hasImagesKey ? incomingImages : existingImages;

    // ✅ Append newly uploaded images (if any)
    const uploaded = variantImagesMap[idx] || [];
    const finalImages = [...baseImages, ...uploaded];

    return {
      _id: v._id,
      label: v.label,
      weight: v.weight,
      size: v.size,

      // remove color from variants if you want (optional but recommended)
      // color: undefined,

      comboText: v.comboText,

      quantity: typeof v.quantity === "number" ? v.quantity : Number(v.quantity || 0),
      mrp: typeof v.mrp === "number" ? v.mrp : Number(v.mrp || 0),
      salePrice:
        typeof v.salePrice === "number" ? v.salePrice : Number(v.salePrice || 0),

      images: finalImages,
    };
  });
};


/**
 * ✅ NEW: Build colors array with images merged in
 * - colors live at product level
 * - preserve existing color images if no new images provided
 */
const buildColors = (
  rawColors: any,
  colorImagesMap: Record<number, string[]>,
  existingColors: any[] = []
) => {
  const arr = normalizeColors(rawColors);

  return arr
    .map((c: any, idx: number) => {
      const hasImagesField = Object.prototype.hasOwnProperty.call(c || {}, "images");
      const incomingImages = Array.isArray(c?.images) ? c.images : [];
      const uploadedImages = colorImagesMap[idx] || [];

      const existing =
        (c?._id &&
          existingColors.find((ec: any) => String(ec._id) === String(c._id))) ||
        existingColors[idx];

      const existingImages = Array.isArray(existing?.images) ? existing.images : [];

      // ✅ NEW RULE:
      // If body includes "images" field (even empty) OR there are uploads -> use incoming+uploads.
      // Else preserve existing images.
      const mergedImages =
        hasImagesField || uploadedImages.length > 0
          ? [...incomingImages, ...uploadedImages]
          : existingImages;

      const orderIndexNum =
        typeof c.orderIndex === "number" ? c.orderIndex : Number(c.orderIndex ?? idx);

      return {
        _id: c._id,
        name: String(c.name || "").trim(),
        hex: typeof c.hex === "string" ? c.hex : "",
        orderIndex: Number.isFinite(orderIndexNum) ? orderIndexNum : idx,
        images: mergedImages,
      };
    })
    .filter((x) => x.name);
};


/**
 * Stock calculation:
 * - if variants exist: sum of variant.quantity
 * - else: baseStock
 */
const calcTotalStock = (variantsArr: any[], baseStock: number) => {
  const hasVariants = Array.isArray(variantsArr) && variantsArr.length > 0;
  if (hasVariants) {
    return variantsArr.reduce((sum, v) => sum + Number(v.quantity || 0), 0);
  }
  return Number(baseStock || 0);
};

const calcLowStockFlag = (totalStock: number, threshold: number) => {
  return totalStock <= Number(threshold || 0);
};

/**
 * Generate next productId in format: MECH000001, MECH000002, ...
 */
const generateNextProductId = async (): Promise<string> => {
  const prefix = "MECH";

  const lastProduct = await Product.findOne({})
    .sort({ createdAt: -1 })
    .select("productId")
    .lean();

  let nextNumber = 1;

  if (lastProduct?.productId) {
    const current = parseInt(lastProduct.productId.replace(prefix, ""), 10);
    if (!Number.isNaN(current)) nextNumber = current + 1;
  }

  const padded = String(nextNumber).padStart(6, "0");
  return `${prefix}${padded}`;
};

export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      title,
      description,
      features,
      featureImage,
      galleryImages,
      mrp,
      salePrice,
      variants,
      colors, // ✅ NEW
      baseStock,
      lowStockThreshold,
      categoryId,
      subCategoryId,
    } = req.body;

    const baseMrp = toNumber(mrp);
    const baseSale = toNumber(salePrice);

    if (!title || baseMrp === null || baseSale === null || !categoryId) {
      return res.status(400).json({
        message: "title, mrp, salePrice and categoryId are required",
      });
    }

    if (!Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: "Invalid category id" });
    }

    if (subCategoryId && !Types.ObjectId.isValid(subCategoryId)) {
      return res.status(400).json({ message: "Invalid sub category id" });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    let subCatId: Types.ObjectId | null = null;
    if (subCategoryId) {
      const subCat = await Category.findById(subCategoryId);
      if (!subCat) {
        return res.status(404).json({ message: "Sub category not found" });
      }
      subCatId = subCat._id;
    }

    const slug = makeSlug(title);

    const existing = await Product.findOne({ slug });
    if (existing) {
      return res
        .status(409)
        .json({ message: "Product with same slug/title already exists" });
    }

    const createdBy = (req as any).admin?._id || null;

    const productId = await generateNextProductId();

    // images from multer
    const { featureImagePath, galleryPaths } = extractImagePaths(req);
    const variantImagesMap = extractVariantImages(req);

    // ✅ NEW: color images map
    const colorImagesMap = extractColorImages(req);

    const bodyGallery = normalizeGalleryFromBody(galleryImages);
    const finalGallery = [...bodyGallery, ...galleryPaths];

    // build variants
    const builtVariants = buildVariants(variants, variantImagesMap);

    // ✅ NEW: build colors
    const builtColors = buildColors(colors, colorImagesMap);

    const parsedBaseStock = toNumber(baseStock) ?? 0;
    const parsedThreshold = toNumber(lowStockThreshold) ?? 5;

    const totalStock = calcTotalStock(builtVariants, parsedBaseStock);
    const isLowStock = calcLowStockFlag(totalStock, parsedThreshold);

    const product = await Product.create({
      productId,

      title,
      slug,
      description,
      features: typeof features === "string" ? features : "",
      featureImage: featureImagePath || featureImage,
      galleryImages: finalGallery,

      // ✅ NEW
      colors: builtColors,

      mrp: baseMrp,
      salePrice: baseSale,

      variants: builtVariants,

      baseStock: builtVariants.length > 0 ? 0 : parsedBaseStock,
      totalStock,
      lowStockThreshold: parsedThreshold,
      isLowStock,

      category: category._id,
      subCategory: subCatId,
      createdBy,
    });

    return res.status(201).json({
      message: "Product created successfully",
      data: product,
    });
  } catch (err) {
    next(err);
  }
};

export const getProductBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({ slug })
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .sort({ createdAt: -1 });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(200).json({
      message: "Product fetched successfully",
      data: product,
    });
  } catch (err) {
    next(err);
  }
};

export const getAllProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      categoryId,
      subCategoryId,
      categorySlug,
      parentSlug,
      subSlug,
      active,
      lowStock,
    } = req.query as any;

    const filter: any = {};

    if (categoryId && Types.ObjectId.isValid(String(categoryId))) {
      filter.category = categoryId;
    }

    if (subCategoryId && Types.ObjectId.isValid(String(subCategoryId))) {
      filter.subCategory = subCategoryId;
    }

    if (!filter.category && categorySlug) {
      const cat = await Category.findOne({ slug: String(categorySlug) }).select(
        "_id"
      );
      if (cat) filter.category = cat._id;
      else {
        return res.status(200).json({
          message: "Products fetched successfully",
          data: [],
        });
      }
    }

    if (!filter.subCategory && parentSlug && subSlug) {
      const parent = await Category.findOne({ slug: String(parentSlug) }).select(
        "_id"
      );
      if (!parent) {
        return res.status(200).json({
          message: "Products fetched successfully",
          data: [],
        });
      }

      const sub = await Category.findOne({
        slug: String(subSlug),
        parentCategory: parent._id,
      }).select("_id");

      if (sub) filter.subCategory = sub._id;
      else {
        return res.status(200).json({
          message: "Products fetched successfully",
          data: [],
        });
      }
    }

    if (typeof active !== "undefined") {
      filter.isActive = String(active) === "true";
    }

    if (typeof lowStock !== "undefined") {
      filter.isLowStock = String(lowStock) === "true";
    }

    const products = await Product.find(filter)
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Products fetched successfully",
      data: products,
    });
  } catch (err) {
    next(err);
  }
};

export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id)
      .populate("category", "name slug")
      .populate("subCategory", "name slug");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(200).json({
      message: "Product fetched successfully",
      data: product,
    });
  } catch (err) {
    next(err);
  }
};

export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const {
      title,
      description,
      features,
      featureImage, // (string path from body - optional)
      galleryImages,
      mrp,
      salePrice,
      variants,
      colors,
      baseStock,
      lowStockThreshold,
      categoryId,
      subCategoryId,
      isActive,
      removeFeatureImage, // ✅ from frontend: "true"
    } = req.body as any;

    // -------- BASIC FIELDS --------
    if (title) {
      product.title = title;
      product.slug = makeSlug(title);
    }
    if (typeof description !== "undefined") product.description = description;
    if (typeof features !== "undefined") {
      product.features = typeof features === "string" ? features : "";
    }

    // -------- IMAGES (MULTER) --------
    const { featureImagePath, galleryPaths } = extractImagePaths(req);
    const variantImagesMap = extractVariantImages(req);
    const colorImagesMap = extractColorImages(req);

    // ✅ FEATURE IMAGE: allow remove + replace + preserve
    const removeFeature = removeFeatureImage === "true" || removeFeatureImage === true;

    if (removeFeature) {
      product.featureImage = "";
    }

    // if new file uploaded, it should win
    if (featureImagePath) {
      product.featureImage = featureImagePath;
    } else if (typeof featureImage !== "undefined" && !removeFeature) {
      // if body sends a path and not removing
      product.featureImage = featureImage;
    }

    // ✅ GALLERY
    if (typeof galleryImages !== "undefined" || galleryPaths.length > 0) {
      const bodyGallery = normalizeGalleryFromBody(galleryImages);
      product.galleryImages = [...bodyGallery, ...galleryPaths];
    }

    // -------- PRICING --------
    const baseMrp = toNumber(mrp);
    if (baseMrp !== null) product.mrp = baseMrp;

    const baseSale = toNumber(salePrice);
    if (baseSale !== null) product.salePrice = baseSale;

    // -------- VARIANTS + STOCK AUTO --------
    let updatedVariants: any[] = product.variants as any[];

    if (typeof variants !== "undefined") {
      updatedVariants = buildVariants(
        variants,
        variantImagesMap,
        product.variants as any[]
      );
      product.variants = updatedVariants as any;
    } else if (Object.keys(variantImagesMap).length > 0) {
      // edge: only images uploaded but variants body not provided
      updatedVariants = buildVariants(
        product.variants as any[],
        variantImagesMap,
        product.variants as any[]
      );
      product.variants = updatedVariants as any;
    }

    // -------- COLORS (PRODUCT LEVEL) --------
    if (typeof colors !== "undefined") {
      const updatedColors = buildColors(
        colors,
        colorImagesMap,
        (product as any).colors || []
      );
      (product as any).colors = updatedColors as any;
    } else if (Object.keys(colorImagesMap).length > 0) {
      const updatedColors = buildColors(
        (product as any).colors || [],
        colorImagesMap,
        (product as any).colors || []
      );
      (product as any).colors = updatedColors as any;
    }

    // -------- THRESHOLD + BASE STOCK --------
    const thresholdNum = toNumber(lowStockThreshold);
    if (thresholdNum !== null) {
      product.lowStockThreshold = thresholdNum;
    }

    const baseStockNum = toNumber(baseStock);
    if (
      baseStockNum !== null &&
      (!updatedVariants || updatedVariants.length === 0)
    ) {
      product.baseStock = baseStockNum;
    }

    // if variants exist, baseStock should be 0
    if (updatedVariants && updatedVariants.length > 0) {
      product.baseStock = 0;
    }

    // recalc stock + lowStock
    const finalTotalStock = calcTotalStock(
      updatedVariants || [],
      product.baseStock || 0
    );
    product.totalStock = finalTotalStock;

    const finalThreshold = product.lowStockThreshold ?? 5;
    product.isLowStock = calcLowStockFlag(finalTotalStock, finalThreshold);

    // -------- ACTIVE --------
    if (typeof isActive !== "undefined") {
      product.isActive = isActive === "true" || isActive === true;
    }

    // -------- CATEGORY / SUBCATEGORY --------
    if (categoryId) {
      if (!Types.ObjectId.isValid(categoryId)) {
        return res.status(400).json({ message: "Invalid category id" });
      }
      const cat = await Category.findById(categoryId);
      if (!cat) {
        return res.status(404).json({ message: "Category not found" });
      }
      product.category = cat._id;
    }

    if (typeof subCategoryId !== "undefined") {
      if (!subCategoryId) {
        product.subCategory = null;
      } else {
        if (!Types.ObjectId.isValid(subCategoryId)) {
          return res.status(400).json({ message: "Invalid sub category id" });
        }
        const sub = await Category.findById(subCategoryId);
        if (!sub) {
          return res.status(404).json({ message: "Sub category not found" });
        }
        product.subCategory = sub._id;
      }
    }

    await product.save();

    return res.status(200).json({
      message: "Product updated successfully",
      data: product,
    });
  } catch (err) {
    next(err);
  }
};


export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    await product.deleteOne();

    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (err) {
    next(err);
  }
};
