/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { OfferDoc, OfferPayload, OfferMode, OfferScope, OfferType } from "@/types/offer";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

type CategoryOption = { _id: string; name: string; slug: string };

function toLocalInputValue(d: Date) {
  // converts Date to "YYYY-MM-DDTHH:mm" for datetime-local
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeDateValue(v: string) {
  // allow passing ISO from server into input
  if (!v) return "";
  const dt = new Date(v);
  if (isNaN(dt.getTime())) return v;
  return toLocalInputValue(dt);
}

export default function OfferForm({
  editing,
  onSaved,
  onCancel,
}: {
  editing?: OfferDoc | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!editing?._id;

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  

  const [form, setForm] = useState<OfferPayload>(() => ({
    name: editing?.name || "",
    description: editing?.description || "",

    type: (editing?.type as OfferType) || "PERCENT",
    value: editing?.value ?? 10,
    maxDiscountAmount: editing?.maxDiscountAmount ?? "",

    scope: (editing?.scope as OfferScope) || "SITE",
    categoryIds: editing?.categoryIds || [],
    subCategoryIds: editing?.subCategoryIds || [],
    productIds: editing?.productIds || [],

    mode: (editing?.mode as OfferMode) || "AUTO",
    couponCode: editing?.couponCode || "",
    autoGenerateCoupon: false,

    globalUsageLimit: editing?.globalUsageLimit ?? "",
    perUserLimit: editing?.perUserLimit ?? "",
    firstOrderOnly: editing?.firstOrderOnly ?? false,

    startsAt: normalizeDateValue(editing?.startsAt || toLocalInputValue(new Date())),
    endsAt: normalizeDateValue(
      editing?.endsAt || toLocalInputValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    ),

    isActive: editing?.isActive ?? true,
    priority: editing?.priority ?? 0,
    stackable: editing?.stackable ?? false,
  }));
const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
};
  // Load categories for dropdown (Category + Subcategory both live in same collection in your backend)
  useEffect(() => {
    (async () => {
      try {
        setLoadingCats(true);
      const token = getToken();
const res = await fetch(`${API_BASE}/admin/categories`, {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  },
  cache: "no-store",
});
        const data = await res.json();
        setCategories(data?.data || data?.items || []);
      } catch {
        setCategories([]);
      } finally {
        setLoadingCats(false);
      }
    })();
  }, []);

  // if editing changes (rare), sync once
  useEffect(() => {
    if (!editing?._id) return;
    setForm((prev) => ({
      ...prev,
      name: editing.name || "",
      description: editing.description || "",
      type: editing.type,
      value: editing.value,
      maxDiscountAmount: editing.maxDiscountAmount ?? "",
      scope: editing.scope,
      categoryIds: editing.categoryIds || [],
      subCategoryIds: editing.subCategoryIds || [],
      productIds: editing.productIds || [],
      mode: editing.mode,
      couponCode: editing.couponCode || "",
      globalUsageLimit: editing.globalUsageLimit ?? "",
      perUserLimit: editing.perUserLimit ?? "",
      firstOrderOnly: editing.firstOrderOnly ?? false,
      startsAt: normalizeDateValue(editing.startsAt),
      endsAt: normalizeDateValue(editing.endsAt),
      isActive: editing.isActive ?? true,
      priority: editing.priority ?? 0,
      stackable: editing.stackable ?? false,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?._id]);

  const showCategoryPick = form.scope === "CATEGORY";
  const showSubCategoryPick = form.scope === "SUBCATEGORY";
  const showProductPick = form.scope === "PRODUCT"; // for now: manual CSV input

  const isCoupon = form.mode === "COUPON";
  const isPercent = form.type === "PERCENT";

  const submitLabel = isEdit ? "Update Offer" : "Create Offer";

  const selectedTargetsLabel = useMemo(() => {
    if (form.scope === "SITE") return "Applies to entire website";
    if (form.scope === "CATEGORY") return `Categories selected: ${(form.categoryIds || []).length}`;
    if (form.scope === "SUBCATEGORY") return `Sub-categories selected: ${(form.subCategoryIds || []).length}`;
    return `Products selected: ${(form.productIds || []).length}`;
  }, [form]);

  const onChange = (k: keyof OfferPayload, v: any) => setForm((p) => ({ ...p, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // payload shaping
    const payload: any = {
      ...form,
      // ensure arrays only for relevant scope
      categoryIds: form.scope === "CATEGORY" ? form.categoryIds : [],
      subCategoryIds: form.scope === "SUBCATEGORY" ? form.subCategoryIds : [],
      productIds: form.scope === "PRODUCT" ? form.productIds : [],
    };

    // If AUTO, remove coupon fields
    if (payload.mode !== "COUPON") {
      delete payload.couponCode;
      delete payload.autoGenerateCoupon;
    }

    const url = isEdit ? `${API_BASE}/admin/discount/offers/${editing!._id}` : `${API_BASE}/admin/discount/offers`;
    const method = isEdit ? "PATCH" : "POST";
const token = getToken();
if (!token) {
  alert("Admin token not found. Please login again.");
  return;
}

const res = await fetch(url, {
  method,
  headers: {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  },
  body: JSON.stringify(payload),
});

    const data = await res.json();
    if (!res.ok) {
      alert(data?.message || "Offer save failed");
      return;
    }
    alert(isEdit ? "Offer updated" : "Offer created");
    onSaved();
  }

  return (
    <form onSubmit={onSubmit} className="border rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{isEdit ? "Edit Offer" : "Create Offer"}</h2>
        <button type="button" onClick={onCancel} className="text-sm underline">
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <div>
          <label className="text-sm font-medium">Offer Name</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium">Active</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={String(!!form.isActive)}
            onChange={(e) => onChange("isActive", e.target.value === "true")}
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-medium">Description (optional)</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.description || ""}
            onChange={(e) => onChange("description", e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Offer Type</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={form.type}
            onChange={(e) => onChange("type", e.target.value)}
          >
            <option value="PERCENT">Percentage</option>
            <option value="FLAT">Flat (₹)</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Discount Value</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="number"
            value={String(form.value)}
            onChange={(e) => onChange("value", e.target.value)}
            min={1}
            max={isPercent ? 100 : undefined}
            required
          />
          {isPercent ? <p className="text-xs text-gray-500 mt-1">1 to 100</p> : null}
        </div>

        {isPercent ? (
          <div>
            <label className="text-sm font-medium">Max Discount Amount (optional)</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="number"
              value={String(form.maxDiscountAmount ?? "")}
              onChange={(e) => onChange("maxDiscountAmount", e.target.value)}
              min={0}
              placeholder="e.g. 500"
            />
          </div>
        ) : (
          <div />
        )}

        <div>
          <label className="text-sm font-medium">Scope</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={form.scope}
            onChange={(e) => onChange("scope", e.target.value)}
          >
            <option value="SITE">Entire Website</option>
            <option value="CATEGORY">Specific Category</option>
            <option value="SUBCATEGORY">Specific Sub-Category</option>
            <option value="PRODUCT">Specific Product(s)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">{selectedTargetsLabel}</p>
        </div>

        <div>
          <label className="text-sm font-medium">Mode</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={form.mode}
            onChange={(e) => onChange("mode", e.target.value)}
          >
            <option value="AUTO">Direct Apply (Auto)</option>
            <option value="COUPON">Coupon Code Based</option>
          </select>
        </div>

        {isCoupon ? (
          <>
            <div>
              <label className="text-sm font-medium">Coupon Code</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={form.couponCode || ""}
                onChange={(e) => onChange("couponCode", e.target.value.toUpperCase())}
                placeholder="e.g. MECH-NEW10"
              />
              <div className="flex items-center gap-2 mt-2">
                <input
                  id="autoGen"
                  type="checkbox"
                  checked={!!form.autoGenerateCoupon}
                  onChange={(e) => onChange("autoGenerateCoupon", e.target.checked)}
                />
                <label htmlFor="autoGen" className="text-sm">
                  Auto-generate coupon code
                </label>
              </div>
            </div>
            <div />
          </>
        ) : null}

        {showCategoryPick ? (
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Select Category IDs</label>
            <div className="border rounded p-2 max-h-56 overflow-auto bg-gray-50">
              {loadingCats ? (
                <p className="text-sm text-gray-600">Loading categories…</p>
              ) : (
                categories.map((c) => {
                  const checked = (form.categoryIds || []).includes(c._id);
                  return (
                    <label key={c._id} className="flex items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(form.categoryIds || []);
                          if (e.target.checked) next.add(c._id);
                          else next.delete(c._id);
                          onChange("categoryIds", Array.from(next));
                        }}
                      />
                      <span>{c.name}</span>
                      <span className="text-gray-500">({c.slug})</span>
                    </label>
                  );
                })
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Your backend uses Category collection for both category and subCategory.</p>
          </div>
        ) : null}

        {showSubCategoryPick ? (
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Select Sub-Category IDs</label>
            <div className="border rounded p-2 max-h-56 overflow-auto bg-gray-50">
              {loadingCats ? (
                <p className="text-sm text-gray-600">Loading…</p>
              ) : (
                categories.map((c) => {
                  const checked = (form.subCategoryIds || []).includes(c._id);
                  return (
                    <label key={c._id} className="flex items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(form.subCategoryIds || []);
                          if (e.target.checked) next.add(c._id);
                          else next.delete(c._id);
                          onChange("subCategoryIds", Array.from(next));
                        }}
                      />
                      <span>{c.name}</span>
                      <span className="text-gray-500">({c.slug})</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        {showProductPick ? (
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Product IDs (comma separated)</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={(form.productIds || []).join(",")}
              onChange={(e) =>
                onChange(
                  "productIds",
                  e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean)
                )
              }
              placeholder="Paste Mongo product _id list"
            />
            <p className="text-xs text-gray-500 mt-1">
              We can enhance this later with product search dropdown. For now this is production-safe and quick.
            </p>
          </div>
        ) : null}

        <div>
          <label className="text-sm font-medium">Per User Limit (optional)</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="number"
            value={String(form.perUserLimit ?? "")}
            onChange={(e) => onChange("perUserLimit", e.target.value)}
            min={1}
            placeholder="1 for once per user"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Global Usage Limit (optional)</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="number"
            value={String(form.globalUsageLimit ?? "")}
            onChange={(e) => onChange("globalUsageLimit", e.target.value)}
            min={1}
            placeholder="e.g. 1000"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="firstOrderOnly"
            type="checkbox"
            checked={!!form.firstOrderOnly}
            onChange={(e) => onChange("firstOrderOnly", e.target.checked)}
          />
          <label htmlFor="firstOrderOnly" className="text-sm font-medium">
            First Order Only
          </label>
        </div>

        <div>
          <label className="text-sm font-medium">Priority (AUTO selection)</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="number"
            value={String(form.priority ?? 0)}
            onChange={(e) => onChange("priority", e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Start Date & Time</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => onChange("startsAt", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium">End Date & Time</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="datetime-local"
            value={form.endsAt}
            onChange={(e) => onChange("endsAt", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button className="px-4 py-2 rounded bg-black text-white" type="submit">
          {submitLabel}
        </button>
        <button className="px-4 py-2 rounded border" type="button" onClick={onCancel}>
          Close
        </button>
      </div>
    </form>
  );
}
