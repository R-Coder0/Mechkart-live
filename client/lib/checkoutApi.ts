/* eslint-disable @typescript-eslint/no-explicit-any */
const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export type Address = {
  _id: string;
  fullName: string;
  phone: string;
  pincode: string;
  state: string;
  city: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  isDefault?: boolean;
  addressType?: "HOME" | "WORK" | "OTHER";
};

export type UserBasics = {
  name: string;
  email: string;
  phone: string;
};

export type FetchAddressesResponse = {
  user: UserBasics;
  addresses: Address[];
};

type CheckoutItem = {
  _id: string;
  productId: string;
  productCode: string;
  variantId: string | null;
  colorKey: string | null;
  qty: number;

  title: string;

  mrp: number;
  salePrice: number;
  lineTotal: number;

  offerDiscount?: number;
  finalLineTotal?: number;
  effectiveUnitPrice?: number;

  product?: any;
};

type CheckoutTotals = {
  subtotal: number;
  mrpTotal: number;
  savings: number;
  discount: number;
  grandTotal: number;
};

export type CheckoutSummaryResponse = {
  items: CheckoutItem[];
  totals: CheckoutTotals;
  appliedOffer?: any | null;
  couponCode?: string | null;
};

function unwrap<T = any>(json: any): T {
  return (json?.data ?? json) as T;
}

async function parseJsonSafe(res: Response) {
  return res.json().catch(() => ({}));
}

function normalizeCheckoutSummary(input: any): CheckoutSummaryResponse {
  const s = (input || {}) as CheckoutSummaryResponse;

  const items = Array.isArray(s.items) ? s.items : [];
  const totals = (s.totals || {}) as Partial<CheckoutTotals>;

  const safeItems = items.map((it: any) => {
    const qty = Number(it?.qty || 0) || 0;
    const lineTotal = Number(it?.lineTotal || 0) || 0;
    const offerDiscount = Number(it?.offerDiscount || 0) || 0;

    const finalLineTotal =
      it?.finalLineTotal !== undefined
        ? Number(it.finalLineTotal || 0)
        : Math.max(0, lineTotal - offerDiscount);

    const effectiveUnitPrice =
      it?.effectiveUnitPrice !== undefined
        ? Number(it.effectiveUnitPrice || 0)
        : qty > 0
        ? finalLineTotal / qty
        : 0;

    return {
      ...it,
      qty,
      mrp: Number(it?.mrp || 0) || 0,
      salePrice: Number(it?.salePrice || 0) || 0,
      lineTotal,
      offerDiscount,
      finalLineTotal,
      effectiveUnitPrice,
    };
  });

  return {
    items: safeItems,
    totals: {
      subtotal: Number(totals.subtotal || 0) || 0,
      mrpTotal: Number(totals.mrpTotal || 0) || 0,
      savings: Number(totals.savings || 0) || 0,
      discount: Number(totals.discount || 0) || 0,
      grandTotal: Number(totals.grandTotal || 0) || 0,
    },
    appliedOffer: s.appliedOffer ?? null,
    couponCode: s.couponCode ?? null,
  };
}

export async function fetchAddresses(): Promise<FetchAddressesResponse> {
  const res = await fetch(`${API_BASE}/users/addresses`, {
    credentials: "include",
    cache: "no-store",
  });
  const json = await parseJsonSafe(res);
  if (!res.ok) throw new Error(json?.message || "Addresses fetch failed");
  const data = unwrap<FetchAddressesResponse>(json);
  return {
    user: data?.user || { name: "", email: "", phone: "" },
    addresses: data?.addresses || [],
  };
}

export async function addAddress(payload: any): Promise<FetchAddressesResponse> {
  const res = await fetch(`${API_BASE}/users/addresses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const json = await parseJsonSafe(res);
  if (!res.ok) throw new Error(json?.message || "Add address failed");
  const data = unwrap<FetchAddressesResponse>(json);
  return {
    user: data?.user || { name: "", email: "", phone: "" },
    addresses: data?.addresses || [],
  };
}

export async function updateAddress(addressId: string, payload: any): Promise<FetchAddressesResponse> {
  const res = await fetch(`${API_BASE}/users/addresses/${addressId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const json = await parseJsonSafe(res);
  if (!res.ok) throw new Error(json?.message || "Update address failed");
  const data = unwrap<FetchAddressesResponse>(json);
  return {
    user: data?.user || { name: "", email: "", phone: "" },
    addresses: data?.addresses || [],
  };
}

export async function deleteAddress(addressId: string): Promise<FetchAddressesResponse> {
  const res = await fetch(`${API_BASE}/users/addresses/${addressId}`, {
    method: "DELETE",
    credentials: "include",
  });
  const json = await parseJsonSafe(res);
  if (!res.ok) throw new Error(json?.message || "Delete address failed");
  const data = unwrap<FetchAddressesResponse>(json);
  return {
    user: data?.user || { name: "", email: "", phone: "" },
    addresses: data?.addresses || [],
  };
}

export async function setDefaultAddress(addressId: string): Promise<FetchAddressesResponse> {
  const res = await fetch(`${API_BASE}/users/addresses/${addressId}/default`, {
    method: "PATCH",
    credentials: "include",
  });
  const json = await parseJsonSafe(res);
  if (!res.ok) throw new Error(json?.message || "Set default failed");
  const data = unwrap<FetchAddressesResponse>(json);
  return {
    user: data?.user || { name: "", email: "", phone: "" },
    addresses: data?.addresses || [],
  };
}

export async function checkoutSummary(couponCode?: string): Promise<CheckoutSummaryResponse> {
  const code = String(couponCode || "").trim();
  const qs = code ? `?couponCode=${encodeURIComponent(code.toUpperCase())}` : "";

  const res = await fetch(`${API_BASE}/users/checkout/summary${qs}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const json = await parseJsonSafe(res);
  if (!res.ok) throw new Error(json?.message || "Checkout summary failed");

  const data = unwrap(json);
  return normalizeCheckoutSummary(data);
}

/** ✅ COD ORDER (route updated) */
export async function createCodOrder(payload: any): Promise<any> {
  const res = await fetch(`${API_BASE}/users/orders/cod`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const json = await parseJsonSafe(res);
  if (!res.ok) throw new Error(json?.message || "COD order failed");
  return unwrap(json);
}

/** ✅ Razorpay: create order (DB + razorpay_order_id) */
export async function createRazorpayOrder(payload: any): Promise<any> {
  const res = await fetch(`${API_BASE}/users/orders/razorpay/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const json = await parseJsonSafe(res);
  if (!res.ok) throw new Error(json?.message || "Razorpay order create failed");
  return unwrap(json);
}

/** ✅ Razorpay: verify payment signature */
export async function verifyRazorpayPayment(payload: {
  orderId: string; // our mongo orderId
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/users/orders/razorpay/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const json = await parseJsonSafe(res);
  if (!res.ok) throw new Error(json?.message || "Razorpay verify failed");
  return unwrap(json);
}
