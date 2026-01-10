/* eslint-disable @typescript-eslint/no-explicit-any */
const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export type AdminOrdersResponse = {
  items: any[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function getAdminToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("admin_token") || "";
}

export async function adminFetchOrders(params?: {
  q?: string;
  status?: string;
  paymentMethod?: string;
  page?: number;
  limit?: number;
}): Promise<AdminOrdersResponse> {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);
  if (params?.status) sp.set("status", params.status);
  if (params?.paymentMethod) sp.set("paymentMethod", params.paymentMethod);
  sp.set("page", String(params?.page ?? 1));
  sp.set("limit", String(params?.limit ?? 20));

  const token = getAdminToken();

  const res = await fetch(`${API_BASE}/admin/orders?${sp.toString()}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Failed to fetch orders");
  return json?.data || json;
}

export async function adminUpdateOrderStatus(orderId: string, status: string) {
  const token = getAdminToken();

  const res = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ status }), // ✅ important
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Status update failed");
  return json?.data || json;
}
