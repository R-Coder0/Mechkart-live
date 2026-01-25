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

// ==============================
// FRONTEND LOGIN SUCCESS BLOCK (UPDATED + CONSOLE)
// ==============================

// after: const json = await res.json();

console.log("LOGIN RESPONSE JSON:", json);
console.log("LOGIN RESPONSE vendor.companyName:", json?.vendor?.companyName);
console.log("LOGIN RESPONSE vendor.email:", json?.vendor?.email);

// ✅ optional: clear old profile (prevents stale "Vendor")
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
          <Link
            href="/vendor/register"
            className="font-medium underline"
          >
            Sign up as Vendor
          </Link>
        </div>
      </div>
    </div>
  );
}
