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
  amount?: number | null; // paise
  currency?: string | null; // INR
  verifiedAt?: string | null;
  raw?: any;
};

export type CodSnapshot = {
  confirmedAt?: string | null;
  confirmedBy?: string | null;
};

export type ShiprocketSnapshot = {
  orderId?: string | null;
  shipmentId?: number | null;
  awb?: string | null;
  courierName?: string | null;
  courierCompanyId?: number | null;
  labelUrl?: string | null;
  manifestUrl?: string | null;
  invoiceUrl?: string | null;
  pickupScheduledAt?: string | null;
  tracking?: any;
  raw?: any;
};

export type OrderShipment = {
  _id?: string;
  provider: "SHIPROCKET";
  vendorId?: string | null;
  items?: any[];
  pickup?: any;
  shiprocket?: ShiprocketSnapshot | null;
  status?: "CREATED" | "AWB_ASSIGNED" | "PICKUP_SCHEDULED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
  createdAt?: string;
  updatedAt?: string;
};

export type ReturnStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "PICKUP_CREATED"
  | "RECEIVED"
  | "REFUNDED";

export type RefundStatus = "PENDING" | "PROCESSED" | "FAILED";

export type ReturnBankDetails = {
  accountHolderName?: string;
  accountNumber?: string;
  ifsc?: string;
  bankName?: string | null;
  upiId?: string | null;
};

export type OrderReturn = {
  requestedAt?: string;
  reason: string;
  note?: string | null;

  // optional partial return items
  items?: Array<{
    productId: string;
    qty: number;
    variantId?: string | null;
    colorKey?: string | null;
  }>;

  // ✅ images for return proof (max 5 in UI)
  images?: string[];

  // ✅ COD bank details (if paymentMethod=COD)
  bankDetails?: ReturnBankDetails | null;

  status: ReturnStatus;

  approvedAt?: string | null;
  approvedBy?: string | null;

  rejectedAt?: string | null;
  rejectReason?: string | null;
};

export type OrderRefund = {
  method: "COD" | "ONLINE";
  amount: number; // rupees (as per your backend storage)
  status: RefundStatus;
  provider?: "RAZORPAY" | "MANUAL";
  refundId?: string | null;
  processedAt?: string | null;
  raw?: any;
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
paymentStatus: "PENDING" | "PAID" | "FAILED" | "COD_PENDING_CONFIRMATION";

  status: "PLACED" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

  pg?: RazorpaySnapshot | null;
  cod?: CodSnapshot | null;

  shipments?: OrderShipment[];

  // ✅ return/refund snapshots (NEW)
  return?: OrderReturn | null;
  refund?: OrderRefund | null;

  createdAt: string;
  updatedAt: string;
};

export type AdminOrdersResponse = {
  items: AdminOrder[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
};

export type AdminReturnsResponse = AdminOrdersResponse;

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

async function adminFetchJson(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, {
    ...opts,
    credentials: "include",
    headers: {
      ...(opts.headers as any),
      ...authHeaders(),
    },
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const rzDesc =
      json?.error?.description ||
      json?.error?.reason ||
      json?.error?.message ||
      (typeof json?.error === "string" ? json.error : "");

    const msg = json?.message || "Request failed";
    throw new Error(rzDesc ? `${msg} - ${rzDesc}` : msg);
  }

  return json?.data ?? json;
}

function toFiniteNumber(value: any, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toPositiveInt(value: any, fallback: number) {
  return Math.max(1, Math.trunc(toFiniteNumber(value, fallback)));
}

function normalizeAdminOrdersResponse(payload: any, requestedPage: number, requestedLimit: number): AdminOrdersResponse {
  const body = payload?.data ?? payload ?? {};
  const meta = body?.pagination ?? body?.meta ?? payload?.pagination ?? payload?.meta ?? {};
  const items = Array.isArray(body)
    ? body
    : Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body?.orders)
        ? body.orders
        : [];

  const page = toPositiveInt(body?.page ?? meta?.page, requestedPage);
  const limit = toPositiveInt(body?.limit ?? meta?.limit, requestedLimit);
  const serverTotal = toFiniteNumber(body?.total ?? meta?.total ?? meta?.totalItems, NaN);
  const total = Number.isFinite(serverTotal) ? serverTotal : (page - 1) * limit + items.length;

  const pagesFromServer = toFiniteNumber(body?.totalPages ?? meta?.totalPages ?? meta?.pages, NaN);
  const pagesFromTotal = total > 0 ? Math.ceil(total / limit) : 1;
  const hasNextPage =
    Boolean(body?.hasNextPage ?? meta?.hasNextPage ?? body?.hasMore ?? meta?.hasMore) ||
    page < Math.max(1, pagesFromServer || pagesFromTotal);
  const totalPages = Math.max(1, pagesFromServer || pagesFromTotal, hasNextPage ? page + 1 : page);

  return {
    items,
    page,
    limit,
    total,
    totalPages,
    hasPrevPage: Boolean(body?.hasPrevPage ?? meta?.hasPrevPage) || page > 1,
    hasNextPage,
  };
}

/* =========================
 * ORDERS API
 * ========================= */

export async function adminFetchOrders(params?: {
  q?: string;
  status?: string;
  paymentMethod?: "COD" | "ONLINE";
paymentStatus?: "PENDING" | "PAID" | "FAILED" | "COD_PENDING_CONFIRMATION";

  page?: number;
  limit?: number;
}): Promise<AdminOrdersResponse> {
  const sp = new URLSearchParams();

  if (params?.q) sp.set("q", params.q);
  if (params?.status) sp.set("status", params.status);
  if (params?.paymentMethod) sp.set("paymentMethod", params.paymentMethod);
  if (params?.paymentStatus) sp.set("paymentStatus", params.paymentStatus);

  const requestedPage = params?.page ?? 1;
  const requestedLimit = params?.limit ?? 20;

  sp.set("page", String(requestedPage));
  sp.set("limit", String(requestedLimit));

  const res = await fetch(`${API_BASE}/admin/orders?${sp.toString()}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: authHeaders(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Failed to fetch admin orders");

  return normalizeAdminOrdersResponse(json, requestedPage, requestedLimit);
}

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
  if (!res.ok) throw new Error(json?.message || "Status update failed");

  return json?.data || json;
}

export async function adminConfirmCod(orderId: string): Promise<AdminOrder> {
  const res = await fetch(`${API_BASE}/admin/orders/${orderId}/confirm-cod`, {
    method: "PATCH",
    credentials: "include",
    headers: authHeaders(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Confirm COD failed");

  return json?.data || json;
}

/**
 * ✅ Create Shiprocket shipment
 * Route: POST /admin/orders/:orderId/shiprocket/create-shipment
 */
export async function adminCreateShiprocketShipment(orderId: string): Promise<AdminOrder> {
  const res = await fetch(`${API_BASE}/admin/orders/${orderId}/shiprocket/create-shipment`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Create shipment failed");

  return json?.data || json;
}

/* =========================
 * RETURNS API (ADMIN)
 * ========================= */

/**
 * ✅ List return requests (server returns Orders with `return` not null)
 * GET /admin/returns?status=REQUESTED&q=...&page=&limit=
 */
export async function adminFetchReturns(params?: {
  q?: string;
  status?: ReturnStatus | "";
  page?: number;
  limit?: number;
}): Promise<AdminReturnsResponse> {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);
  if (params?.status) sp.set("status", params.status);

  sp.set("page", String(params?.page ?? 1));
  sp.set("limit", String(params?.limit ?? 20));

  const res = await fetch(`${API_BASE}/admin/returns?${sp.toString()}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: authHeaders(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Failed to fetch returns");

  return json?.data || json;
}

export async function adminApproveReturn(orderId: string): Promise<AdminOrder> {
  return adminFetchJson(`${API_BASE}/admin/returns/${orderId}/approve`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function adminRejectReturn(orderId: string, reason: string): Promise<AdminOrder> {
  return adminFetchJson(`${API_BASE}/admin/returns/${orderId}/reject`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ reason }),
  });
}

export async function adminProcessRefund(orderId: string, amount?: number): Promise<AdminOrder> {
  // amount is RUPEES (optional)
  return adminFetchJson(`${API_BASE}/admin/returns/${orderId}/process-refund`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(typeof amount === "number" && amount > 0 ? { amount } : {}),
  });
}
