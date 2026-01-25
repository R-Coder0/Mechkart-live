const API_BASE = process.env.NEXT_PUBLIC_API_URL;

function getVendorToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("vendor_token") || "";
}

function authHeaders(extra?: Record<string, string>) {
  const token = getVendorToken();
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    credentials: "include",
    headers: {
      ...(opts.headers || {}),
      ...authHeaders(),
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);
  return json?.data ?? json;
}

/**
 * GET /api/vendors/me
 */
export async function vendorMe() {
  return api("/vendors/me", { method: "GET" });
}

/**
 * ✅ PATCH /api/vendors/me
 * Update vendor profile fields (company, pickup, payment, phone)
 */
export type VendorUpdatePayload = {
  phone?: string;

  companyName?: string;
  companyEmail?: string;
  gst?: string;

  pickupName?: string;
  pickupPhone?: string;
  pickupAddress?: string;
  pickupCity?: string;
  pickupState?: string;
  pickupPincode?: string;

  upiId?: string;
  bankAccount?: string;
  ifsc?: string;
};

export async function vendorUpdateMe(payload: VendorUpdatePayload) {
  return api("/vendors/me", {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

/**
 * GET /api/vendors/dashboard/stats (optional later)
 */
export async function vendorDashboardStats() {
  return api("/vendors/dashboard/stats", { method: "GET" });
}

export function vendorLogout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("vendor_token");
    localStorage.removeItem("vendor_profile");
    // header ko notify (agar tum listener use kar rahe ho)
    window.dispatchEvent(new Event("vendor-auth-change"));
  }
}
export async function vendorChangePassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return api("/vendors/me/password", {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}