 
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type VendorProfile = { name?: string; email?: string };

function getVendorProfile(): VendorProfile | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("vendor_token");
  const profile = localStorage.getItem("vendor_profile");
  if (!token || !profile) return null;
  try {
    return JSON.parse(profile);
  } catch {
    return null;
  }
}

function NavItem({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition
        ${active ? "bg-[#3b2cc4]/10 text-[#3b2cc4]" : "text-gray-700 hover:bg-gray-50"}
      `}
    >
      <span className="h-2 w-2 rounded-full bg-current opacity-60" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export default function VendorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [vendor, setVendor] = useState<VendorProfile | null>(null);

  useEffect(() => {
    const load = () => setVendor(getVendorProfile());
    load();

    // listen login/logout change event
    window.addEventListener("vendor-auth-change", load);
    return () => window.removeEventListener("vendor-auth-change", load);
  }, []);

  // basic protection
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("vendor_token") : "";
    if (!token) router.replace("/supplier/login");
  }, [router]);

  const menu = useMemo(
    () => [
      { label: "Dashboard", href: "/supplier/dashboard" },
      { label: "Products", href: "/supplier/dashboard/products-add" },
      { label: "Orders", href: "/supplier/dashboard/orders" },
      { label: "Shipments", href: "/supplier/dashboard/shipments" },
      { label: "Returns", href: "/supplier/dashboard/returns" },
      { label: "Payouts", href: "/supplier/dashboard/payouts" },
      { label: "Settings", href: "/supplier/dashboard/settings" },
    ],
    []
  );

  const logout = () => {
    localStorage.removeItem("vendor_token");
    localStorage.removeItem("vendor_profile");
    window.dispatchEvent(new Event("vendor-auth-change"));
    router.replace("/supplier/login");
  };

  const vendorName = vendor?.name || "Vendor";

  return (
    <div className="max-w-[1400px] mx-auto min-h-[calc(100vh)] bg-gray-50">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden md:flex w-[260px] shrink-0 flex-col border-r bg-white">
          <div className="h-16 px-4 flex items-center justify-between border-b">
            <div className="font-semibold text-gray-900 truncate">
              {vendorName}
            </div>
          </div>

          <div className="p-3 flex-1">
            <div className="text-xs font-semibold text-gray-500 px-2 mb-2">
              MENU
            </div>
            <div className="space-y-1">
              {menu.map((m) => {
                const active =
                  pathname === m.href || pathname?.startsWith(m.href + "/");
                return (
                  <NavItem
                    key={m.href}
                    href={m.href}
                    label={m.label}
                    active={active}
                  />
                );
              })}
            </div>
          </div>

          <div className="p-3 border-t">
            <button
              onClick={logout}
              className="w-full px-3 py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 border border-red-200"
            >
              Logout
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Topbar */}

          {/* Content */}
          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
