/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  type Address,
} from "@/lib/checkoutApi";
export const dynamic = "force-dynamic";
export default function WebsiteUserAddressesPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<any>({
    fullName: "",
    phone: "",
    pincode: "",
    state: "",
    city: "",
    addressLine1: "",
    addressLine2: "",
    landmark: "",
    addressType: "HOME",
    makeDefault: false,
  });

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await fetchAddresses();
      setAddresses(resp.addresses || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load addresses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setShowForm(true);
    setForm({
      fullName: "",
      phone: "",
      pincode: "",
      state: "",
      city: "",
      addressLine1: "",
      addressLine2: "",
      landmark: "",
      addressType: "HOME",
      makeDefault: false,
    });
  };

  const openEdit = (a: Address) => {
    setEditingId(a._id);
    setShowForm(true);
    setForm({
      fullName: a.fullName || "",
      phone: a.phone || "",
      pincode: a.pincode || "",
      state: a.state || "",
      city: a.city || "",
      addressLine1: a.addressLine1 || "",
      addressLine2: a.addressLine2 || "",
      landmark: a.landmark || "",
      addressType: (a as any)?.addressType || "HOME",
      makeDefault: !!a.isDefault,
    });
  };

  const onSave = async () => {
    try {
      setBusy("SAVE");
      setError(null);

      if (editingId) {
        const resp = await updateAddress(editingId, form);
        setAddresses(resp.addresses || []);
      } else {
        const resp = await addAddress(form);
        setAddresses(resp.addresses || []);
      }

      setShowForm(false);
      setEditingId(null);
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async (id: string) => {
    try {
      setBusy(`DEL_${id}`);
      setError(null);
      const resp = await deleteAddress(id);
      setAddresses(resp.addresses || []);
    } catch (e: any) {
      setError(e?.message || "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  const onDefault = async (id: string) => {
    try {
      setBusy(`DEF_${id}`);
      setError(null);
      const resp = await setDefaultAddress(id);
      setAddresses(resp.addresses || []);
    } catch (e: any) {
      setError(e?.message || "Set default failed");
    } finally {
      setBusy(null);
    }
  };

  const sorted = useMemo(() => {
    const list = [...(addresses || [])];
    list.sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault));
    return list;
  }, [addresses]);

  return (
    <div className=" border bg-white">
      <div className="border-b p-6">
        <div className="text-xl font-bold text-gray-900">Manage Addresses</div>

        {error ? (
          <div className="mt-3  border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
      </div>

      <div className="p-6">
        <button
          type="button"
          onClick={openAdd}
          className="w-full  border px-4 py-4 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50"
        >
          + ADD A NEW ADDRESS
        </button>

        {showForm ? (
          <div className="mt-6  border bg-gray-50 p-5">
            <div className="text-sm font-bold text-blue-700">
              {editingId ? "EDIT ADDRESS" : "ADD ADDRESS"}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                className="h-11 rounded border px-4 text-sm bg-white"
                placeholder="Name"
                value={form.fullName}
                onChange={(e) => setForm((p: any) => ({ ...p, fullName: e.target.value }))}
              />
              <input
                className="h-11 rounded border px-4 text-sm bg-white"
                placeholder="10-digit mobile number"
                value={form.phone}
                onChange={(e) => setForm((p: any) => ({ ...p, phone: e.target.value }))}
              />

              <input
                className="h-11 rounded border px-4 text-sm bg-white"
                placeholder="Pincode"
                value={form.pincode}
                onChange={(e) => setForm((p: any) => ({ ...p, pincode: e.target.value }))}
              />
              <input
                className="h-11 rounded border px-4 text-sm bg-white"
                placeholder="Locality / Address line 2"
                value={form.addressLine2}
                onChange={(e) => setForm((p: any) => ({ ...p, addressLine2: e.target.value }))}
              />

              <input
                className="h-11 rounded border px-4 text-sm bg-white sm:col-span-2"
                placeholder="Address (Area and Street)"
                value={form.addressLine1}
                onChange={(e) => setForm((p: any) => ({ ...p, addressLine1: e.target.value }))}
              />

              <input
                className="h-11 rounded border px-4 text-sm bg-white"
                placeholder="City/District/Town"
                value={form.city}
                onChange={(e) => setForm((p: any) => ({ ...p, city: e.target.value }))}
              />
              <input
                className="h-11 rounded border px-4 text-sm bg-white"
                placeholder="State"
                value={form.state}
                onChange={(e) => setForm((p: any) => ({ ...p, state: e.target.value }))}
              />

              <input
                className="h-11 rounded border px-4 text-sm bg-white"
                placeholder="Landmark (Optional)"
                value={form.landmark}
                onChange={(e) => setForm((p: any) => ({ ...p, landmark: e.target.value }))}
              />

              <input
                className="h-11 rounded border px-4 text-sm bg-white"
                placeholder="Alternate Phone (Optional)"
                value={(form as any).altPhone || ""}
                onChange={(e) => setForm((p: any) => ({ ...p, altPhone: e.target.value }))}
              />
            </div>

            <div className="mt-4">
              <div className="text-xs font-bold text-gray-700">Address Type</div>
              <div className="mt-2 flex gap-6 text-sm">
                {["HOME", "WORK"].map((t) => (
                  <label key={t} className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={String(form.addressType || "HOME") === t}
                      onChange={() => setForm((p: any) => ({ ...p, addressType: t }))}
                    />
                    {t === "HOME" ? "Home" : "Work"}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6 flex gap-4">
              <button
                type="button"
                onClick={onSave}
                disabled={busy === "SAVE"}
                className=" bg-blue-600 px-8 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy === "SAVE" ? "Saving..." : "SAVE"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className=" px-6 py-3 text-sm font-semibold text-blue-600 hover:underline"
              >
                CANCEL
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="h-28  bg-gray-100 animate-pulse" />
          ) : sorted.length ? (
            sorted.map((a: Address) => (
              <div key={a._id} className=" border p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-gray-500">
                        {(a as any)?.addressType || (a.isDefault ? "HOME" : "WORK")}
                      </span>
                      {a.isDefault ? (
                        <span className="text-[11px] font-bold text-emerald-700">DEFAULT</span>
                      ) : null}
                    </div>

                    <div className="mt-2 font-semibold text-gray-900">
                      {a.fullName}{" "}
                      <span className="ml-3 font-semibold text-gray-900">{a.phone}</span>
                    </div>

                    <div className="mt-2 text-sm text-gray-700">
                      {a.addressLine1}
                      {a.addressLine2 ? `, ${a.addressLine2}` : ""}
                      {a.landmark ? `, ${a.landmark}` : ""},{" "}
                      {a.city}, {a.state} - {a.pincode}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {!a.isDefault ? (
                      <button
                        type="button"
                        onClick={() => onDefault(a._id)}
                        disabled={busy === `DEF_${a._id}`}
                        className=" border px-3 py-2 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60"
                      >
                        {busy === `DEF_${a._id}` ? "Saving..." : "MAKE DEFAULT"}
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      className=" border px-3 py-2 text-xs font-semibold hover:bg-gray-50"
                    >
                      EDIT
                    </button>

                    <button
                      type="button"
                      onClick={() => onDelete(a._id)}
                      disabled={busy === `DEL_${a._id}`}
                      className=" border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      {busy === `DEL_${a._id}` ? "Removing..." : "DELETE"}
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="mt-4 text-sm text-gray-600">No addresses found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
