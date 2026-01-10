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
  addressType?: "HOME" | "WORK" | "OTHER"; // optional if you add it
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

function unwrap<T = any>(json: any): T {
  // supports both: {data:{...}} and direct shapes if ever used elsewhere
  return (json?.data ?? json) as T;
}

export async function fetchAddresses(): Promise<FetchAddressesResponse> {
  const res = await fetch(`${API_BASE}/users/addresses`, {
    credentials: "include",
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
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
  const json = await res.json().catch(() => ({}));
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
  const json = await res.json().catch(() => ({}));
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
  const json = await res.json().catch(() => ({}));
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
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Set default failed");
  const data = unwrap<FetchAddressesResponse>(json);
  return {
    user: data?.user || { name: "", email: "", phone: "" },
    addresses: data?.addresses || [],
  };
}

export async function checkoutSummary(): Promise<any> {
  const res = await fetch(`${API_BASE}/users/checkout/summary`, {
    credentials: "include",
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Checkout summary failed");
  return unwrap(json);
}

export async function createCodOrder(payload: any): Promise<any> {
  // ✅ FIX: route is /users/orders (no /cod)
  const res = await fetch(`${API_BASE}/users/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Order failed");
  return unwrap(json);
}
