 
/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

export default function SupplierHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load vendor from localStorage
useEffect(() => {
  const loadVendor = () => {
    const token = localStorage.getItem("vendor_token");
    const profile = localStorage.getItem("vendor_profile");

    if (token && profile) {
      try {
        setVendor(JSON.parse(profile));
      } catch {
        setVendor(null);
      }
    } else {
      setVendor(null);
    }
  };

  // initial load
  loadVendor();

  // listen login / logout
  window.addEventListener("vendor-auth-change", loadVendor);

  return () => {
    window.removeEventListener("vendor-auth-change", loadVendor);
  };
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
localStorage.removeItem("vendor_token");
localStorage.removeItem("vendor_profile");
setVendor(null);
router.push("/supplier/login");
  };

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
