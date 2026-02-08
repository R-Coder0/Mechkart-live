/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type NavItem = { label: string; href: string };

const NAV: NavItem[] = [
  { label: "Sell Online", href: "/supplier/sell-online" },
  { label: "How it works", href: "/supplier/how-it-works" },
  { label: "Pricing & Commission", href: "/supplier/pricing" },
  { label: "Shipping & Returns", href: "/supplier/shipping-returns" },
  { label: "Grow Business", href: "/supplier/grow" },
  { label: "Don’t have GST?", href: "/supplier/no-gst" },
];

type VendorProfile = {
  name?: string;
  email?: string;
};

function safeJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// Decode JWT payload and read exp (seconds)
function getJwtExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const json = JSON.parse(atob(payload));
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

function isJwtExpired(token: string, skewSeconds = 10): boolean {
  const exp = getJwtExp(token);
  if (!exp) return false; // exp missing => can't decide; treat as not expired (or change to true if you want strict)
  const now = Math.floor(Date.now() / 1000);
  return now >= exp - skewSeconds;
}

export default function SupplierHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const clearVendorSession = () => {
    localStorage.removeItem("vendor_token");
    localStorage.removeItem("vendor_profile");
    setVendor(null);
    setOpen(false);
    // broadcast so other components/pages update too
    window.dispatchEvent(new Event("vendor-auth-change"));
  };

  const loadVendor = () => {
    const token = localStorage.getItem("vendor_token");
    const profile = safeJSON<VendorProfile>(localStorage.getItem("vendor_profile"));

    // if missing session => logged out UI
    if (!token || !profile) {
      setVendor(null);
      return;
    }

    // JWT expiry check
    if (isJwtExpired(token)) {
      clearVendorSession();
      return;
    }

    // valid token (client-side) => show vendor
    setVendor(profile);
  };

  // Initial load + listen auth change + re-check when route changes
  useEffect(() => {
    loadVendor();

    const onAuthChange = () => loadVendor();
    window.addEventListener("vendor-auth-change", onAuthChange);

    return () => {
      window.removeEventListener("vendor-auth-change", onAuthChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // whenever vendor page changes, re-validate
    loadVendor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Optional: re-check every 30 seconds so UI flips even without navigation
  useEffect(() => {
    const id = window.setInterval(() => loadVendor(), 30000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const logout = () => {
    clearVendorSession();
    router.push("/supplier/login");
  };

  const isSupplierArea = useMemo(() => pathname?.startsWith("/supplier"), [pathname]);

  // Extra safety: if token expired and user is inside supplier area, push to login
  useEffect(() => {
    const token = localStorage.getItem("vendor_token");
    if (isSupplierArea && token && isJwtExpired(token)) {
      clearVendorSession();
      router.push("/supplier/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupplierArea, pathname]);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e7e7ef]">
      <div className="mx-auto max-w-[1400px] px-4">
        <div className="h-[72px] flex items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/supplier" className="flex items-center">
            <img src="/MECHKART.png" alt="Mechkart Supplier" className="h-12 w-auto" />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium">
            {NAV.map((it) => {
              const active = pathname === it.href || pathname?.startsWith(it.href + "/");
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`hover:text-[#82008F] ${
                    active ? "text-[#82008F] font-semibold" : ""
                  }`}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {!vendor ? (
              <>
                <Link
                  href="/supplier/login"
                  className="h-10 px-5 rounded-lg border border-[#3b2cc4] text-[#3b2cc4] text-sm font-semibold flex items-center"
                >
                  Login
                </Link>

                <Link
                  href="/supplier/register"
                  className="h-10 px-5 rounded-lg bg-[#3b2cc4] text-white text-sm font-semibold flex items-center"
                >
                  Start Selling
                </Link>
              </>
            ) : (
              <div className="relative" ref={dropdownRef}>
                {/* Avatar button */}
                <button
                  onClick={() => setOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50"
                >
                  <div className="h-8 w-8 rounded-full bg-[#3b2cc4] text-white flex items-center justify-center text-sm font-semibold">
                    {vendor.name?.[0]?.toUpperCase() || "V"}
                  </div>
                  <span className="max-w-[140px] truncate text-sm font-medium">
                    {vendor.name || "Vendor"}
                  </span>
                </button>

                {/* Dropdown */}
                {open && (
                  <div className="absolute right-0 mt-2 w-44 bg-white border rounded-lg shadow">
                    <Link
                      href="/supplier/dashboard"
                      className="block px-4 py-2 text-sm hover:bg-gray-50"
                      onClick={() => setOpen(false)}
                    >
                      Dashboard
                    </Link>

                    <button
                      onClick={logout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
