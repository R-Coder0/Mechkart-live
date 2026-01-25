/* eslint-disable @typescript-eslint/no-explicit-any */
const API_BASE = process.env.NEXT_PUBLIC_API_URL;

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
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = json?.message || "Request failed";
    throw new Error(msg);
  }

  return json?.data ?? json;
}

/* =========================
 * TYPES
 * ========================= */

// ✅ add DISABLED
export type VendorStatus = "PENDING" | "APPROVED" | "REJECTED" | "DISABLED";

/* =========================
 * VENDORS API (ADMIN)
 * ========================= */

export async function adminListVendors(params: {
  status?: VendorStatus | "ALL";
  q?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status); // ALL bhi bhejo
  if (params.q) qs.set("q", params.q);
  qs.set("page", String(params.page ?? 1));
  qs.set("limit", String(params.limit ?? 20));

  return adminFetchJson(`${API_BASE}/admin/vendors?${qs.toString()}`, {
    method: "GET",
    headers: authHeaders(),
  });
}

export async function adminGetVendor(vendorId: string) {
  return adminFetchJson(`${API_BASE}/admin/vendors/${vendorId}`, {
    method: "GET",
    headers: authHeaders(),
  });
}

export async function adminApproveVendor(vendorId: string) {
  return adminFetchJson(`${API_BASE}/admin/vendors/${vendorId}/approve`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function adminRejectVendor(vendorId: string, reason: string) {
  return adminFetchJson(`${API_BASE}/admin/vendors/${vendorId}/reject`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ reason }),
  });
}

/** ✅ Disable vendor (soft) */
export async function adminDisableVendor(vendorId: string, reason?: string) {
  return adminFetchJson(`${API_BASE}/admin/vendors/${vendorId}/disable`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ reason: reason || "Disabled by admin" }),
  });
}

/** ✅ Enable vendor back */
export async function adminEnableVendor(vendorId: string) {
  return adminFetchJson(`${API_BASE}/admin/vendors/${vendorId}/enable`, {
    method: "POST",
    headers: authHeaders(),
  });
}

/** ❌ Delete vendor permanently */
export async function adminDeleteVendor(vendorId: string) {
  return adminFetchJson(`${API_BASE}/admin/vendors/${vendorId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}
