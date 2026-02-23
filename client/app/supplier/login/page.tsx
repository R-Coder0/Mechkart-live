/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export default function VendorLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ Forgot modal states
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotErr, setForgotErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/vendors/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message || "Login failed");
      }

      console.log("LOGIN RESPONSE JSON:", json);
      console.log("LOGIN RESPONSE vendor.companyName:", json?.vendor?.companyName);
      console.log("LOGIN RESPONSE vendor.email:", json?.vendor?.email);

      localStorage.removeItem("vendor_profile");

      localStorage.setItem("vendor_token", json.token);

      const companyName = json?.vendor?.companyName || "Vendor";
      const emailSaved = json?.vendor?.email || "";

      localStorage.setItem(
        "vendor_profile",
        JSON.stringify({ name: companyName, email: emailSaved })
      );

      console.log("SAVED vendor_profile:", localStorage.getItem("vendor_profile"));

      window.dispatchEvent(new Event("vendor-auth-change"));
      router.push("/supplier/dashboard");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Forgot password submit (modal)
  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErr("");
    setForgotMsg("");

    const em = String(forgotEmail).toLowerCase().trim();
    if (!em) {
      setForgotErr("Email is required");
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE}/vendors/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.message || "Failed to send reset link");
      }

      // ✅ Show success msg (even if backend uses generic message)
      setForgotMsg(json?.message || "Reset link sent to your email (if it exists).");
    } catch (err: any) {
      setForgotErr(err?.message || "Something went wrong");
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgot = () => {
    setForgotOpen(false);
    setForgotLoading(false);
    setForgotMsg("");
    setForgotErr("");
    // optional: keep email
    // setForgotEmail("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white border rounded p-6">
        <h1 className="text-xl font-semibold">Vendor Login</h1>
        <p className="text-sm text-gray-600 mt-1">
          Login to manage your products and orders
        </p>

        {error && (
          <div className="mt-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
              placeholder="vendor@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
              placeholder="********"
            />
          </div>

          {/* ✅ Forgot password trigger */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setForgotEmail(email || "");
                setForgotOpen(true);
                setForgotMsg("");
                setForgotErr("");
              }}
              className="text-sm underline text-gray-700"
            >
              Forgot password?
            </button>
          </div>

          <button
            disabled={loading}
            className="w-full py-2 rounded bg-black text-white text-sm disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* ✅ Signup CTA */}
        <div className="mt-4 text-sm text-center">
          Not registered yet?{" "}
          <Link href="/supplier/register" className="font-medium underline">
            Sign up as Vendor
          </Link>
        </div>
      </div>

      {/* ===========================
          ✅ Forgot Password Modal
         =========================== */}
      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
        >
          {/* overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeForgot}
          />

          {/* modal */}
          <div className="relative z-10 w-full max-w-md bg-white rounded border p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Reset Password</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Enter your vendor email to receive a reset link.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForgot}
                className="text-gray-600 hover:text-gray-900"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {forgotErr && (
              <div className="mt-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
                {forgotErr}
              </div>
            )}

            {forgotMsg && (
              <div className="mt-4 p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded">
                {forgotMsg}
              </div>
            )}

            <form onSubmit={submitForgot} className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="vendor@email.com"
                />
              </div>

              <button
                disabled={forgotLoading}
                className="w-full py-2 rounded bg-black text-white text-sm disabled:opacity-50"
              >
                {forgotLoading ? "Sending..." : "Send Reset Link"}
              </button>

              <button
                type="button"
                onClick={closeForgot}
                className="w-full py-2 rounded border text-sm"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}