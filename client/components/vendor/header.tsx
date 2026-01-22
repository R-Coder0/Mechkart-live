/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { label: string; href: string };

const NAV: NavItem[] = [
  { label: "Sell Online", href: "/supplier/sell-online" },
  { label: "How it works", href: "/supplier/how-it-works" },
  { label: "Pricing & Commission", href: "/supplier/pricing" },
  { label: "Shipping & Returns", href: "/supplier/shipping-returns" },
  { label: "Grow Business", href: "/supplier/grow" },
  { label: "Don’t have GST?", href: "/supplier/no-gst" },
];

export default function SupplierHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e7e7ef]">
      <div className="mx-auto max-w-[1400px] px-4">
        <div className="h-[72px] flex items-center justify-between gap-6">
          {/* Left: Logo */}
          <Link href="/supplier" className="shrink-0 flex items-center">
            {/* Replace with your supplier logo (or same brand) */}
            <img
              src="/MECHKART.png"
              alt="Mechkart Supplier"
              className="h-12 w-auto"
            />
          </Link>

          {/* Center: Nav (desktop) */}
          <nav className="hidden lg:flex items-center gap-7 text-[14px] font-medium text-gray-800">
            {NAV.map((it) => {
              const active =
                pathname === it.href || pathname?.startsWith(it.href + "/");
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`whitespace-nowrap hover:text-[#82008F] ${
                    active ? "text-[#82008F] font-semibold" : ""
                  }`}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>

          {/* Right: Actions */}
          <div className="shrink-0 flex items-center gap-3">
            <Link
              href="/supplier/login"
              className="h-10 px-5 rounded-lg border border-[#3b2cc4] text-[#3b2cc4] text-[14px] font-semibold inline-flex items-center justify-center hover:bg-[#3b2cc4]/5 transition"
            >
              Login
            </Link>

            <Link
              href="/supplier/register"
              className="h-10 px-5 rounded-lg bg-[#3b2cc4] text-white text-[14px] font-semibold inline-flex items-center justify-center hover:opacity-95 transition"
            >
              Start Selling
            </Link>
          </div>
        </div>

        {/* Mobile nav (optional simple dropdown) */}
        <div className="lg:hidden pb-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {NAV.map((it) => {
              const active =
                pathname === it.href || pathname?.startsWith(it.href + "/");
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`shrink-0 px-3 py-2 rounded-full text-[12px] border ${
                    active
                      ? "border-[#82008F] text-[#82008F] bg-[#82008F]/5 font-semibold"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {it.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
