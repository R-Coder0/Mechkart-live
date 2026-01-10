/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { meUser, updateMeUser } from "@/lib/userApi";

type Profile = {
  name: string;
  email: string;
  phone: string;
};

export default function WebsiteUserProfilePage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile>({ name: "", email: "", phone: "" });

  const [editName, setEditName] = useState(false);
  const [editEmail, setEditEmail] = useState(false);
  const [editPhone, setEditPhone] = useState(false);

  const [nameVal, setNameVal] = useState("");
  const [emailVal, setEmailVal] = useState("");
  const [phoneVal, setPhoneVal] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const u = await meUser();
      if (!u) throw new Error("Not logged in");

      const next: Profile = {
        name: String(u.name || ""),
        email: String(u.email || ""),
        phone: String(u.phone || ""),
      };

      setProfile(next);
      setNameVal(next.name);
      setEmailVal(next.email);
      setPhoneVal(next.phone);
    } catch (e: any) {
      setError(e?.message || "Profile load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (payload: Partial<Profile>, mode: "name" | "email" | "phone") => {
    try {
      setBusy(mode);
      setError(null);

      const u = await updateMeUser(payload);
      if (!u) throw new Error("Update failed");

      const next: Profile = {
        name: String(u.name || ""),
        email: String(u.email || ""),
        phone: String(u.phone || ""),
      };

      setProfile(next);
      setNameVal(next.name);
      setEmailVal(next.email);
      setPhoneVal(next.phone);

      if (mode === "name") setEditName(false);
      if (mode === "email") setEditEmail(false);
      if (mode === "phone") setEditPhone(false);
    } catch (e: any) {
      setError(e?.message || "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const onDeleteAccount = async () => {
    alert("Delete account flow later add karenge (confirmation required).");
  };

  if (loading) {
    return (
      <div className=" border bg-white p-6">
        <div className="h-6 w-64  bg-gray-200 animate-pulse" />
        <div className="mt-6 h-40  bg-gray-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className=" border bg-white">
      <div className="border-b p-6">
        <div className="text-xl font-bold text-gray-900">Profile Information</div>

        {error ? (
          <div className="mt-3 -xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
      </div>

      <div className="p-6 space-y-10">
        {/* Personal Info */}
        <div>
          <div className="flex items-center gap-3">
            <div className="text-base font-bold text-gray-900">Personal Information</div>
            <button
              type="button"
              className="text-sm font-semibold text-blue-600 hover:underline cursor-pointer"
              onClick={() => {
                setEditName((v) => !v);
                setNameVal(profile.name);
              }}
            >
              {editName ? "Cancel" : "Edit"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              className={`h-11  border px-4 text-sm outline-none ${editName ? "bg-white" : "bg-gray-50"}`}
              disabled={!editName}
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              placeholder="Name"
            />

            {editName ? (
              <button
                type="button"
                disabled={busy === "name"}
                onClick={() => update({ name: nameVal }, "name")}
                className="h-11  bg-gray-900 px-5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy === "name" ? "Saving..." : "Save"}
              </button>
            ) : null}
          </div>
        </div>

        {/* Email */}
        <div>
          <div className="flex items-center gap-3">
            <div className="text-base font-bold text-gray-900">Email Address</div>
            <button
              type="button"
              className="text-sm font-semibold text-blue-600 hover:underline"
              onClick={() => {
                setEditEmail((v) => !v);
                setEmailVal(profile.email);
              }}
            >
              {editEmail ? "Cancel" : "Edit"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              className={`h-11  border px-4 text-sm outline-none ${editEmail ? "bg-white" : "bg-gray-50"}`}
              disabled={!editEmail}
              value={emailVal}
              onChange={(e) => setEmailVal(e.target.value)}
              placeholder="Email"
            />

            {editEmail ? (
              <button
                type="button"
                disabled={busy === "email"}
                onClick={() => update({ email: emailVal }, "email")}
                className="h-11  bg-gray-900 px-5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy === "email" ? "Saving..." : "Save"}
              </button>
            ) : null}
          </div>
        </div>

        {/* Mobile */}
        <div>
          <div className="flex items-center gap-3">
            <div className="text-base font-bold text-gray-900">Mobile Number</div>
            <button
              type="button"
              className="text-sm font-semibold text-blue-600 hover:underline"
              onClick={() => {
                setEditPhone((v) => !v);
                setPhoneVal(profile.phone);
              }}
            >
              {editPhone ? "Cancel" : "Edit"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              className={`h-11  border px-4 text-sm outline-none ${editPhone ? "bg-white" : "bg-gray-50"}`}
              disabled={!editPhone}
              value={phoneVal}
              onChange={(e) => setPhoneVal(e.target.value)}
              placeholder="Mobile"
            />

            {editPhone ? (
              <button
                type="button"
                disabled={busy === "phone"}
                onClick={() => update({ phone: phoneVal }, "phone")}
                className="h-11  bg-gray-900 px-5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy === "phone" ? "Saving..." : "Save"}
              </button>
            ) : null}
          </div>
        </div>

        {/* FAQs */}
        <div>
          <div className="text-base font-bold text-gray-900">FAQs</div>
          <div className="mt-4 space-y-5 text-sm text-gray-700">
            <div>
              <div className="font-semibold text-gray-900">
                What happens when I update my email address (or mobile number)?
              </div>
              <div className="mt-2 text-gray-600 leading-6">
                Your login email id (or mobile number) changes. You&apos;ll receive all account related
                communication on your updated email address (or mobile number).
              </div>
            </div>

            <div>
              <div className="font-semibold text-gray-900">
                When will my account be updated with the new email address (or mobile number)?
              </div>
              <div className="mt-2 text-gray-600 leading-6">
                Your account details will be updated immediately after you save successfully.
              </div>
            </div>
          </div>
        </div>

        {/* Delete */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onDeleteAccount}
            className="-xl border border-red-300 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            Delete Account
          </button>
          <div className="mt-2 text-xs text-gray-500">Delete flow later add karenge with confirmation.</div>
        </div>
      </div>
    </div>
  );
}
