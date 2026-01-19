/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Shiprocket Service (multi-vendor ready)
 * - Handles authentication token caching
 * - Create Shiprocket order
 * - Generate AWB
 * - Track by AWB (optional)
 *
 * ENV required:
 *  - SHIPROCKET_EMAIL
 *  - SHIPROCKET_PASSWORD
 * Optional:
 *  - SHIPROCKET_BASE_URL (default: https://apiv2.shiprocket.in/v1)
 */

const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL || "";
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD || "";
const SHIPROCKET_BASE_URL = process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in/v1";

// Token cache (in-memory)
let cachedToken: string | null = null;
let cachedTokenExpMs = 0; // epoch ms

function assertShiprocketEnv() {
  if (!SHIPROCKET_EMAIL || !SHIPROCKET_PASSWORD) {
    throw new Error("Shiprocket not configured. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD");
  }
}

function nowMs() {
  return Date.now();
}

// Shiprocket token usually valid for some time; we refresh 2 minutes earlier
function isTokenValid() {
  return !!cachedToken && cachedTokenExpMs > nowMs() + 2 * 60 * 1000;
}

async function srFetch(path: string, opts?: RequestInit) {
  const url = `${SHIPROCKET_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers || {}),
    },
  });

  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg =
      json?.message ||
      json?.error ||
      json?.errors ||
      `Shiprocket request failed (${res.status})`;
    const err: any = new Error(typeof msg === "string" ? msg : "Shiprocket request failed");
    err.status = res.status;
    err.payload = json;
    throw err;
  }

  return json;
}

/**
 * Login & cache token
 */
export async function shiprocketGetToken(force = false): Promise<string> {
  assertShiprocketEnv();

  if (!force && isTokenValid()) return cachedToken as string;

  const payload = {
    email: SHIPROCKET_EMAIL,
    password: SHIPROCKET_PASSWORD,
  };

  // Shiprocket login endpoint (v1)
  const json = await srFetch("/external/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const token = json?.token;
  if (!token) {
    const err: any = new Error("Shiprocket login failed: token missing");
    err.payload = json;
    throw err;
  }

  // Shiprocket sometimes doesn't return expiry explicitly; assume 24h if missing
  // If "expires_in" exists (seconds), use it.
  const expiresInSec = Number(json?.expires_in || 24 * 60 * 60);
  cachedToken = token;
  cachedTokenExpMs = nowMs() + expiresInSec * 1000;

  return token;
}

async function shiprocketAuthHeaders() {
  const token = await shiprocketGetToken(false);
  return { Authorization: `Bearer ${token}` };
}

/**
 * Create order in Shiprocket
 * Shiprocket "order" expects:
 *  - order_id (string)
 *  - order_date (YYYY-MM-DD HH:mm)
 *  - billing_* fields
 *  - shipping_is_billing (true)
 *  - order_items array [{ name, sku, units, selling_price }]
 *  - payment_method ("COD"/"Prepaid")
 *  - sub_total
 *  - length/breadth/height/weight (required by many accounts)
 *
 * We keep this generic; controller will map our Order -> this payload.
 */
export async function shiprocketCreateOrder(orderPayload: any) {
  const headers = await shiprocketAuthHeaders();

  try {
    return await srFetch("/external/orders/create/adhoc", {
      method: "POST",
      headers,
      body: JSON.stringify(orderPayload),
    });
  } catch (e: any) {
    // token might be expired; retry once with force refresh
    if (e?.status === 401) {
      const token = await shiprocketGetToken(true);
      return await srFetch("/external/orders/create/adhoc", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(orderPayload),
      });
    }
    throw e;
  }
}

/**
 * Generate AWB for a shipment
 * Requires shipment_id and courier_id (courier_company_id)
 */
export async function shiprocketGenerateAwb(params: {
  shipment_id: number;
  courier_id: number;
}) {
  const headers = await shiprocketAuthHeaders();

  const payload = {
    shipment_id: params.shipment_id,
    courier_id: params.courier_id,
  };

  try {
    return await srFetch("/external/courier/assign/awb", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (e: any) {
    if (e?.status === 401) {
      const token = await shiprocketGetToken(true);
      return await srFetch("/external/courier/assign/awb", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
    }
    throw e;
  }
}

/**
 * Get courier serviceability
 * Useful to choose courier_id automatically (optional)
 */
export async function shiprocketCheckServiceability(params: {
  pickup_postcode: string;
  delivery_postcode: string;
  weight: number; // kg
  cod: 0 | 1;
}) {
  const headers = await shiprocketAuthHeaders();

  const sp = new URLSearchParams();
  sp.set("pickup_postcode", String(params.pickup_postcode));
  sp.set("delivery_postcode", String(params.delivery_postcode));
  sp.set("weight", String(params.weight));
  sp.set("cod", String(params.cod));

  try {
    return await srFetch(`/external/courier/serviceability?${sp.toString()}`, {
      method: "GET",
      headers,
    });
  } catch (e: any) {
    if (e?.status === 401) {
      const token = await shiprocketGetToken(true);
      return await srFetch(`/external/courier/serviceability?${sp.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    throw e;
  }
}

/**
 * Track by AWB
 * (Optional; you can use webhooks later for auto updates)
 */
export async function shiprocketTrackByAwb(awb: string) {
  const headers = await shiprocketAuthHeaders();

  try {
    // Some accounts use: /external/courier/track/awb/:awb
    // We'll keep this generic; if your endpoint differs we’ll adjust quickly.
    return await srFetch(`/external/courier/track/awb/${encodeURIComponent(awb)}`, {
      method: "GET",
      headers,
    });
  } catch (e: any) {
    if (e?.status === 401) {
      const token = await shiprocketGetToken(true);
      return await srFetch(`/external/courier/track/awb/${encodeURIComponent(awb)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    throw e;
  }
}

/**
 * Helpers to format date for Shiprocket: "YYYY-MM-DD HH:mm"
 */
export function shiprocketFormatOrderDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
