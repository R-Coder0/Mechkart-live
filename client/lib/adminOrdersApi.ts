/* eslint-disable @typescript-eslint/no-explicit-any */
const API_BASE = process.env.NEXT_PUBLIC_API_URL;

/* =========================
 * TYPES
 * ========================= */

export type RazorpaySnapshot = {
  provider?: "RAZORPAY";
  orderId?: string | null;
  paymentId?: string | null;
  signature?: string | null;
  amount?: number | null;     // in paise
  currency?: string | null;   // INR
  verifiedAt?: string | null;
  raw?: any;
};

export type CodSnapshot = {
  confirmedAt?: string | null;
  confirmedBy?: string | null; // admin id
};

export type AdminOrder = {
  _id: string;
  orderCode: string;

  userId?: string;

  items: any[];

  totals?: {
    subtotal: number;
    mrpTotal: number;
    savings: number;
    discount: number;
    grandTotal: number;
  };

  appliedOffer?: any;

  contact?: {
    name: string;
    phone: string;
    email?: string;
  };

  address?: any;

  paymentMethod: "COD" | "ONLINE";
  paymentStatus: "PENDING" | "PAID" | "FAILED";

  status: "PLACED" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

  // ✅ Razorpay snapshot
  pg?: RazorpaySnapshot | null;

  // ✅ COD confirmation snapshot
  cod?: CodSnapshot | null;

  createdAt: string;
  updatedAt: string;
};

export type AdminOrdersResponse = {
  items: AdminOrder[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/* =========================
 * HELPERS
 * ========================= */

function getAdminToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("admin_token") || "";
}

function authHeaders(extra?: Record<string, string>) {
  const token = getAdminToken();
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/* =========================
 * API CALLS
 * ========================= */

/**
 * GET ADMIN ORDERS
 * Supports:
 * - search (q)
 * - status
 * - paymentMethod
 * - paymentStatus
 * - pagination
 */
export async function adminFetchOrders(params?: {
  q?: string;
  status?: string;
  paymentMethod?: "COD" | "ONLINE";
  paymentStatus?: "PENDING" | "PAID" | "FAILED";
  page?: number;
  limit?: number;
}): Promise<AdminOrdersResponse> {
  const sp = new URLSearchParams();

  if (params?.q) sp.set("q", params.q);
  if (params?.status) sp.set("status", params.status);
  if (params?.paymentMethod) sp.set("paymentMethod", params.paymentMethod);
  if (params?.paymentStatus) sp.set("paymentStatus", params.paymentStatus);

  sp.set("page", String(params?.page ?? 1));
  sp.set("limit", String(params?.limit ?? 20));

  const res = await fetch(`${API_BASE}/admin/orders?${sp.toString()}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: authHeaders(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || "Failed to fetch admin orders");
  }

  return json?.data || json;
}

/**
 * UPDATE ORDER STATUS
 * (PLACED → SHIPPED → DELIVERED etc.)
 * NOTE: COD CONFIRM is blocked in backend via status endpoint (as we added guard).
 */
export async function adminUpdateOrderStatus(
  orderId: string,
  status: "PLACED" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED"
): Promise<AdminOrder> {
  const res = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ status }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || "Status update failed");
  }

  return json?.data || json;
}

/**
 * ✅ CONFIRM COD ORDER (Admin approval)
 * Route: PATCH /admin/orders/:orderId/confirm-cod
 */
export async function adminConfirmCod(orderId: string): Promise<AdminOrder> {
  const res = await fetch(`${API_BASE}/admin/orders/${orderId}/confirm-cod`, {
    method: "PATCH",
    credentials: "include",
    headers: authHeaders(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || "Confirm COD failed");
  }

  return json?.data || json;
}
