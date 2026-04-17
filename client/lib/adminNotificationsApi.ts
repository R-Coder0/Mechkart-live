const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export type AdminNotificationCounts = {
  sidebar: {
    vendorsPending: number;
    vendorProductsPending: number;
    newOrders: number;
    returnsRequested: number;
  };
  vendors: {
    ALL: number;
    PENDING: number;
    APPROVED: number;
    REJECTED: number;
    DISABLED: number;
  };
  vendorProducts: {
    ALL: number;
    PENDING: number;
    APPROVED: number;
    REJECTED: number;
  };
  orders: {
    ALL: number;
    PLACED: number;
    CONFIRMED: number;
    SHIPPED: number;
  };
  returns: {
    REQUESTED: number;
  };
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

export async function adminFetchNotificationCounts(): Promise<AdminNotificationCounts> {
  const res = await fetch(`${API_BASE}/admin/notifications/counts`, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
    headers: authHeaders(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || "Failed to fetch admin notification counts");
  }

  return json?.data || json;
}
