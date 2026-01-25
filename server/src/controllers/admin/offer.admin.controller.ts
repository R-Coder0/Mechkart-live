/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Offer } from "../../models/Offer.model";

const toNumber = (v: any) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

const normalizeIds = (arr: any): Types.ObjectId[] => {
  if (!arr) return [];
  const a = Array.isArray(arr) ? arr : typeof arr === "string" ? JSON.parse(arr) : [];
  return a
    .map((x: any) => String(x))
    .filter((x: string) => Types.ObjectId.isValid(x))
    .map((x: string) => new Types.ObjectId(x));
};

const upper = (s: any) => (typeof s === "string" ? s.trim().toUpperCase() : "");

const generateCoupon = (prefix = "MECH", len = 8) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = `${prefix}-`;
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

const validateOfferPayload = (body: any) => {
  if (!body.name) throw new Error("Offer name is required");

  if (!["FLAT", "PERCENT"].includes(body.type)) throw new Error("Invalid offer type");
  const val = toNumber(body.value);
  if (val === null || val <= 0) throw new Error("Discount value must be > 0");

  if (body.type === "PERCENT" && (val <= 0 || val > 100)) {
    throw new Error("Percentage must be between 1 and 100");
  }

  if (!["SITE", "CATEGORY", "SUBCATEGORY", "PRODUCT"].includes(body.scope)) {
    throw new Error("Invalid offer scope");
  }

  if (!["AUTO", "COUPON"].includes(body.mode)) throw new Error("Invalid offer mode");

  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (isNaN(startsAt.getTime())) throw new Error("Invalid startsAt");
  if (isNaN(endsAt.getTime())) throw new Error("Invalid endsAt");
  if (endsAt <= startsAt) throw new Error("endsAt must be after startsAt");

  // scope targets
  if (body.scope === "CATEGORY" && (!body.categoryIds || body.categoryIds.length === 0)) {
    throw new Error("CATEGORY scope requires categoryIds");
  }
  if (body.scope === "SUBCATEGORY" && (!body.subCategoryIds || body.subCategoryIds.length === 0)) {
    throw new Error("SUBCATEGORY scope requires subCategoryIds");
  }
  if (body.scope === "PRODUCT" && (!body.productIds || body.productIds.length === 0)) {
    throw new Error("PRODUCT scope requires productIds");
  }

  // coupon rules
  if (body.mode === "COUPON") {
    if (!body.couponCode && !body.autoGenerateCoupon) {
      throw new Error("COUPON mode requires couponCode OR autoGenerateCoupon=true");
    }
  }
};

export const createOffer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body || {};

    // normalize arrays
    body.categoryIds = normalizeIds(body.categoryIds);
    body.subCategoryIds = normalizeIds(body.subCategoryIds);
    body.productIds = normalizeIds(body.productIds);

    // normalize numbers
    body.value = toNumber(body.value);
    body.maxDiscountAmount = toNumber(body.maxDiscountAmount);
    body.globalUsageLimit = toNumber(body.globalUsageLimit);
    body.perUserLimit = toNumber(body.perUserLimit);
    body.priority = toNumber(body.priority) ?? 0;

    // normalize boolean
    body.firstOrderOnly = body.firstOrderOnly === "true" || body.firstOrderOnly === true;
    body.isActive = body.isActive === undefined ? true : body.isActive === "true" || body.isActive === true;
    body.stackable = body.stackable === "true" || body.stackable === true;

    // coupon
    if (body.mode === "COUPON") {
      if (body.autoGenerateCoupon === "true" || body.autoGenerateCoupon === true) {
        body.couponCode = generateCoupon("MECH", 8);
      }
      body.couponCode = upper(body.couponCode);
    } else {
      body.couponCode = undefined;
    }

    validateOfferPayload(body);

    const offer = await Offer.create({
      name: String(body.name).trim(),
      description: typeof body.description === "string" ? body.description : "",

      type: body.type,
      value: body.value,
      maxDiscountAmount: body.maxDiscountAmount ?? undefined,

      scope: body.scope,
      categoryIds: body.categoryIds,
      subCategoryIds: body.subCategoryIds,
      productIds: body.productIds,

      mode: body.mode,
      couponCode: body.couponCode,

      globalUsageLimit: body.globalUsageLimit ?? undefined,
      globalUsedCount: 0,

      perUserLimit: body.perUserLimit ?? undefined,
      firstOrderOnly: body.firstOrderOnly,

      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),

      isActive: body.isActive,
      priority: body.priority,
      stackable: body.stackable,

      createdBy: (req as any).admin?._id || null,
    });

    return res.status(201).json({ message: "Offer created successfully", data: offer });
  } catch (err) {
    next(err);
  }
};

export const updateOffer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid offer id" });

    const patch: any = req.body || {};

    if (patch.categoryIds !== undefined) patch.categoryIds = normalizeIds(patch.categoryIds);
    if (patch.subCategoryIds !== undefined) patch.subCategoryIds = normalizeIds(patch.subCategoryIds);
    if (patch.productIds !== undefined) patch.productIds = normalizeIds(patch.productIds);

    if (patch.value !== undefined) patch.value = toNumber(patch.value);
    if (patch.maxDiscountAmount !== undefined) patch.maxDiscountAmount = toNumber(patch.maxDiscountAmount);
    if (patch.globalUsageLimit !== undefined) patch.globalUsageLimit = toNumber(patch.globalUsageLimit);
    if (patch.perUserLimit !== undefined) patch.perUserLimit = toNumber(patch.perUserLimit);
    if (patch.priority !== undefined) patch.priority = toNumber(patch.priority);

    if (patch.firstOrderOnly !== undefined)
      patch.firstOrderOnly = patch.firstOrderOnly === "true" || patch.firstOrderOnly === true;

    if (patch.isActive !== undefined)
      patch.isActive = patch.isActive === "true" || patch.isActive === true;

    if (patch.stackable !== undefined)
      patch.stackable = patch.stackable === "true" || patch.stackable === true;

    if (patch.mode === "COUPON") {
      if (patch.autoGenerateCoupon === "true" || patch.autoGenerateCoupon === true) {
        patch.couponCode = generateCoupon("MECH", 8);
      }
      if (patch.couponCode !== undefined) patch.couponCode = upper(patch.couponCode);
    }

    const offer = await Offer.findByIdAndUpdate(id, patch, { new: true });
    if (!offer) return res.status(404).json({ message: "Offer not found" });

    return res.status(200).json({ message: "Offer updated successfully", data: offer });
  } catch (err) {
    next(err);
  }
};

export const toggleOffer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid offer id" });

    const offer = await Offer.findById(id);
    if (!offer) return res.status(404).json({ message: "Offer not found" });

    offer.isActive = !offer.isActive;
    await offer.save();

    return res.status(200).json({ message: "Offer status updated", data: offer });
  } catch (err) {
    next(err);
  }
};

export const listOffers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, mode, scope, isActive, page = "1", limit = "20" } = req.query as any;

    const filter: any = {};
    if (q) filter.name = { $regex: String(q), $options: "i" };
    if (mode) filter.mode = String(mode);
    if (scope) filter.scope = String(scope);
    if (typeof isActive !== "undefined") filter.isActive = String(isActive) === "true";

    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const [items, total] = await Promise.all([
      Offer.find(filter).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l),
      Offer.countDocuments(filter),
    ]);

    return res.status(200).json({ message: "Offers fetched successfully", data: items, total, page: p, limit: l });
  } catch (err) {
    next(err);
  }
};
