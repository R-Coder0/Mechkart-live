/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  checkoutSummary,
  fetchAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  createCodOrder,
  type Address,
} from "@/lib/checkoutApi";
export const dynamic = "force-dynamic";
const API_BASE = process.env.NEXT_PUBLIC_API_URL;

function resolveImageUrl(path?: string) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const host = (API_BASE || "").replace(/\/api\/?$/, "");
  return path.startsWith("/") ? `${host}${path}` : `${host}/${path}`;
}

const norm = (v: any) => String(v ?? "").trim();
const normKey = (v: any) => norm(v).toLowerCase();

function getVariantText(product?: any, variantId?: string) {
  const v = (product?.variants || []).find((x: any) => String(x._id) === String(variantId));
  if (!v) return "Variant";
  return v.label || v.comboText || v.size || v.weight || "Variant";
}

function resolveCheckoutItemImage(product?: any, variantId?: string, colorKey?: string | null) {
  if (!product) return "";

  const v = (product.variants || []).find((x: any) => String(x._id) === String(variantId));
  const c = (product.colors || []).find((x: any) => normKey(x.name) === normKey(colorKey));

  const cImg = (c?.images || []).find(Boolean);
  const vImg = (v?.images || []).find(Boolean);
  const gImg = (product.galleryImages || []).find(Boolean);
  const fImg = product.featureImage || "";

  return cImg || vImg || gImg || fImg || "";
}

function money(n: number) {
  return `₹${Math.round(Number(n || 0))}`;
}

type ApiUserBasics = { name: string; email: string; phone: string };
type FetchAddressesResp = { user: ApiUserBasics; addresses: Address[] };

export default function CheckoutPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);

  const [userBasics, setUserBasics] = useState<ApiUserBasics>({ name: "", email: "", phone: "" });

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string>("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // address form (Myntra style: includes name+mobile + address)
  const [addrForm, setAddrForm] = useState<any>({
    fullName: "",
    phone: "",
    pincode: "",
    state: "",
    city: "",
    addressLine1: "",
    addressLine2: "",
    landmark: "",
    makeDefault: true,
  });

  const [showAddrForm, setShowAddrForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const items = summary?.items || [];
  const totals = summary?.totals || { subtotal: 0, mrpTotal: 0, savings: 0 };

  const selectedAddress = useMemo(() => {
    return addresses.find((a) => String(a._id) === String(addressId)) || null;
  }, [addresses, addressId]);

  const refreshAddresses = async () => {
    const addrResp = (await fetchAddresses()) as unknown as FetchAddressesResp;

    const apiUser = addrResp?.user || { name: "", email: "", phone: "" };
    const apiAddresses = addrResp?.addresses || [];

    setUserBasics(apiUser);
    setAddresses(apiAddresses);

    // keep selection if exists else default else first
    const still = apiAddresses.find((a) => String(a._id) === String(addressId));
    const def = apiAddresses.find((a) => a.isDefault) || apiAddresses[0];
    const pick = still || def;

    if (pick?._id) setAddressId(pick._id);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const sum = await checkoutSummary();
        setSummary(sum);

        await refreshAddresses();
      } catch (e: any) {
        const msg = e?.message || "Checkout failed";
        setError(msg);

        if (String(msg).toLowerCase().includes("no items selected")) {
          window.location.href = "/website/cart?err=no_selected";
          return;
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canPlace = useMemo(() => {
    if (!items.length) return false;
    if (!addressId) return false;
    return true;
  }, [items.length, addressId]);

  const openAddForm = () => {
    setEditingId(null);
    setShowAddrForm(true);
    setAddrForm({
      fullName: userBasics.name || "",
      phone: userBasics.phone || "",
      pincode: "",
      state: "",
      city: "",
      addressLine1: "",
      addressLine2: "",
      landmark: "",
      makeDefault: true,
    });
  };

  const openEditForm = (a: Address) => {
    setEditingId(a._id);
    setShowAddrForm(true);
    setAddrForm({
      fullName: a.fullName || "",
      phone: a.phone || "",
      pincode: a.pincode || "",
      state: a.state || "",
      city: a.city || "",
      addressLine1: a.addressLine1 || "",
      addressLine2: a.addressLine2 || "",
      landmark: a.landmark || "",
      makeDefault: !!a.isDefault,
    });
  };

  const onSaveAddress = async () => {
    try {
      setBusy("SAVE_ADDRESS");
      setError(null);

      if (editingId) {
        await updateAddress(editingId, addrForm);
      } else {
        await addAddress({ ...addrForm, makeDefault: true });
      }

      await refreshAddresses();
      setShowAddrForm(false);
      setEditingId(null);
    } catch (e: any) {
      setError(e?.message || "Save address failed");
    } finally {
      setBusy(null);
    }
  };

  const onRemoveAddress = async (id: string) => {
    try {
      setBusy(`DEL_${id}`);
      setError(null);
      await deleteAddress(id);
      await refreshAddresses();
    } catch (e: any) {
      setError(e?.message || "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  const onMakeDefault = async (id: string) => {
    try {
      setBusy(`DEF_${id}`);
      setError(null);
      await setDefaultAddress(id);
      await refreshAddresses();
    } catch (e: any) {
      setError(e?.message || "Set default failed");
    } finally {
      setBusy(null);
    }
  };

  const onPlaceOrder = async () => {
    if (!canPlace) {
      setError("Please select a delivery address.");
      return;
    }

    try {
      setBusy("PLACE_ORDER");
      setError(null);

      const a = selectedAddress;

      const data = await createCodOrder({
        addressId,
        // ✅ Myntra-style: contact derived from address + user email
        contact: {
          name: a?.fullName || userBasics.name || "",
          phone: a?.phone || userBasics.phone || "",
          email: userBasics.email || undefined,
        },
      });

      const orderId = data?.orderId;
      window.location.href = orderId
        ? `/website/order-success?orderId=${orderId}`
        : "/website/order-success";
    } catch (e: any) {
      setError(e?.message || "Order failed");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="h-6 w-40 bg-gray-200 animate-pulse rounded" />
        <div className="mt-6 h-28 rounded-2xl border bg-gray-50 animate-pulse" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="rounded-3xl border bg-white p-10 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Nothing selected</h1>
          <p className="mt-2 text-gray-600">Select items in cart first.</p>
          <Link
            href="/website/cart"
            className="mt-6 inline-flex rounded-2xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white"
          >
            Go to cart
          </Link>
        </div>
      </div>
    );
  }

  const defaultAddr = addresses.find((a) => a.isDefault);
  const otherAddrs = addresses.filter((a) => !a.isDefault);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
          <p className="text-gray-600">{items.length} item(s)</p>
        </div>
        <Link href="/website/cart" className="text-sm font-semibold text-gray-700 hover:underline">
          Back to cart
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="rounded-3xl border bg-white p-5">
            <div className="text-lg font-bold text-gray-900">Items</div>
            <div className="mt-4 space-y-4">
              {items.map((it: any, idx: number) => {
                const product = it.product || null;
                const imgPath = resolveCheckoutItemImage(product, it.variantId, it.colorKey);
                const img = resolveImageUrl(imgPath);
                const vText = getVariantText(product, it.variantId);

                return (
                  <div key={idx} className="flex gap-4 border-b pb-4 last:border-b-0 last:pb-0">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gray-50">
                      <img src={img} alt={it.title} className="h-full w-full object-cover" />
                    </div>

                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900">
                        {product?.title || it.title}
                      </div>

                      {it.productCode ? (
                        <div className="mt-0.5 text-[11px] font-semibold text-gray-500">
                          Code: {it.productCode}
                        </div>
                      ) : null}

                      <div className="mt-1 text-xs text-gray-500">
                        Variant: {vText}
                        {it.colorKey ? ` • Color: ${it.colorKey}` : ""}
                        {" • "}Qty: {it.qty}
                      </div>

                      <div className="mt-2 flex items-center justify-between text-sm">
                        <div className="text-gray-600">
                          {money(it.salePrice)} × {it.qty}
                        </div>
                        <div className="font-semibold text-gray-900">{money(it.lineTotal)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Address (Myntra style) */}
          <div className="rounded-3xl border bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-bold text-gray-900">Delivery Address</div>

              <button
                type="button"
                onClick={openAddForm}
                className="rounded-2xl border px-4 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
              >
                Add New Address
              </button>
            </div>

            {addresses.length > 0 ? (
              <div className="mt-4 space-y-4">
                {defaultAddr ? (
                  <div>
                    <div className="text-[12px] font-bold text-gray-700">DEFAULT ADDRESS</div>
                    <div className="mt-2">
                      <AddressCard
                        a={defaultAddr}
                        active={String(defaultAddr._id) === String(addressId)}
                        onSelect={() => setAddressId(defaultAddr._id)}
                        onEdit={() => openEditForm(defaultAddr)}
                        onRemove={() => onRemoveAddress(defaultAddr._id)}
                        onMakeDefault={null}
                        busy={busy}
                      />
                    </div>
                  </div>
                ) : null}

                {otherAddrs.length ? (
                  <div>
                    <div className="text-[12px] font-bold text-gray-700">OTHER ADDRESS</div>
                    <div className="mt-2 grid gap-3">
                      {otherAddrs.map((a) => (
                        <AddressCard
                          key={a._id}
                          a={a}
                          active={String(a._id) === String(addressId)}
                          onSelect={() => setAddressId(a._id)}
                          onEdit={() => openEditForm(a)}
                          onRemove={() => onRemoveAddress(a._id)}
                          onMakeDefault={() => onMakeDefault(a._id)}
                          busy={busy}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {showAddrForm ? (
                  <div className="mt-4 rounded-3xl border bg-white p-4">
                    <div className="text-sm font-bold text-gray-900">
                      {editingId ? "Edit Address" : "Add New Address"}
                    </div>

                    {/* ✅ Myntra-style: Contact Details (name + mobile) inside address form */}
                    <div className="mt-4 text-xs font-bold text-gray-700">CONTACT DETAILS</div>
                    <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        className="h-11 rounded-2xl border px-4 text-sm"
                        placeholder="Name*"
                        value={addrForm.fullName}
                        onChange={(e) =>
                          setAddrForm((p: any) => ({ ...p, fullName: e.target.value }))
                        }
                      />
                      <input
                        className="h-11 rounded-2xl border px-4 text-sm"
                        placeholder="Mobile No*"
                        value={addrForm.phone}
                        onChange={(e) => setAddrForm((p: any) => ({ ...p, phone: e.target.value }))}
                      />
                    </div>

                    <div className="mt-5 text-xs font-bold text-gray-700">ADDRESS</div>
                    <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        className="h-11 rounded-2xl border px-4 text-sm"
                        placeholder="Pin Code*"
                        value={addrForm.pincode}
                        onChange={(e) =>
                          setAddrForm((p: any) => ({ ...p, pincode: e.target.value }))
                        }
                      />
                      <input
                        className="h-11 rounded-2xl border px-4 text-sm"
                        placeholder="State*"
                        value={addrForm.state}
                        onChange={(e) => setAddrForm((p: any) => ({ ...p, state: e.target.value }))}
                      />
                      <input
                        className="h-11 rounded-2xl border px-4 text-sm"
                        placeholder="City*"
                        value={addrForm.city}
                        onChange={(e) => setAddrForm((p: any) => ({ ...p, city: e.target.value }))}
                      />
                      <input
                        className="h-11 rounded-2xl border px-4 text-sm sm:col-span-2"
                        placeholder="Address (locality, building, street)*"
                        value={addrForm.addressLine1}
                        onChange={(e) =>
                          setAddrForm((p: any) => ({ ...p, addressLine1: e.target.value }))
                        }
                      />
                      <input
                        className="h-11 rounded-2xl border px-4 text-sm sm:col-span-2"
                        placeholder="Address line 2 (optional)"
                        value={addrForm.addressLine2}
                        onChange={(e) =>
                          setAddrForm((p: any) => ({ ...p, addressLine2: e.target.value }))
                        }
                      />
                      <input
                        className="h-11 rounded-2xl border px-4 text-sm sm:col-span-2"
                        placeholder="Landmark (optional)"
                        value={addrForm.landmark}
                        onChange={(e) =>
                          setAddrForm((p: any) => ({ ...p, landmark: e.target.value }))
                        }
                      />
                    </div>

                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={onSaveAddress}
                        disabled={busy === "SAVE_ADDRESS"}
                        className="flex-1 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                      >
                        {busy === "SAVE_ADDRESS"
                          ? "Saving..."
                          : editingId
                          ? "Update"
                          : "Save"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAddrForm(false);
                          setEditingId(null);
                        }}
                        className="flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <div className="mt-2 text-sm text-gray-600">
                  No saved address found. Please add address to continue.
                </div>

                {/* If no addresses, show form directly (Myntra style layout) */}
                <div className="mt-4 rounded-3xl border bg-white p-4">
                  <div className="text-xs font-bold text-gray-700">CONTACT DETAILS</div>
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      className="h-11 rounded-2xl border px-4 text-sm"
                      placeholder="Name*"
                      value={addrForm.fullName}
                      onChange={(e) =>
                        setAddrForm((p: any) => ({ ...p, fullName: e.target.value }))
                      }
                    />
                    <input
                      className="h-11 rounded-2xl border px-4 text-sm"
                      placeholder="Mobile No*"
                      value={addrForm.phone}
                      onChange={(e) => setAddrForm((p: any) => ({ ...p, phone: e.target.value }))}
                    />
                  </div>

                  <div className="mt-5 text-xs font-bold text-gray-700">ADDRESS</div>
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      className="h-11 rounded-2xl border px-4 text-sm"
                      placeholder="Pin Code*"
                      value={addrForm.pincode}
                      onChange={(e) => setAddrForm((p: any) => ({ ...p, pincode: e.target.value }))}
                    />
                    <input
                      className="h-11 rounded-2xl border px-4 text-sm"
                      placeholder="State*"
                      value={addrForm.state}
                      onChange={(e) => setAddrForm((p: any) => ({ ...p, state: e.target.value }))}
                    />
                    <input
                      className="h-11 rounded-2xl border px-4 text-sm"
                      placeholder="City*"
                      value={addrForm.city}
                      onChange={(e) => setAddrForm((p: any) => ({ ...p, city: e.target.value }))}
                    />
                    <input
                      className="h-11 rounded-2xl border px-4 text-sm sm:col-span-2"
                      placeholder="Address (locality, building, street)*"
                      value={addrForm.addressLine1}
                      onChange={(e) =>
                        setAddrForm((p: any) => ({ ...p, addressLine1: e.target.value }))
                      }
                    />
                    <input
                      className="h-11 rounded-2xl border px-4 text-sm sm:col-span-2"
                      placeholder="Address line 2 (optional)"
                      value={addrForm.addressLine2}
                      onChange={(e) =>
                        setAddrForm((p: any) => ({ ...p, addressLine2: e.target.value }))
                      }
                    />
                    <input
                      className="h-11 rounded-2xl border px-4 text-sm sm:col-span-2"
                      placeholder="Landmark (optional)"
                      value={addrForm.landmark}
                      onChange={(e) =>
                        setAddrForm((p: any) => ({ ...p, landmark: e.target.value }))
                      }
                    />
                  </div>

                  <button
                    type="button"
                    onClick={onSaveAddress}
                    disabled={busy === "SAVE_ADDRESS"}
                    className="mt-4 w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                  >
                    {busy === "SAVE_ADDRESS" ? "Saving..." : "Save"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 rounded-3xl border bg-white p-5">
            <div className="text-lg font-bold text-gray-900">Order Summary</div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">{money(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">MRP Total</span>
                <span className="font-semibold">{money(totals.mrpTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">You save</span>
                <span className="font-semibold text-emerald-700">{money(totals.savings)}</span>
              </div>

              <div className="h-px bg-gray-200" />

              <div className="flex justify-between text-base">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-gray-900">{money(totals.subtotal)}</span>
              </div>
            </div>

            <button
              onClick={onPlaceOrder}
              disabled={!canPlace || busy === "PLACE_ORDER"}
              className="mt-6 w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
            >
              {busy === "PLACE_ORDER" ? "Placing order..." : "Place Order (COD)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddressCard({
  a,
  active,
  onSelect,
  onEdit,
  onRemove,
  onMakeDefault,
  busy,
}: {
  a: Address;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onMakeDefault: null | (() => void);
  busy: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-2xl border p-4 transition ${
        active ? "border-gray-900" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">{a.fullName}</div>
          <div className="mt-1 text-xs text-gray-600">
            {a.addressLine1}
            {a.addressLine2 ? `, ${a.addressLine2}` : ""}
            {a.landmark ? `, ${a.landmark}` : ""}
            {` • ${a.city}, ${a.state} - ${a.pincode}`}
          </div>
          <div className="mt-1 text-xs font-semibold text-gray-700">Mobile: {a.phone}</div>
        </div>

        {a.isDefault ? <span className="text-[11px] font-semibold text-emerald-700">Default</span> : null}
      </div>

      <div className="mt-3 flex gap-3">
        <span
          className="inline-flex rounded-xl border px-4 py-2 text-[11px] font-semibold text-gray-900 hover:bg-gray-50"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
        >
          {busy === `DEL_${a._id}` ? "Removing..." : "REMOVE"}
        </span>

        <span
          className="inline-flex rounded-xl border px-4 py-2 text-[11px] font-semibold text-gray-900 hover:bg-gray-50"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit();
          }}
        >
          EDIT
        </span>

        {onMakeDefault ? (
          <span
            className="inline-flex rounded-xl border px-4 py-2 text-[11px] font-semibold text-gray-900 hover:bg-gray-50"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMakeDefault();
            }}
          >
            {busy === `DEF_${a._id}` ? "Saving..." : "MAKE DEFAULT"}
          </span>
        ) : null}
      </div>
    </button>
  );
}
