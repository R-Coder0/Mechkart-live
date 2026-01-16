export type OfferType = "FLAT" | "PERCENT";
export type OfferScope = "SITE" | "CATEGORY" | "SUBCATEGORY" | "PRODUCT";
export type OfferMode = "AUTO" | "COUPON";

export type OfferDoc = {
  _id: string;
  name: string;
  description?: string;

  type: OfferType;
  value: number;
  maxDiscountAmount?: number;

  scope: OfferScope;
  categoryIds?: string[];
  subCategoryIds?: string[];
  productIds?: string[];

  mode: OfferMode;
  couponCode?: string;

  globalUsageLimit?: number;
  globalUsedCount: number;

  perUserLimit?: number;
  firstOrderOnly: boolean;

  startsAt: string;
  endsAt: string;

  isActive: boolean;
  priority: number;
  stackable: boolean;

  createdAt: string;
  updatedAt: string;
};

export type OfferPayload = {
  name: string;
  description?: string;

  type: OfferType;
  value: number | string;
  maxDiscountAmount?: number | string;

  scope: OfferScope;
  categoryIds?: string[];
  subCategoryIds?: string[];
  productIds?: string[];

  mode: OfferMode;
  couponCode?: string;
  autoGenerateCoupon?: boolean;

  globalUsageLimit?: number | string;
  perUserLimit?: number | string;
  firstOrderOnly?: boolean;

  startsAt: string; // datetime-local
  endsAt: string;   // datetime-local

  isActive?: boolean;
  priority?: number | string;
  stackable?: boolean;
};
