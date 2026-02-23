/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export default function VendorResetPasswordPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const token = sp.get("token") || "";
  const email = sp.get("email") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const tokenOk = useMemo(() => token.length >= 10, [token]);

  useEffect(() => {
    // basic guard
    if (!tokenOk || !email) {
      setErr("Invalid reset link. Please request a new one.");
    }
  }, [tokenOk, email]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!token || !email) {
      setErr("Invalid reset link. Please request a new one.");
      return;
    }
    if (!newPassword || !confirmPassword) {
      setErr("Please fill both password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/vendors/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email: String(email).toLowerCase().trim(),
          newPassword,
          confirmPassword,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Reset failed");

      setMsg(json?.message || "Password reset successful. Redirecting to login...");

      // redirect to login
      setTimeout(() => router.push("/supplier/login"), 1200);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white border rounded p-6">
        <h1 className="text-xl font-semibold">Reset Vendor Password</h1>
        <p className="text-sm text-gray-600 mt-1">
          Set a new password for <span className="font-medium">{email || "your account"}</span>
        </p>

        {err && (
          <div className="mt-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
            {err}
          </div>
        )}

        {msg && (
          <div className="mt-4 p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded">
            {msg}
          </div>
        )}

        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
              placeholder="Enter new password"
              disabled={!tokenOk || !email}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
              placeholder="Confirm new password"
              disabled={!tokenOk || !email}
            />
          </div>

          <button
            disabled={loading || !tokenOk || !email}
            className="w-full py-2 rounded bg-black text-white text-sm disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>

        <div className="mt-4 text-sm text-center">
          Back to{" "}
          <Link href="/supplier/login" className="underline font-medium">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}