/* eslint-disable @typescript-eslint/no-explicit-any */

export type CartProductVariant = {
  _id: string;
  label?: string;
  size?: string;
  weight?: string;
  comboText?: string;
  mrp?: number;
  salePrice?: number;
  quantity?: number;
  images?: string[];
};

export type CartProductColor = {
  _id?: string;
  name: string;
  hex?: string;
  orderIndex?: number;
  images?: string[];
};

export type CartProduct = {
  _id: string;
  title: string;
  slug: string;
  featureImage?: string;
  galleryImages?: string[];
  variants?: CartProductVariant[];
  colors?: CartProductColor[];
  // optional if you enrich productId code in product doc
  productId?: string; // CH000001 etc (optional)
};

export type CartItem = {
  _id: string;

  productId: string;
  productCode?: string; // snapshot code (MECH/MECH...)

  // variant can be null for non-variant products
  variantId?: string | null;

  colorKey?: string | null;

  qty: number;
  mrp: number;
  salePrice: number;

  title?: string;
  image?: string;

  // ✅ checkbox selection
  isSelected?: boolean;

  // enriched product
  product?: CartProduct | null;
};

export type CartData = { items: CartItem[] };

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

/** Image resolver (API host + relative path) */
export const resolveImageUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const apiBase = API_BASE || "";
  const host = apiBase.replace(/\/api\/?$/, "");
  if (path.startsWith("/")) return `${host}${path}`;
  return `${host}/${path}`;
};

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/** GET /api/common/cart */
export async function fetchCart(): Promise<CartData> {
  const res = await fetch(`${API_BASE}/common/cart`, {
    credentials: "include",
    cache: "no-store",
  });

  const json = await parseJsonSafe(res);
  if (!res.ok) throw new Error(json?.message || "Cart fetch failed");
  return json?.data || { items: [] };
}

/** PATCH /api/common/cart/qty */
export async function updateQty(itemId: string, qty: number): Promise<CartData> {
  const res = await fetch(`${API_BASE}/common/cart/qty`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ itemId, qty }),
  });

  const json = await parseJsonSafe(res);
  if (!res.ok) throw new Error(json?.message || "Qty update failed");
  return json?.data || { items: [] };
}

/** DELETE /api/common/cart/item/:itemId */
export async function removeItem(itemId: string): Promise<CartData> {
  const res = await fetch(`${API_BASE}/common/cart/item/${itemId}`, {
    method: "DELETE",
    credentials: "include",
  });

  const json = await parseJsonSafe(res);
  if (!res.ok) throw new Error(json?.message || "Remove failed");
  return json?.data || { items: [] };
}

/** DELETE /api/common/cart/clear */
export async function clearCart(): Promise<CartData> {
  const res = await fetch(`${API_BASE}/common/cart/clear`, {
    method: "DELETE",
    credentials: "include",
  });

  const json = await parseJsonSafe(res);
  if (!res.ok) throw new Error(json?.message || "Clear failed");
  return json?.data || { items: [] };
}

/** PATCH /api/common/cart/item/options  (logged-in only in your backend) */
export async function updateItemOptions(
  itemId: string,
  variantId: string | null,
  colorKey?: string | null
): Promise<CartData> {
  const res = await fetch(`${API_BASE}/common/cart/item/options`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({  itemId,
  variantId: variantId ? String(variantId) : null,
  colorKey: colorKey ?? null, }),
  });

  const json = await parseJsonSafe(res);
  if (!res.ok) throw new Error(json?.message || "Options update failed");
  return json?.data || { items: [] };
}

/** ✅ PATCH /api/common/cart/item/select */
export async function setCartItemSelected(itemId: string, isSelected: boolean): Promise<CartData> {
  const res = await fetch(`${API_BASE}/common/cart/item/select`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ itemId, isSelected }),
  });

  const json = await parseJsonSafe(res);
  if (!res.ok) throw new Error(json?.message || "Selection update failed");
  return json?.data || { items: [] };
}

/** ✅ PATCH /api/common/cart/select-all */
export async function setCartSelectAll(isSelected: boolean): Promise<CartData> {
  const res = await fetch(`${API_BASE}/common/cart/select-all`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ isSelected }),
  });

  const json = await parseJsonSafe(res);
  if (!res.ok) throw new Error(json?.message || "Select all failed");
  return json?.data || { items: [] };
}

/** ---------------- UI helpers ---------------- */

const norm = (v: any) => String(v ?? "").trim();
const normKey = (v: any) => norm(v).toLowerCase();

export function getVariantText(product?: CartProduct | null, variantId?: string | null) {
  if (!product || !variantId) return "Variant";
  const v = (product.variants || []).find((x) => String(x._id) === String(variantId));
  if (!v) return "Variant";
  return v.label || v.comboText || v.size || v.weight || "Variant";
}

export function resolveCartItemImage(
  product?: CartProduct | null,
  variantId?: string | null,
  colorKey?: string | null
) {
  if (!product) return "";

  const v = variantId
    ? (product.variants || []).find((x) => String(x._id) === String(variantId))
    : null;

  const c = (product.colors || []).find((x) => normKey(x.name) === normKey(colorKey));

  const vImg = (v?.images || []).find(Boolean);
  const cImg = (c?.images || []).find(Boolean);
  const gImg = (product.galleryImages || []).find(Boolean);
  const fImg = product.featureImage || "";

  // ✅ priority: variant -> color -> gallery -> feature
  return vImg || cImg || gImg || fImg || "";
}
