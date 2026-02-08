"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  PackagePlus,
  Boxes,
  ShoppingCart,
  Truck,
  RotateCcw,
  Wallet,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";

type VendorProfile = { name?: string; email?: string };

// ---- JWT expiry helpers (assumes vendor_token is JWT) ----
function getJwtExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(payload));
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

function isJwtExpired(token: string, skewSeconds = 10): boolean {
  const exp = getJwtExp(token);
  if (!exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return now >= exp - skewSeconds;
}

function safeJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getVendorSession(): { token: string; profile: VendorProfile } | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("vendor_token");
  const profile = safeJSON<VendorProfile>(localStorage.getItem("vendor_profile"));
  if (!token || !profile) return null;
  return { token, profile };
}

// ✅ Active rule:
// - Dashboard: exact match only
// - Others: exact OR prefix match
function isRouteActive(pathname: string, href: string) {
  if (!pathname) return false;
  if (href === "/supplier/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={[
        "group flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition",
        "border border-transparent",
        active
          ? "bg-[#3b2cc4]/10 text-[#3b2cc4] border-[#3b2cc4]/20"
          : "text-gray-700 hover:bg-gray-50 hover:border-gray-200",
      ].join(" ")}
    >
      <span
        className={[
          "h-9 w-9 rounded-lg flex items-center justify-center transition",
          active ? "bg-white shadow-sm" : "bg-gray-50 group-hover:bg-white",
        ].join(" ")}
      >
        <Icon className={active ? "h-5 w-5" : "h-5 w-5 text-gray-600"} />
      </span>

      <span className="truncate flex-1">{label}</span>

      {/* active indicator */}
      <span
        className={[
          "h-6 w-1 rounded-full transition",
          active ? "bg-[#3b2cc4]" : "bg-transparent group-hover:bg-gray-200",
        ].join(" ")}
      />
    </Link>
  );
}

export default function VendorDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();

  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const menu = useMemo(
    () => [
      { label: "Dashboard", href: "/supplier/dashboard", icon: LayoutDashboard },
      { label: "Products", href: "/supplier/dashboard/products-add", icon: PackagePlus },
      { label: "Inventory", href: "/supplier/dashboard/products", icon: Boxes },
      { label: "Orders", href: "/supplier/dashboard/orders", icon: ShoppingCart },
      { label: "Shipments", href: "/supplier/dashboard/shipments", icon: Truck },
      { label: "Returns", href: "/supplier/dashboard/returns", icon: RotateCcw },
      { label: "Payouts", href: "/supplier/dashboard/wallet", icon: Wallet },
      { label: "Settings", href: "/supplier/dashboard/settings", icon: Settings },
    ],
    []
  );

  const clearSession = () => {
    localStorage.removeItem("vendor_token");
    localStorage.removeItem("vendor_profile");
    window.dispatchEvent(new Event("vendor-auth-change"));
  };

  const logout = () => {
    clearSession();
    setVendor(null);
    setMobileOpen(false);
    router.replace("/supplier/login");
  };

  const loadAndGuard = () => {
    const session = getVendorSession();

    if (!session) {
      setVendor(null);
      router.replace("/supplier/login");
      return;
    }

    if (isJwtExpired(session.token)) {
      clearSession();
      setVendor(null);
      router.replace("/supplier/login");
      return;
    }

    setVendor(session.profile);
  };

  useEffect(() => {
    loadAndGuard();

    const onAuth = () => loadAndGuard();
    window.addEventListener("vendor-auth-change", onAuth);

    return () => window.removeEventListener("vendor-auth-change", onAuth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // route change => close drawer + re-guard
    setMobileOpen(false);
    loadAndGuard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // optional periodic check
  useEffect(() => {
    const id = window.setInterval(() => loadAndGuard(), 30000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vendorName = vendor?.name || "Vendor";
  const vendorEmail = vendor?.email || "";

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 truncate">{vendorName}</div>
          {vendorEmail ? (
            <div className="text-xs text-gray-500 truncate">{vendorEmail}</div>
          ) : null}
        </div>

        <button
          className="md:hidden p-2 rounded-lg hover:bg-gray-100"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Menu */}
      <div className="p-3 flex-1 overflow-auto">
        <div className="text-xs font-semibold text-gray-500 px-2 mb-2">MENU</div>
        <div className="space-y-2">
          {menu.map((m) => {
            const active = isRouteActive(pathname, m.href);
            return (
              <NavItem
                key={m.href}
                href={m.href}
                label={m.label}
                icon={m.icon}
                active={active}
                onClick={onNavigate}
              />
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 border border-red-200"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto min-h-screen bg-gray-50">
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-[280px] shrink-0 flex-col border-r bg-white">
          <Sidebar />
        </aside>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="fixed z-50 inset-y-0 left-0 w-[300px] bg-white border-r shadow-xl md:hidden">
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </aside>
          </>
        )}

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Topbar (mobile) */}
          <div className="sticky top-0 z-30 h-16 bg-white border-b flex items-center justify-between px-3 md:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="h-10 w-10 grid place-items-center rounded-xl hover:bg-gray-100"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 text-center px-2">
              <div className="font-semibold text-gray-900 truncate">{vendorName}</div>
              {vendorEmail ? <div className="text-xs text-gray-500 truncate">{vendorEmail}</div> : null}
            </div>

            <button
              onClick={logout}
              className="h-10 px-3 rounded-xl text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>

          {/* Content */}
          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
