/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Product } from "../../models/Product.model";
import { Category } from "../../models/Category.model";

/**
 * IMPORTANT:
 * - Vendor products => ownerType="VENDOR", vendor=<vendorId>, approvalStatus="PENDING"
 * - Admin approve karega later (admin side endpoint banega / ya existing updateProduct se)
 * - Shipping dims vendor product create time pe bhi save honge (env defaults fallback)
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

    if (numericKeys.length) {
      return numericKeys.map((k) => (value as any)[k]);
    }

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
      salePrice:
        typeof v.salePrice === "number" ? v.salePrice : Number(v.salePrice || 0),

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
  if (hasVariants) {
    return variantsArr.reduce((sum, v) => sum + Number(v.quantity || 0), 0);
  }
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
    shipLengthCm: Number.isFinite(L) ? L : 20,
    shipBreadthCm: Number.isFinite(B) ? B : 15,
    shipHeightCm: Number.isFinite(H) ? H : 10,
    shipWeightKg: Number.isFinite(W) ? W : 0.5,
  };
};

/**
 * VENDOR: CREATE PRODUCT
 * POST /api/vendors/products
 *
 * Updated (fixed) create logic:
 * - Proper debug logs placement
 * - Robust shipping field extraction (supports flat keys + bracket keys + ship object)
 * - Same variant/color/image logic retained
 */
export const vendorCreateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const vendorId = (req as any)?.vendor?._id;
    if (!vendorId) return res.status(401).json({ message: "Unauthorized" });

    // ---- DEBUG (TEMP) ----
    console.log("CREATE req.body keys:", Object.keys(req.body || {}));
    console.log("CREATE req.body.ship:", (req.body as any)?.ship);
    console.log("CREATE ship flat:", {
      shipLengthCm: (req.body as any)?.shipLengthCm,
      shipBreadthCm: (req.body as any)?.shipBreadthCm,
      shipHeightCm: (req.body as any)?.shipHeightCm,
      shipWeightKg: (req.body as any)?.shipWeightKg,
    });
    console.log("CREATE ship bracket:", {
      L: (req.body as any)?.["ship[lengthCm]"],
      B: (req.body as any)?.["ship[breadthCm]"],
      H: (req.body as any)?.["ship[heightCm]"],
      W: (req.body as any)?.["ship[weightKg]"],
    });

    // ---- read body (keep destructuring for other fields) ----
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

    // ---- validation ----
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

    // ---- slug ----
    const slug = makeSlug(title);
    const existing = await Product.findOne({ slug });
    const finalSlug = existing ? `${slug}-${String(vendorId).slice(-6)}` : slug;

    // ---- images from multer ----
    const { featureImagePath, galleryPaths } = extractImagePaths(req);
    const variantImagesMap = extractVariantImages(req);
    const colorImagesMap = extractColorImages(req);

    const bodyGallery = normalizeGalleryFromBody(galleryImages);
    const finalGallery = [...bodyGallery, ...galleryPaths];

    // ---- build variants & colors ----
    const builtVariants = buildVariants(variants, variantImagesMap);
    const builtColors = buildColors(colors, colorImagesMap);

    // ---- stock ----
    const parsedBaseStock = toNumber(baseStock) ?? 0;
    const parsedThreshold = toNumber(lowStockThreshold) ?? 5;

    const totalStock = calcTotalStock(builtVariants, parsedBaseStock);
    const isLowStock = calcLowStockFlag(totalStock, parsedThreshold);

    // ---- SHIPPING (robust extraction) ----
    const shipDefaults = getShipDefaults();

    const rawShipLength =
      (req.body as any)?.shipLengthCm ??
      (req.body as any)?.["shipLengthCm"] ??
      (req.body as any)?.["ship[lengthCm]"] ??
      (req.body as any)?.ship?.lengthCm;

    const rawShipBreadth =
      (req.body as any)?.shipBreadthCm ??
      (req.body as any)?.["shipBreadthCm"] ??
      (req.body as any)?.["ship[breadthCm]"] ??
      (req.body as any)?.ship?.breadthCm;

    const rawShipHeight =
      (req.body as any)?.shipHeightCm ??
      (req.body as any)?.["shipHeightCm"] ??
      (req.body as any)?.["ship[heightCm]"] ??
      (req.body as any)?.ship?.heightCm;

    const rawShipWeight =
      (req.body as any)?.shipWeightKg ??
      (req.body as any)?.["shipWeightKg"] ??
      (req.body as any)?.["ship[weightKg]"] ??
      (req.body as any)?.ship?.weightKg;

    const shipL = toNumber(rawShipLength) ?? shipDefaults.shipLengthCm;
    const shipB = toNumber(rawShipBreadth) ?? shipDefaults.shipBreadthCm;
    const shipH = toNumber(rawShipHeight) ?? shipDefaults.shipHeightCm;
    const shipW = toNumber(rawShipWeight) ?? shipDefaults.shipWeightKg;

    console.log("CREATE ship parsed:", {
      rawShipLength,
      rawShipBreadth,
      rawShipHeight,
      rawShipWeight,
      shipL,
      shipB,
      shipH,
      shipW,
    });

    // ---- create ----
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
      vendorId: vendorId,
      approvalStatus: "PENDING",

      ship: {
        lengthCm: shipL,
        breadthCm: shipB,
        heightCm: shipH,
        weightKg: shipW,
      },
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
 * GET /api/vendors/products?approvalStatus=PENDING|APPROVED|REJECTED&active=true|false&lowStock=true|false&q=
 */
export const vendorListMyProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorId = (req as any)?.vendor?._id;
    if (!vendorId) return res.status(401).json({ message: "Unauthorized" });

    const { approvalStatus, active, lowStock, q } = req.query as any;

    const filter: any = {
      ownerType: "VENDOR",
      vendorId: vendorId,
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
    const vendorId = (req as any)?.vendor?._id;
    if (!vendorId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid product id" });

    const product = await Product.findOne({
      _id: id,
      ownerType: "VENDOR",
      vendorId: vendorId,
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
 * Rule:
 * - If vendor edits, set approvalStatus back to PENDING (admin will re-approve)
 */
export const vendorUpdateMyProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorId = (req as any)?.vendor?._id;
    if (!vendorId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid product id" });

    const product = await Product.findOne({
      _id: id,
      ownerType: "VENDOR",
      vendorId: vendorId,
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

    // BASIC
    if (title) {
      (product as any).title = title;
      (product as any).slug = makeSlug(title);
    }
    if (typeof description !== "undefined") (product as any).description = description;
    if (typeof features !== "undefined") (product as any).features = typeof features === "string" ? features : "";

    // IMAGES
    const { featureImagePath, galleryPaths } = extractImagePaths(req);
    const variantImagesMap = extractVariantImages(req);
    const colorImagesMap = extractColorImages(req);

    const removeFeature = removeFeatureImage === "true" || removeFeatureImage === true;
    if (removeFeature) (product as any).featureImage = "";

    if (featureImagePath) {
      (product as any).featureImage = featureImagePath;
    } else if (typeof featureImage !== "undefined" && !removeFeature) {
      (product as any).featureImage = featureImage;
    }

    if (typeof galleryImages !== "undefined" || galleryPaths.length > 0) {
      const bodyGallery = normalizeGalleryFromBody(galleryImages);
      (product as any).galleryImages = [...bodyGallery, ...galleryPaths];
    }

    // PRICING
    const baseMrp = toNumber(mrp);
    if (baseMrp !== null) (product as any).mrp = baseMrp;

    const baseSale = toNumber(salePrice);
    if (baseSale !== null) (product as any).salePrice = baseSale;

    // VARIANTS
    let updatedVariants: any[] = (product as any).variants || [];
    if (typeof variants !== "undefined") {
      updatedVariants = buildVariants(variants, variantImagesMap, (product as any).variants || []);
      (product as any).variants = updatedVariants;
    } else if (Object.keys(variantImagesMap).length > 0) {
      updatedVariants = buildVariants((product as any).variants || [], variantImagesMap, (product as any).variants || []);
      (product as any).variants = updatedVariants;
    }

    // COLORS
    if (typeof colors !== "undefined") {
      (product as any).colors = buildColors(colors, colorImagesMap, (product as any).colors || []);
    } else if (Object.keys(colorImagesMap).length > 0) {
      (product as any).colors = buildColors((product as any).colors || [], colorImagesMap, (product as any).colors || []);
    }

    // STOCK
    const thresholdNum = toNumber(lowStockThreshold);
    if (thresholdNum !== null) (product as any).lowStockThreshold = thresholdNum;

    const baseStockNum = toNumber(baseStock);
    if (baseStockNum !== null && (!updatedVariants || updatedVariants.length === 0)) {
      (product as any).baseStock = baseStockNum;
    }
    if (updatedVariants && updatedVariants.length > 0) {
      (product as any).baseStock = 0;
    }

    const finalTotalStock = calcTotalStock(updatedVariants || [], (product as any).baseStock || 0);
    (product as any).totalStock = finalTotalStock;

    const finalThreshold = (product as any).lowStockThreshold ?? 5;
    (product as any).isLowStock = calcLowStockFlag(finalTotalStock, finalThreshold);

    // ACTIVE (vendor can toggle)
    if (typeof isActive !== "undefined") {
      (product as any).isActive = isActive === "true" || isActive === true;
    }

    // CATEGORY
    if (categoryId) {
      if (!Types.ObjectId.isValid(categoryId)) return res.status(400).json({ message: "Invalid category id" });
      const cat = await Category.findById(categoryId);
      if (!cat) return res.status(404).json({ message: "Category not found" });
      (product as any).category = cat._id;
    }

    if (typeof subCategoryId !== "undefined") {
      if (!subCategoryId) {
        (product as any).subCategory = null;
      } else {
        if (!Types.ObjectId.isValid(subCategoryId)) return res.status(400).json({ message: "Invalid sub category id" });
        const sub = await Category.findById(subCategoryId);
        if (!sub) return res.status(404).json({ message: "Sub category not found" });
        (product as any).subCategory = sub._id;
      }
    }

    // SHIPPING
// SHIPPING (schema has `ship.{lengthCm,breadthCm,heightCm,weightKg}`)
const shipDefaults = getShipDefaults();

const shipL = toNumber(shipLengthCm);
const shipB = toNumber(shipBreadthCm);
const shipH = toNumber(shipHeightCm);
const shipW = toNumber(shipWeightKg);

// ensure ship object exists
if (!(product as any).ship) {
  (product as any).ship = {
    lengthCm: shipDefaults.shipLengthCm,
    breadthCm: shipDefaults.shipBreadthCm,
    heightCm: shipDefaults.shipHeightCm,
    weightKg: shipDefaults.shipWeightKg,
  };
}

if (shipL !== null) (product as any).ship.lengthCm = shipL;
if (shipB !== null) (product as any).ship.breadthCm = shipB;
if (shipH !== null) (product as any).ship.heightCm = shipH;
if (shipW !== null) (product as any).ship.weightKg = shipW;


    // ✅ IMPORTANT: vendor edit => needs re-approval
    (product as any).approvalStatus = "PENDING";

    await (product as any).save();

    return res.json({
      message: "Product updated and sent for re-approval",
      data: product,
    });
  } catch (err) {
    next(err);
  }
};
