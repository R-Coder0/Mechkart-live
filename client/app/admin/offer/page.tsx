/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import OfferForm from "@/components/admin/OfferForm";
import type { OfferDoc } from "@/types/offer";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export default function AdminOffersPage() {
  const [items, setItems] = useState<OfferDoc[]>([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [mode, setMode] = useState<string>("");
  const [scope, setScope] = useState<string>("");
  const [isActive, setIsActive] = useState<string>("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<OfferDoc | null>(null);

  const getToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("admin_token");
  };

  async function fetchOffers() {
    setLoading(true);
    try {
      const token = getToken();
      if (!token) {
        setItems([]);
        alert("Admin token not found. Please login again.");
        return;
      }

      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (mode) params.set("mode", mode);
      if (scope) params.set("scope", scope);
      if (isActive) params.set("isActive", isActive);

      const res = await fetch(`${API_BASE}/admin/discount/offers?${params.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        cache: "no-store",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load offers");

      setItems(data?.data || data?.items || []);
    } catch (err: any) {
      setItems([]);
      alert(err?.message || "Error loading offers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleOffer(id: string) {
    try {
      const token = getToken();
      if (!token) {
        alert("Admin token not found. Please login again.");
        return;
      }

      const res = await fetch(`${API_BASE}/admin/discount/offers/${id}/toggle`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Toggle failed");

      await fetchOffers();
    } catch (err: any) {
      alert(err?.message || "Toggle failed");
    }
  }

  const rows = useMemo(() => items || [], [items]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Offers</h1>
        <button
          className="px-4 py-2 rounded bg-black text-white"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          + Create Offer
        </button>
      </div>

      {showForm ? (
        <div className="mt-4">
          <OfferForm
            editing={editing}
            onSaved={() => {
              setShowForm(false);
              setEditing(null);
              fetchOffers();
            }}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
          />
        </div>
      ) : null}

      <div className="mt-4 border rounded-lg p-3 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            className="border rounded px-3 py-2"
            placeholder="Search by offer name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="border rounded px-3 py-2" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="">All Modes</option>
            <option value="AUTO">AUTO</option>
            <option value="COUPON">COUPON</option>
          </select>
          <select className="border rounded px-3 py-2" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="">All Scopes</option>
            <option value="SITE">SITE</option>
            <option value="CATEGORY">CATEGORY</option>
            <option value="SUBCATEGORY">SUBCATEGORY</option>
            <option value="PRODUCT">PRODUCT</option>
          </select>
          <select className="border rounded px-3 py-2" value={isActive} onChange={(e) => setIsActive(e.target.value)}>
            <option value="">All Status</option>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>

        <div className="flex gap-2 mt-3">
          <button className="px-4 py-2 rounded border" onClick={fetchOffers} disabled={loading}>
            {loading ? "Loading..." : "Apply Filters"}
          </button>
          <button
            className="px-4 py-2 rounded border"
            onClick={() => {
              setQ("");
              setMode("");
              setScope("");
              setIsActive("");
              setTimeout(fetchOffers, 0);
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-4 border rounded-lg overflow-auto bg-white">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Value</th>
              <th className="text-left p-2">Scope</th>
              <th className="text-left p-2">Mode</th>
              <th className="text-left p-2">Coupon</th>
              <th className="text-left p-2">Usage</th>
              <th className="text-left p-2">Validity</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o._id} className="border-t">
                <td className="p-2">
                  <div className="font-medium">{o.name}</div>
                  {o.description ? <div className="text-xs text-gray-500">{o.description}</div> : null}
                </td>
                <td className="p-2">{o.type}</td>
                <td className="p-2">
                  {o.type === "FLAT" ? `₹${o.value}` : `${o.value}%`}
                  {o.maxDiscountAmount ? <div className="text-xs text-gray-500">Cap: ₹{o.maxDiscountAmount}</div> : null}
                </td>
                <td className="p-2">{o.scope}</td>
                <td className="p-2">{o.mode}</td>
                <td className="p-2">{o.mode === "COUPON" ? (o.couponCode || "—") : "—"}</td>
                <td className="p-2">
                  <div className="text-xs">
                    Used: {o.globalUsedCount}
                    {o.globalUsageLimit ? ` / ${o.globalUsageLimit}` : ""}
                  </div>
                  <div className="text-xs text-gray-500">
                    Per user: {o.perUserLimit ? o.perUserLimit : "—"} | First order: {o.firstOrderOnly ? "Yes" : "No"}
                  </div>
                </td>
                <td className="p-2">
                  <div className="text-xs">Start: {new Date(o.startsAt).toLocaleString()}</div>
                  <div className="text-xs">End: {new Date(o.endsAt).toLocaleString()}</div>
                </td>
                <td className="p-2">
                  <span className={o.isActive ? "text-green-700" : "text-red-700"}>
                    {o.isActive ? "Enabled" : "Disabled"}
                  </span>
                </td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1 rounded border"
                      onClick={() => {
                        setEditing(o);
                        setShowForm(true);
                      }}
                    >
                      Edit
                    </button>
                    <button className="px-3 py-1 rounded border" onClick={() => toggleOffer(o._id)}>
                      {o.isActive ? "Disable" : "Enable"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!rows.length && !loading ? (
              <tr>
                <td className="p-4 text-gray-600" colSpan={10}>
                  No offers found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
