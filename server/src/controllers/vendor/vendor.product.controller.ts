/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Product } from "../../models/Product.model";
import { Category } from "../../models/Category.model";

/**
 * IMPORTANT:
 * - Vendor products => ownerType="VENDOR", vendorId=<vendorId>, approvalStatus="PENDING"
 * - Admin approve later
 * - Vendor sees base price (NO shipping markup here)
 */

const makeSlug = (title: string) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const toNumber = (value: any): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

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

    if (numericKeys.length) return numericKeys.map((k) => (value as any)[k]);

    if (Array.isArray((value as any).variants)) return (value as any).variants;
    if (Array.isArray((value as any).colors)) return (value as any).colors;

    return [];
  }

  return [];
};

const normalizeVariants = (variants: any) => normalizeArrayLike(variants);
const normalizeColors = (colors: any) => normalizeArrayLike(colors);

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

    const hasImagesKey = v && Object.prototype.hasOwnProperty.call(v, "images");
    const incomingImages = Array.isArray(v?.images) ? v.images : [];

    const baseImages = hasImagesKey ? incomingImages : existingImages;

    const uploaded = variantImagesMap[idx] || [];
    const finalImages = [...baseImages, ...uploaded];

    return {
      _id: v._id,
      label: v.label,
      weight: v.weight,
      size: v.size,
      comboText: v.comboText,

      quantity: typeof v.quantity === "number" ? v.quantity : Number(v.quantity || 0),
      mrp: typeof v.mrp === "number" ? v.mrp : Number(v.mrp || 0),
      salePrice: typeof v.salePrice === "number" ? v.salePrice : Number(v.salePrice || 0),

      images: finalImages,
    };
  });
};

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

const calcTotalStock = (variantsArr: any[], baseStock: number) => {
  const hasVariants = Array.isArray(variantsArr) && variantsArr.length > 0;
  if (hasVariants) return variantsArr.reduce((sum, v) => sum + Number(v.quantity || 0), 0);
  return Number(baseStock || 0);
};

const calcLowStockFlag = (totalStock: number, threshold: number) =>
  totalStock <= Number(threshold || 0);

const getShipDefaults = () => {
  const L = Number(process.env.SHIP_LENGTH_CM ?? 20);
  const B = Number(process.env.SHIP_BREADTH_CM ?? 15);
  const H = Number(process.env.SHIP_HEIGHT_CM ?? 10);
  const W = Number(process.env.SHIP_WEIGHT_KG ?? 0.5);

  return {
    lengthCm: Number.isFinite(L) ? L : 20,
    breadthCm: Number.isFinite(B) ? B : 15,
    heightCm: Number.isFinite(H) ? H : 10,
    weightKg: Number.isFinite(W) ? W : 0.5,
  };
};

/**
 * VENDOR: CREATE PRODUCT
 * POST /api/vendors/products
 */
export const vendorCreateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorIdRaw = (req as any)?.vendor?._id;
    const vendorId =
      Types.ObjectId.isValid(String(vendorIdRaw)) ? new Types.ObjectId(String(vendorIdRaw)) : null;

    if (!vendorId) return res.status(401).json({ message: "Unauthorized" });

    const {
      title,
      description,
      features,
      featureImage,
      galleryImages,
      mrp,
      salePrice,
      variants,
      colors,
      baseStock,
      lowStockThreshold,
      categoryId,
      subCategoryId,
    } = req.body as any;

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
    if (!category) return res.status(404).json({ message: "Category not found" });

    let subCatId: Types.ObjectId | null = null;
    if (subCategoryId) {
      const subCat = await Category.findById(subCategoryId);
      if (!subCat) return res.status(404).json({ message: "Sub category not found" });
      subCatId = subCat._id;
    }

    const slug = makeSlug(title);
    const existing = await Product.findOne({ slug }).select("_id");
    const finalSlug = existing ? `${slug}-${String(vendorId).slice(-6)}` : slug;

    const { featureImagePath, galleryPaths } = extractImagePaths(req);
    const variantImagesMap = extractVariantImages(req);
    const colorImagesMap = extractColorImages(req);

    const bodyGallery = normalizeGalleryFromBody(galleryImages);
    const finalGallery = [...bodyGallery, ...galleryPaths];

    const builtVariants = buildVariants(variants, variantImagesMap);
    const builtColors = buildColors(colors, colorImagesMap);

    const parsedBaseStock = toNumber(baseStock) ?? 0;
    const parsedThreshold = toNumber(lowStockThreshold) ?? 5;

    const totalStock = calcTotalStock(builtVariants, parsedBaseStock);
    const isLowStock = calcLowStockFlag(totalStock, parsedThreshold);

    // SHIPPING (save into product.ship)
    const shipDefaults = getShipDefaults();

    const rawShipLength =
      (req.body as any)?.shipLengthCm ??
      (req.body as any)?.["ship[lengthCm]"] ??
      (req.body as any)?.ship?.lengthCm;

    const rawShipBreadth =
      (req.body as any)?.shipBreadthCm ??
      (req.body as any)?.["ship[breadthCm]"] ??
      (req.body as any)?.ship?.breadthCm;

    const rawShipHeight =
      (req.body as any)?.shipHeightCm ??
      (req.body as any)?.["ship[heightCm]"] ??
      (req.body as any)?.ship?.heightCm;

    const rawShipWeight =
      (req.body as any)?.shipWeightKg ??
      (req.body as any)?.["ship[weightKg]"] ??
      (req.body as any)?.ship?.weightKg;

    const ship = {
      lengthCm: toNumber(rawShipLength) ?? shipDefaults.lengthCm,
      breadthCm: toNumber(rawShipBreadth) ?? shipDefaults.breadthCm,
      heightCm: toNumber(rawShipHeight) ?? shipDefaults.heightCm,
      weightKg: toNumber(rawShipWeight) ?? shipDefaults.weightKg,
    };

    const product = await Product.create({
      title,
      slug: finalSlug,
      description,
      features: typeof features === "string" ? features : "",
      featureImage: featureImagePath || featureImage,
      galleryImages: finalGallery,

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

      ownerType: "VENDOR",
      vendorId,
      approvalStatus: "PENDING",

      ship,
    });

    return res.status(201).json({
      message: "Product submitted for approval",
      data: product,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * VENDOR: LIST MY PRODUCTS
 * GET /api/vendors/products
 */
export const vendorListMyProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorIdRaw = (req as any)?.vendor?._id;
    const vendorId =
      Types.ObjectId.isValid(String(vendorIdRaw)) ? new Types.ObjectId(String(vendorIdRaw)) : null;

    if (!vendorId) return res.status(401).json({ message: "Unauthorized" });

    const { approvalStatus, active, lowStock, q } = req.query as any;

    const filter: any = {
      ownerType: "VENDOR",
      vendorId,
    };

    if (approvalStatus) filter.approvalStatus = String(approvalStatus).toUpperCase();
    if (typeof active !== "undefined") filter.isActive = String(active) === "true";
    if (typeof lowStock !== "undefined") filter.isLowStock = String(lowStock) === "true";

    if (q) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: rx }, { slug: rx }, { productId: rx }];
    }

    const products = await Product.find(filter)
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .sort({ createdAt: -1 });

    return res.json({ data: products });
  } catch (err) {
    next(err);
  }
};

/**
 * VENDOR: GET SINGLE MY PRODUCT
 * GET /api/vendors/products/:id
 */
export const vendorGetMyProductById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorIdRaw = (req as any)?.vendor?._id;
    const vendorId =
      Types.ObjectId.isValid(String(vendorIdRaw)) ? new Types.ObjectId(String(vendorIdRaw)) : null;

    if (!vendorId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid product id" });

    const product = await Product.findOne({
      _id: new Types.ObjectId(id),
      ownerType: "VENDOR",
      vendorId,
    })
      .populate("category", "name slug")
      .populate("subCategory", "name slug");

    if (!product) return res.status(404).json({ message: "Product not found" });

    return res.json({ data: product });
  } catch (err) {
    next(err);
  }
};

/**
 * VENDOR: UPDATE MY PRODUCT
 * PUT /api/vendors/products/:id
 * Rule: vendor edit => approvalStatus back to PENDING
 */
export const vendorUpdateMyProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorIdRaw = (req as any)?.vendor?._id;
    const vendorId =
      Types.ObjectId.isValid(String(vendorIdRaw)) ? new Types.ObjectId(String(vendorIdRaw)) : null;

    if (!vendorId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid product id" });

    const product: any = await Product.findOne({
      _id: new Types.ObjectId(id),
      ownerType: "VENDOR",
      vendorId,
    });

    if (!product) return res.status(404).json({ message: "Product not found" });

    const {
      title,
      description,
      features,
      featureImage,
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
      removeFeatureImage,
      shipLengthCm,
      shipBreadthCm,
      shipHeightCm,
      shipWeightKg,
    } = req.body as any;

    // TITLE + SLUG (avoid collisions)
    if (title) {
      const newSlug = makeSlug(title);
      const exists = await Product.findOne({
        slug: newSlug,
        _id: { $ne: product._id },
      }).select("_id");

      product.title = title;
      product.slug = exists ? `${newSlug}-${String(vendorId).slice(-6)}` : newSlug;
    }

    if (typeof description !== "undefined") product.description = description;
    if (typeof features !== "undefined") product.features = typeof features === "string" ? features : "";

    const { featureImagePath, galleryPaths } = extractImagePaths(req);
    const variantImagesMap = extractVariantImages(req);
    const colorImagesMap = extractColorImages(req);

    const removeFeature = removeFeatureImage === "true" || removeFeatureImage === true;
    if (removeFeature) product.featureImage = "";

    if (featureImagePath) product.featureImage = featureImagePath;
    else if (typeof featureImage !== "undefined" && !removeFeature) product.featureImage = featureImage;

    if (typeof galleryImages !== "undefined" || galleryPaths.length > 0) {
      const bodyGallery = normalizeGalleryFromBody(galleryImages);
      product.galleryImages = [...bodyGallery, ...galleryPaths];
    }

    const baseMrp = toNumber(mrp);
    if (baseMrp !== null) product.mrp = baseMrp;

    const baseSale = toNumber(salePrice);
    if (baseSale !== null) product.salePrice = baseSale;

    let updatedVariants: any[] = product.variants || [];
    if (typeof variants !== "undefined") {
      updatedVariants = buildVariants(variants, variantImagesMap, product.variants || []);
      product.variants = updatedVariants;
    } else if (Object.keys(variantImagesMap).length > 0) {
      updatedVariants = buildVariants(product.variants || [], variantImagesMap, product.variants || []);
      product.variants = updatedVariants;
    }

    if (typeof colors !== "undefined") {
      product.colors = buildColors(colors, colorImagesMap, product.colors || []);
    } else if (Object.keys(colorImagesMap).length > 0) {
      product.colors = buildColors(product.colors || [], colorImagesMap, product.colors || []);
    }

    const thresholdNum = toNumber(lowStockThreshold);
    if (thresholdNum !== null) product.lowStockThreshold = thresholdNum;

    const baseStockNum = toNumber(baseStock);
    if (baseStockNum !== null && (!updatedVariants || updatedVariants.length === 0)) product.baseStock = baseStockNum;
    if (updatedVariants && updatedVariants.length > 0) product.baseStock = 0;

    const finalTotalStock = calcTotalStock(updatedVariants || [], product.baseStock || 0);
    product.totalStock = finalTotalStock;

    const finalThreshold = product.lowStockThreshold ?? 5;
    product.isLowStock = calcLowStockFlag(finalTotalStock, finalThreshold);

    if (typeof isActive !== "undefined") product.isActive = isActive === "true" || isActive === true;

    if (categoryId) {
      if (!Types.ObjectId.isValid(categoryId)) return res.status(400).json({ message: "Invalid category id" });
      const cat = await Category.findById(categoryId);
      if (!cat) return res.status(404).json({ message: "Category not found" });
      product.category = cat._id;
    }

    if (typeof subCategoryId !== "undefined") {
      if (!subCategoryId) product.subCategory = null;
      else {
        if (!Types.ObjectId.isValid(subCategoryId)) return res.status(400).json({ message: "Invalid sub category id" });
        const sub = await Category.findById(subCategoryId);
        if (!sub) return res.status(404).json({ message: "Sub category not found" });
        product.subCategory = sub._id;
      }
    }

    // SHIPPING (save only, no markup)
    const shipDefaults = getShipDefaults();
    if (!product.ship) product.ship = { ...shipDefaults };

    const L = toNumber(shipLengthCm);
    const B = toNumber(shipBreadthCm);
    const H = toNumber(shipHeightCm);
    const W = toNumber(shipWeightKg);

    if (L !== null) product.ship.lengthCm = L;
    if (B !== null) product.ship.breadthCm = B;
    if (H !== null) product.ship.heightCm = H;
    if (W !== null) product.ship.weightKg = W;

    // vendor edit => needs re-approval
    product.approvalStatus = "PENDING";

    await product.save();

    return res.json({
      message: "Product updated and sent for re-approval",
      data: product,
    });
  } catch (err) {
    next(err);
  }
};
