/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { Offer } from "../models/Offer.model";
import { OfferRedemption } from "../models/OfferRedemption.model";
import { Product } from "../models/Product.model";
import { Order } from "../models/Order.model";

type Line = {
    productId: Types.ObjectId;
    qty: number;
    salePrice: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

async function isFirstOrder(userId: Types.ObjectId) {
    const count = await Order.countDocuments({ userId });
    return count === 0;
}

async function perUserUsedCount(offerId: Types.ObjectId, userId: Types.ObjectId) {
    return OfferRedemption.countDocuments({ offerId, userId });
}

function computeDiscount(offer: any, eligibleSubtotal: number) {
    if (eligibleSubtotal <= 0) return 0;

    if (offer.type === "PERCENT") {
        const pct = Number(offer.value || 0);
        const raw = (eligibleSubtotal * pct) / 100;
        const cap = offer.maxDiscountAmount ? Number(offer.maxDiscountAmount) : null;
        return round2(Math.max(0, cap ? Math.min(raw, cap) : raw));
    }

    // FLAT
    const flat = Number(offer.value || 0);
    return round2(Math.max(0, Math.min(flat, eligibleSubtotal)));
}

async function eligibleProductIds(offer: any, lines: Line[]) {
    const productIds = lines.map((l) => l.productId);

    const products = await Product.find({ _id: { $in: productIds } })
        .select("_id category categoryId subCategory subCategoryId subcategory subcategoryId")
        .lean();

    const pid = (p: any) => String(p._id);

    const getCategoryId = (p: any) =>
        String(
            p?.categoryId ??
            p?.category?._id ??
            p?.category ??
            ""
        );

    const getSubCategoryId = (p: any) =>
        String(
            p?.subCategoryId ??
            p?.subcategoryId ??
            p?.subCategory?._id ??
            p?.subCategory ??
            p?.subcategory?._id ??
            p?.subcategory ??
            ""
        );

    if (offer.scope === "SITE") return products.map(pid);

    if (offer.scope === "CATEGORY") {
        const allowed = new Set((offer.categoryIds || []).map((x: any) => String(x)));
        return products
            .filter((p: any) => allowed.has(getCategoryId(p)))
            .map(pid);
    }

    if (offer.scope === "SUBCATEGORY") {
        const allowed = new Set((offer.subCategoryIds || []).map((x: any) => String(x)));
        return products
            .filter((p: any) => {
                const scid = getSubCategoryId(p);
                return scid && allowed.has(scid);
            })
            .map(pid);
    }

    // PRODUCT
    const allowed = new Set((offer.productIds || []).map((x: any) => String(x)));
    return products.filter((p: any) => allowed.has(pid(p))).map(pid);
}


export async function validateAndComputeOffer(params: {
    userId: Types.ObjectId;
    couponCode?: string;
    lines: Line[];
}) {
    const { userId, couponCode, lines } = params;
    const now = new Date();

    // 1) find offer
    let offer: any = null;

    if (couponCode && couponCode.trim()) {
        const code = couponCode.trim().toUpperCase();
        offer = await Offer.findOne({
            mode: "COUPON",
            couponCode: code,
            isActive: true,
            startsAt: { $lte: now },
            endsAt: { $gte: now },
        }).lean();

        if (!offer) return { ok: false as const, reason: "Invalid or expired coupon code" };
    } else {
        // AUTO best
        const offers = await Offer.find({
            mode: "AUTO",
            isActive: true,
            startsAt: { $lte: now },
            endsAt: { $gte: now },
        })
            .sort({ priority: -1, createdAt: -1 })
            .lean();

        if (!offers.length) return { ok: true as const, appliedOffer: null, discount: 0 };

        // choose best discount
        let bestOffer: any = null;
        let bestDiscount = 0;

        for (const o of offers) {
            const eligibleIdsArr = await eligibleProductIds(o, lines);
            const eligibleSet = new Set(eligibleIdsArr);

            const eligibleSubtotal = lines.reduce((s, l) => {
                if (!eligibleSet.has(String(l.productId))) return s;
                return s + l.salePrice * l.qty;
            }, 0);

            const d = computeDiscount(o, eligibleSubtotal);
            if (d > bestDiscount) {
                bestDiscount = d;
                bestOffer = o;
            }
        }

        if (!bestOffer || bestDiscount <= 0) return { ok: true as const, appliedOffer: null, discount: 0 };

        offer = bestOffer;
    }

    // 2) validate time
    if (now < new Date(offer.startsAt) || now > new Date(offer.endsAt)) {
        return { ok: false as const, reason: "Offer not active now" };
    }

    // 3) global usage
    if (offer.globalUsageLimit && Number(offer.globalUsedCount || 0) >= Number(offer.globalUsageLimit)) {
        return { ok: false as const, reason: "Offer usage limit reached" };
    }

    // 4) first order
    if (offer.firstOrderOnly) {
        const first = await isFirstOrder(userId);
        if (!first) return { ok: false as const, reason: "Offer valid only on first order" };
    }

    // 5) per-user
    if (offer.perUserLimit && Number(offer.perUserLimit) > 0) {
        const used = await perUserUsedCount(offer._id, userId);
        if (used >= Number(offer.perUserLimit)) {
            return { ok: false as const, reason: "Per-user usage limit reached" };
        }
    }

    // 6) scope eligibility
    const eligibleIdsArr = await eligibleProductIds(offer, lines);
    const eligibleSet = new Set(eligibleIdsArr);

    const eligibleSubtotal = lines.reduce((s, l) => {
        if (!eligibleSet.has(String(l.productId))) return s;
        return s + l.salePrice * l.qty;
    }, 0);

    const discount = computeDiscount(offer, eligibleSubtotal);

    if (discount <= 0) return { ok: false as const, reason: "Offer not applicable on cart" };

    return {
        ok: true as const,
        appliedOffer: offer,
        discount,
    };
}

export async function recordOfferRedemption(params: {
    offerId: Types.ObjectId;
    userId: Types.ObjectId;
    orderId: Types.ObjectId;
    couponCode?: string | null;
    discountAmount: number;
}) {
    const { offerId, userId, orderId, couponCode, discountAmount } = params;

    await OfferRedemption.create({
        offerId,
        userId,
        orderId,
        couponCode: couponCode ? couponCode.trim().toUpperCase() : null,
        discountAmount: Math.max(0, Number(discountAmount || 0)),
    });

    await Offer.updateOne({ _id: offerId }, { $inc: { globalUsedCount: 1 } });
}
