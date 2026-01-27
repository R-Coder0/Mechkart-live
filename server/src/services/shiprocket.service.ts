/* eslint-disable @typescript-eslint/no-explicit-any */

const SHIPROCKET_EMAIL = (process.env.SHIPROCKET_EMAIL || "").trim();
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD || "";

// keep default as you have
const SHIPROCKET_BASE_URL_RAW =
  process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in/v1";

// Normalize base url (remove trailing slash)
const SHIPROCKET_BASE_URL = SHIPROCKET_BASE_URL_RAW.replace(/\/+$/, "");

// ---- Debug flags (safe) ----
const SR_DEBUG = String(process.env.SHIPROCKET_DEBUG ?? "").toLowerCase() === "true";

// In-memory token cache (per Node process)
let cachedToken: string | null = null;
let cachedTokenExpMs = 0;

// Prevent parallel login calls
let inFlightLogin: Promise<string> | null = null;

// Block cooldown to avoid extending Shiprocket lock
let blockedUntilMs = 0;

// Counter for visibility
let loginAttemptCount = 0;

function assertShiprocketEnv() {
  if (!SHIPROCKET_EMAIL || !SHIPROCKET_PASSWORD) {
    throw new Error("Shiprocket not configured. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD");
  }
}

function nowMs() {
  return Date.now();
}

// Refresh 2 minutes earlier
function isTokenValid() {
  return !!cachedToken && cachedTokenExpMs > nowMs() + 2 * 60 * 1000;
}

function safeDebugEnvOnce() {
  if (!SR_DEBUG) return;
  // DO NOT log password value, only length.
  console.log("[SR][ENV] baseUrl:", SHIPROCKET_BASE_URL);
  console.log("[SR][ENV] email:", JSON.stringify(SHIPROCKET_EMAIL));
  console.log("[SR][ENV] pass_len:", SHIPROCKET_PASSWORD.length);
}

function decodeJwtExpMs(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadB64 + "===".slice((payloadB64.length + 3) % 4);
    const json = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    const expSec = Number(json?.exp);
    if (!expSec || Number.isNaN(expSec)) return null;
    return expSec * 1000;
  } catch {
    return null;
  }
}

function isBlockedLoginMessage(msg: any) {
  const s = String(msg || "").toLowerCase();
  return s.includes("blocked") && s.includes("login");
}

function enterBlockedCooldown(minutes = 3) {
  blockedUntilMs = nowMs() + minutes * 60 * 1000;
}

function assertNotInBlockedCooldown() {
  if (blockedUntilMs > nowMs()) {
    const secs = Math.ceil((blockedUntilMs - nowMs()) / 1000);
    const err: any = new Error(`Shiprocket login temporarily blocked. Cooldown active for ~${secs}s`);
    err.status = 429;
    err.code = "SR_LOGIN_COOLDOWN";
    throw err;
  }
}

async function srFetch(path: string, opts?: RequestInit) {
  const url = `${SHIPROCKET_BASE_URL}${path}`;

  const controller = new AbortController();
  const timeoutMs = 20000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "MechkartShiprocket/1.0",
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

      // If Shiprocket says blocked, set cooldown so we don't keep hammering login
      if (res.status === 403 && isBlockedLoginMessage(msg)) {
        enterBlockedCooldown(5);
      }

      throw err;
    }

    return json;
  } finally {
    clearTimeout(t);
  }
}

async function shiprocketLoginAndCache(): Promise<string> {
  assertShiprocketEnv();
  assertNotInBlockedCooldown();
  safeDebugEnvOnce();

  loginAttemptCount += 1;
  if (SR_DEBUG) {
    console.log(`[SR][LOGIN] attempt #${loginAttemptCount} at`, new Date().toISOString());
  }

  const payload = { email: SHIPROCKET_EMAIL, password: SHIPROCKET_PASSWORD };

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

  const jwtExpMs = decodeJwtExpMs(token);
  const expiresInSecRaw = json?.expires_in;
  const expiresInSec = Number(expiresInSecRaw);

  let expMs: number;
  if (jwtExpMs) {
    expMs = jwtExpMs;
  } else if (expiresInSecRaw != null && !Number.isNaN(expiresInSec) && expiresInSec > 60) {
    expMs = nowMs() + expiresInSec * 1000;
  } else {
    expMs = nowMs() + 24 * 60 * 60 * 1000;
  }

  cachedToken = token;
  cachedTokenExpMs = expMs;

  if (SR_DEBUG) {
    const ttlMin = Math.floor((cachedTokenExpMs - nowMs()) / 60000);
    console.log("[SR][LOGIN] token cached, approx ttl(min):", ttlMin);
  }

  return token;
}

/**
 * Login & cache token (singleflight)
 */
export async function shiprocketGetToken(force = false): Promise<string> {
  assertShiprocketEnv();

  if (!force && isTokenValid()) return cachedToken as string;

  if (!force && inFlightLogin) return inFlightLogin;

  inFlightLogin = (async () => {
    try {
      return await shiprocketLoginAndCache();
    } finally {
      inFlightLogin = null;
    }
  })();

  return inFlightLogin;
}

async function shiprocketAuthHeaders() {
  const token = await shiprocketGetToken(false);
  return { Authorization: `Bearer ${token}` };
}

function isBlockedLoginError(e: any) {
  const msg = String(e?.message || "").toLowerCase();
  return e?.status === 403 && msg.includes("blocked") && msg.includes("login");
}

/**
 * Create order in Shiprocket
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
    if (isBlockedLoginError(e)) throw e;

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
 * Generate AWB
 */
export async function shiprocketGenerateAwb(params: { shipment_id: number; courier_id: number }) {
  const headers = await shiprocketAuthHeaders();
  const payload = { shipment_id: params.shipment_id, courier_id: params.courier_id };

  try {
    return await srFetch("/external/courier/assign/awb", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (e: any) {
    if (isBlockedLoginError(e)) throw e;

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
 * Courier serviceability
 */
export async function shiprocketCheckServiceability(params: {
  pickup_postcode: string;
  delivery_postcode: string;
  weight: number;
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
    if (isBlockedLoginError(e)) throw e;

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
 */
export async function shiprocketTrackByAwb(awb: string) {
  const headers = await shiprocketAuthHeaders();

  try {
    return await srFetch(`/external/courier/track/awb/${encodeURIComponent(awb)}`, {
      method: "GET",
      headers,
    });
  } catch (e: any) {
    if (isBlockedLoginError(e)) throw e;

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

export function shiprocketFormatOrderDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
/**
 * List pickup locations (Shiprocket)
 */
export async function shiprocketListPickupLocations() {
  const headers = await shiprocketAuthHeaders();

  try {
    return await srFetch("/external/settings/company/pickup", {
      method: "GET",
      headers,
    });
  } catch (e: any) {
    if (isBlockedLoginError(e)) throw e;

    if (e?.status === 401) {
      const token = await shiprocketGetToken(true);
      return await srFetch("/external/settings/company/pickup", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    throw e;
  }
}
/**
 * Create/Add pickup location (Shiprocket)
 * NOTE: pickup "pickup_location" should be UNIQUE name/alias in Shiprocket dashboard.
 */
export async function shiprocketCreatePickupLocation(pickup: {
  pickup_location: string; // alias name in shiprocket
  name: string;
  email?: string;
  phone: string;
  address: string;
  address_2?: string;
  city: string;
  state: string;
  country?: string; // usually "India"
  pin_code: string;
}) {
  const headers = await shiprocketAuthHeaders();

  try {
    return await srFetch("/external/settings/company/addpickup", {
      method: "POST",
      headers,
      body: JSON.stringify(pickup),
    });
  } catch (e: any) {
    if (isBlockedLoginError(e)) throw e;

    if (e?.status === 401) {
      const token = await shiprocketGetToken(true);
      return await srFetch("/external/settings/company/addpickup", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(pickup),
      });
    }
    throw e;
  }
}
