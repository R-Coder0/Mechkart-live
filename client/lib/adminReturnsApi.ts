/* eslint-disable @typescript-eslint/no-explicit-any */
const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export type ReturnStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "PICKUP_CREATED"
  | "RECEIVED"
  | "REFUNDED";

export type AdminReturnItem = {
  productId: string;
  qty: number;
  variantId?: string | null;
  colorKey?: string | null;

  // ✅ enriched fields (optional)
  productCode?: string; // SKU / productCode
  sku?: string;
  title?: string;
  image?: string;
  finalLineTotal?: number;
};

export type AdminReturnRow = {
  orderId: string;
  orderCode?: string;
  userId?: string;

  paymentMethod?: string;
  paymentStatus?: string;
  orderStatus?: string;

  subOrderId: string;
  subOrderStatus?: string;
  ownerType?: "ADMIN" | "VENDOR";
  vendorId?: string | null;
  vendorName?: string | null;
  soldBy?: string;

  returnId: string;
  returnStatus: ReturnStatus | string;
  requestedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  receivedAt?: string;
  rejectReason?: string | null;

  items?: AdminReturnItem[];

  reason?: string;
  note?: string | null;
  images?: string[];
  bankDetails?: any;

  handledByRole?: string | null;
  handledById?: string | null;

  refund?: any;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminReturnsResponse = {
  items: AdminReturnRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

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

async function fetchJson(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, {
    ...opts,
    cache: "no-store",
    headers: {
      ...(opts.headers as any),
      ...authHeaders(),
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.message || "Request failed";
    throw new Error(msg);
  }
  return json?.data ?? json;
}

export async function adminFetchReturns(params?: {
  q?: string;
  status?: ReturnStatus | "";
  ownerType?: "ADMIN" | "VENDOR" | "";
  page?: number;
  limit?: number;
}): Promise<AdminReturnsResponse> {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);
  if (params?.status) sp.set("status", params.status);
  if (params?.ownerType) sp.set("ownerType", params.ownerType);
  sp.set("page", String(params?.page ?? 1));
  sp.set("limit", String(params?.limit ?? 20));

  return fetchJson(`${API_BASE}/admin/returns?${sp.toString()}`, {
    method: "GET",
    headers: authHeaders(),
  });
}

export async function adminApproveReturn(orderId: string, subOrderId: string, returnId: string) {
  return fetchJson(
    `${API_BASE}/admin/orders/${orderId}/suborders/${subOrderId}/returns/${returnId}/approve`,
    {
      method: "POST",
      headers: authHeaders(),
    }
  );
}

export async function adminRejectReturn(
  orderId: string,
  subOrderId: string,
  returnId: string,
  rejectReason: string
) {
  return fetchJson(
    `${API_BASE}/admin/orders/${orderId}/suborders/${subOrderId}/returns/${returnId}/reject`,
    {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ rejectReason }),
    }
  );
}

/**
 * ✅ Refund (Admin)
 * POST /api/admin/orders/:orderId/suborders/:subOrderId/returns/:returnId/refund
 */
export async function adminProcessRefund(orderId: string, subOrderId: string, returnId: string) {
  return fetchJson(
    `${API_BASE}/admin/orders/${orderId}/suborders/${subOrderId}/returns/${returnId}/refund`,
    {
      method: "POST",
      headers: authHeaders(),
    }
  );
}