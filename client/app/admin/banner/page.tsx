/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

type BannerKey = "home-hero" | "home-hero-secondary";

type Banner = {
  _id?: string;
  key?: string;
  image?: string;
  ctaUrl?: string;
  isActive?: boolean;
  updatedAt?: string;
};


const resolveImageUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;

  const host = (API_BASE || "").replace(/\/api\/?$/, "");
  return path.startsWith("/") ? `${host}${path}` : `${host}/${path}`;
};

const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
};

export default function AdminHomeHeroBannerPage() {
  const [selectedKey, setSelectedKey] = useState<BannerKey>("home-hero");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [banner, setBanner] = useState<Banner | null>(null);
  const [ctaUrl, setCtaUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ✅ NEW ROUTES (param key)
  // GET  /api/common/banners/:key
  // POST /api/admin/banners/:key
  const publicGetEndpoint = useMemo(
    () => `${API_BASE}/common/${selectedKey}`,
    [selectedKey]
  );

  const adminUpsertEndpoint = useMemo(
    () => `${API_BASE}/admin/${selectedKey}`,
    [selectedKey]
  );

  // ---- LOAD CURRENT BANNER (whenever key changes) ----
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        setMessage(null);

        const res = await fetch(publicGetEndpoint, { cache: "no-store" });
        const data = await res.json();

        const b = data?.banner || null;

        setBanner(b);
        setCtaUrl(b?.ctaUrl || "/website/products");
        setIsActive(b?.isActive ?? true);
        setPreview(b?.image ? resolveImageUrl(b.image) : "");
        setImageFile(null);
      } catch {
        setError("Failed to load banner");
      } finally {
        setLoading(false);
      }
    };

    if (API_BASE) run();
  }, [publicGetEndpoint]);

  // ---- IMAGE PICK ----
  const onPickImage = (file?: File | null) => {
    setError(null);
    setMessage(null);

    if (!file) {
      setImageFile(null);
      setPreview(banner?.image ? resolveImageUrl(banner.image) : "");
      return;
    }
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  // ---- SUBMIT ----
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const token = getToken();
    if (!token) {
      setError("Admin token missing. Login again.");
      return;
    }

    if (!ctaUrl.trim()) {
      setError("CTA URL is required");
      return;
    }

    // first time create requires image
    if (!banner?.image && !imageFile) {
      setError("Banner image is required");
      return;
    }

    try {
      setSaving(true);

      const fd = new FormData();
      fd.append("ctaUrl", ctaUrl.trim());
      fd.append("isActive", String(isActive));
      if (imageFile) fd.append("image", imageFile);

      const res = await fetch(adminUpsertEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Save failed");

      setBanner(data.banner);
      setPreview(resolveImageUrl(data.banner.image));
      setImageFile(null);
      setMessage(
        selectedKey === "home-hero"
          ? "Banner 1 saved successfully"
          : "Banner 2 saved successfully"
      );
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="w-full px-6 py-8">
      <div className="max-w-[1100px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[22px] font-bold text-[#003366]">
            Hero Banners
          </h1>

          {/* ✅ Banner selector (logic-only UI add, simple) */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-slate-600">Select:</span>
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value as BannerKey)}
              className="border border-[#d6e5ea] rounded-md px-2 py-1 text-[13px] bg-white"
            >
              <option value="home-hero">Banner 1 (Home Hero)</option>
              <option value="home-hero-secondary">Banner 2 (Secondary Hero)</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PREVIEW */}
          <div className="border p-4 bg-white">
            <h2 className="text-sm font-semibold mb-2">Preview</h2>

            {preview ? (
              <img
                src={preview}
                className="w-full h-[220px] object-cover"
                alt="Banner"
              />
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
                No Image
              </div>
            )}

            <div className="mt-3 text-[12px] text-slate-600">
              <div>
                <span className="font-semibold">Key:</span> {selectedKey}
              </div>
              <div className="mt-1">
                <span className="font-semibold">Status:</span>{" "}
                {isActive ? "Active" : "Inactive"}
              </div>
            </div>
          </div>

          {/* FORM */}
          <form onSubmit={onSubmit} className="border p-4 bg-white space-y-4">
            <div>
              <label className="text-sm font-medium">Banner Images</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onPickImage(e.target.files?.[0])}
                className="block w-full text-sm"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                If you don’t upload a new image, existing image will stay.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">
                {selectedKey === "home-hero"
                  ? "Shop Now URL (Button)"
                  : "Click URL (Full Banner)"}
              </label>
              <input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                className="w-full border px-3 py-2 text-sm"
                placeholder="/website/products"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>

            <button
              type="submit"
              disabled={saving || loading}
              className="bg-[#003366] text-white px-5 py-2 text-sm disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Banner"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
