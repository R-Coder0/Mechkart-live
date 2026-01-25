/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { vendorMe, vendorUpdateMe,vendorChangePassword, type VendorUpdatePayload } from "@/lib/vendorApi";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

function resolveImageUrl(path?: string) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const host = API_BASE.replace(/\/api\/?$/, "");
  return `${host}${path.startsWith("/") ? path : `/${path}`}`;
}

function FieldRow({
  label,
  value,
}: {
  label: string;
  value: any;
}) {
  return (
    <div className="text-sm space-y-1">
      <div className="text-gray-600">{label}</div>
      <div className="font-medium wrap-break-word">{value || "—"}</div>
    </div>
  );
}

export default function VendorProfilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vendor, setVendor] = useState<any>(null);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
const [pw, setPw] = useState({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});
const [pwErr, setPwErr] = useState("");
const [pwOk, setPwOk] = useState("");
  // form state
  const [form, setForm] = useState<VendorUpdatePayload>({
    phone: "",
    companyName: "",
    companyEmail: "",
    gst: "",
    pickupName: "",
    pickupPhone: "",
    pickupAddress: "",
    pickupCity: "",
    pickupState: "",
    pickupPincode: "",
    upiId: "",
    bankAccount: "",
    ifsc: "",
  });

  async function loadProfile() {
    setLoading(true);
    setError("");
    try {
      const data = await vendorMe();
      setVendor(data);
    } catch (e: any) {
      setError(e.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  // prepare form from vendor
  const initialFormFromVendor = useMemo(() => {
    if (!vendor) return null;
    return {
      phone: vendor?.phone || "",
      companyName: vendor?.company?.name || "",
      companyEmail: vendor?.company?.email || "",
      gst: vendor?.company?.gst || "",

      pickupName: vendor?.pickupAddress?.name || "",
      pickupPhone: vendor?.pickupAddress?.phone || "",
      pickupAddress: vendor?.pickupAddress?.address || "",
      pickupCity: vendor?.pickupAddress?.city || "",
      pickupState: vendor?.pickupAddress?.state || "",
      pickupPincode: vendor?.pickupAddress?.pincode || "",

      upiId: vendor?.payment?.upiId || "",
      bankAccount: vendor?.payment?.bankAccount || "",
      ifsc: vendor?.payment?.ifsc || "",
    } as VendorUpdatePayload;
  }, [vendor]);

  function openEdit() {
    if (initialFormFromVendor) setForm(initialFormFromVendor);
    setSaveErr("");
    setEditOpen(true);
    setPw({ currentPassword: "", newPassword: "", confirmPassword: "" });
setPwErr("");
setPwOk("");
  }

  function closeEdit() {
    if (saving) return;
    setEditOpen(false);
    setSaveErr("");
  }

  function setVal<K extends keyof VendorUpdatePayload>(key: K, value: VendorUpdatePayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // remove empty keys so backend update is clean
  function compactPayload(p: VendorUpdatePayload) {
    const out: any = {};
    Object.entries(p).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (typeof v === "string" && v.trim() === "") return;
      out[k] = typeof v === "string" ? v.trim() : v;
    });
    return out as VendorUpdatePayload;
  }

  async function onSave() {
    setSaving(true);
    setSaveErr("");
    try {
      const payload = compactPayload(form);
      await vendorUpdateMe(payload);
      await loadProfile();
      setEditOpen(false);
      alert("Profile updated");
    } catch (e: any) {
      setSaveErr(e.message || "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">Loading profile...</div>;

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  if (!vendor) return <div className="p-6">No profile data</div>;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h1 className="text-2xl font-semibold">My Profile</h1>

        <button
          onClick={openEdit}
          className="px-4 py-2 rounded bg-black text-white text-sm"
        >
          Edit Profile
        </button>
      </div>

      {/* Company */}
      <section className="border rounded p-4 mb-4">
        <h2 className="font-semibold mb-2">Company Details</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <FieldRow label="Name" value={vendor.company?.name} />
          <FieldRow label="Email" value={vendor.company?.email} />
          <FieldRow label="GST" value={vendor.company?.gst} />
        </div>
      </section>

      {/* Contact */}
      <section className="border rounded p-4 mb-4">
        <h2 className="font-semibold mb-2">Contact</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <FieldRow label="Email" value={vendor.email} />
          <FieldRow label="Phone" value={vendor.phone} />
        </div>
      </section>

      {/* Pickup */}
      <section className="border rounded p-4 mb-4">
        <h2 className="font-semibold mb-2">Pickup Address</h2>
        <div className="text-sm space-y-1">
          <div className="font-medium">{vendor.pickupAddress?.address || "—"}</div>
          <div className="text-gray-700">
            {vendor.pickupAddress?.city || "—"}, {vendor.pickupAddress?.state || "—"} –{" "}
            {vendor.pickupAddress?.pincode || "—"}
          </div>
          <div>
            <b>Contact:</b> {vendor.pickupAddress?.phone || "—"}
          </div>
        </div>
      </section>

      {/* KYC */}
      <section className="border rounded p-4 mb-4">
        <h2 className="font-semibold mb-2">KYC</h2>
        <div className="text-sm space-y-2">
          <div>
            <b>PAN:</b> {vendor.kyc?.panNumber || "—"}
          </div>
          {vendor.kyc?.panImage ? (
            <img
              src={resolveImageUrl(vendor.kyc.panImage)}
              alt="PAN"
              className="h-32 border rounded"
            />
          ) : null}
        </div>
      </section>

      {/* Payment */}
      <section className="border rounded p-4">
        <h2 className="font-semibold mb-2">Payment</h2>
        <div className="text-sm space-y-2">
          <div>
            <b>UPI:</b> {vendor.payment?.upiId || "—"}
          </div>
          <div>
            <b>Account:</b> {vendor.payment?.bankAccount || "—"}
          </div>
          <div>
            <b>IFSC:</b> {vendor.payment?.ifsc || "—"}
          </div>

          {vendor.payment?.qrImage ? (
            <img
              src={resolveImageUrl(vendor.payment.qrImage)}
              alt="QR"
              className="h-32 border rounded"
            />
          ) : null}
        </div>
      </section>

      {/* ✅ Edit Modal */}
      {editOpen ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-3xl bg-white rounded p-4 md:p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Edit Profile</div>
                <div className="text-sm text-gray-600">
                  Company / Pickup / Payment details update
                </div>
              </div>
              <button onClick={closeEdit} className="px-3 py-2 rounded border">
                Close
              </button>
            </div>

            {saveErr ? (
              <div className="mt-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">
                {saveErr}
              </div>
            ) : null}

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {/* Contact */}
              <div className="border rounded p-4">
                <div className="font-semibold mb-3">Contact</div>
                <label className="text-sm block mb-1">Phone</label>
                <input
                  value={form.phone || ""}
                  onChange={(e) => setVal("phone", e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Phone"
                />
              </div>

              {/* Company */}
              <div className="border rounded p-4">
                <div className="font-semibold mb-3">Company</div>
                <label className="text-sm block mb-1">Company Name</label>
                <input
                  value={form.companyName || ""}
                  onChange={(e) => setVal("companyName", e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Company Name"
                />

                <label className="text-sm block mt-3 mb-1">Company Email</label>
                <input
                  value={form.companyEmail || ""}
                  onChange={(e) => setVal("companyEmail", e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="company@email.com"
                />

                <label className="text-sm block mt-3 mb-1">GST</label>
                <input
                  value={form.gst || ""}
                  onChange={(e) => setVal("gst", e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="GST (optional)"
                />
              </div>

              {/* Pickup */}
              <div className="border rounded p-4 md:col-span-2">
                <div className="font-semibold mb-3">Pickup Address</div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm block mb-1">Pickup Name</label>
                    <input
                      value={form.pickupName || ""}
                      onChange={(e) => setVal("pickupName", e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm block mb-1">Pickup Phone</label>
                    <input
                      value={form.pickupPhone || ""}
                      onChange={(e) => setVal("pickupPhone", e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm block mb-1">Address</label>
                    <input
                      value={form.pickupAddress || ""}
                      onChange={(e) => setVal("pickupAddress", e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm block mb-1">City</label>
                    <input
                      value={form.pickupCity || ""}
                      onChange={(e) => setVal("pickupCity", e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm block mb-1">State</label>
                    <input
                      value={form.pickupState || ""}
                      onChange={(e) => setVal("pickupState", e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm block mb-1">Pincode</label>
                    <input
                      value={form.pickupPincode || ""}
                      onChange={(e) => setVal("pickupPincode", e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Payment */}
              <div className="border rounded p-4 md:col-span-2">
                <div className="font-semibold mb-3">Payment</div>

                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm block mb-1">UPI ID</label>
                    <input
                      value={form.upiId || ""}
                      onChange={(e) => setVal("upiId", e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm block mb-1">Bank Account</label>
                    <input
                      value={form.bankAccount || ""}
                      onChange={(e) => setVal("bankAccount", e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm block mb-1">IFSC</label>
                    <input
                      value={form.ifsc || ""}
                      onChange={(e) => setVal("ifsc", e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
<div className="mt-6 border rounded p-4">
  <div className="font-semibold">Change Password</div>
  <p className="text-sm text-gray-600 mt-1">
    Enter current password and set a new one.
  </p>

  {pwErr ? (
    <div className="mt-3 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">
      {pwErr}
    </div>
  ) : null}

  {pwOk ? (
    <div className="mt-3 p-3 rounded border border-green-200 bg-green-50 text-sm text-green-700">
      {pwOk}
    </div>
  ) : null}

  <div className="mt-4 grid md:grid-cols-3 gap-3">
    <div>
      <label className="text-sm block mb-1">Current Password</label>
      <input
        type="password"
        value={pw.currentPassword}
        onChange={(e) => setPw((s) => ({ ...s, currentPassword: e.target.value }))}
        className="w-full border rounded px-3 py-2 text-sm"
        placeholder="********"
      />
    </div>

    <div>
      <label className="text-sm block mb-1">New Password</label>
      <input
        type="password"
        value={pw.newPassword}
        onChange={(e) => setPw((s) => ({ ...s, newPassword: e.target.value }))}
        className="w-full border rounded px-3 py-2 text-sm"
        placeholder="********"
      />
    </div>

    <div>
      <label className="text-sm block mb-1">Confirm New Password</label>
      <input
        type="password"
        value={pw.confirmPassword}
        onChange={(e) => setPw((s) => ({ ...s, confirmPassword: e.target.value }))}
        className="w-full border rounded px-3 py-2 text-sm"
        placeholder="********"
      />
    </div>
  </div>

  <div className="mt-4 flex justify-end">
    <button
      disabled={saving}
      onClick={async () => {
        setPwErr("");
        setPwOk("");
        try {
          if (!pw.currentPassword || !pw.newPassword || !pw.confirmPassword) {
            return setPwErr("All password fields are required");
          }
          if (pw.newPassword.length < 6) {
            return setPwErr("New password must be at least 6 characters");
          }
          if (pw.newPassword !== pw.confirmPassword) {
            return setPwErr("Passwords do not match");
          }

          await vendorChangePassword({
            currentPassword: pw.currentPassword,
            newPassword: pw.newPassword,
            confirmPassword: pw.confirmPassword,
          });

          setPwOk("Password updated successfully");
          setPw({ currentPassword: "", newPassword: "", confirmPassword: "" });
        } catch (e: any) {
          setPwErr(e.message || "Password update failed");
        }
      }}
      className="px-4 py-2 rounded bg-gray-900 text-white text-sm disabled:opacity-50"
    >
      Update Password
    </button>
  </div>
</div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={closeEdit} className="px-4 py-2 rounded border" disabled={saving}>
                Cancel
              </button>
              <button
                onClick={onSave}
                className="px-4 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
