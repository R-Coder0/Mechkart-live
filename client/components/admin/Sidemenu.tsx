"use client";

import { useState } from "react";
import {
  Home,
  Users,
  LogOut,
  Menu,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidemenu() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const mainItems = [
    { label: "Dashboard", icon: Home, href: "/admin/dashboard" },
    { label: "Users", icon: Users, href: "/admin/users" },
    { label: "Category", icon: Layers, href: "/admin/categories" },
    { label: "Banner", icon: Layers, href: "/admin/banner" },
    { label: "Order", icon: Layers, href: "/admin/order" },
    { label: "Offer", icon: Layers, href: "/admin/offer" },
    { label: "Add Product", icon: Layers, href: "/admin/products-add" },
    { label: "Inventory", icon: Layers, href: "/admin/products" },
  ];

  return (
    <aside
      className={`h-screen border-r bg-white shadow-sm transition-[width] duration-300 ease-in-out
      ${collapsed ? "w-20" : "w-60"}`}
    >
      <div className="flex h-full flex-col">
        {/* Brand + Toggle */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!collapsed ? (
            <h1 className="text-[17px] font-semibold tracking-tight">
              Country Home
            </h1>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
              CH
            </div>
          )}

          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
            aria-label="Toggle sidebar"
          >
            <Menu size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="mt-4 flex-1 space-y-1 px-2">
          {mainItems.map((item) => {
            const Icon = item.icon;

            // ✅ FIXED ACTIVE LOGIC (products & products-add conflict solved)
            const active =
              pathname === item.href ||
              (item.href !== "/admin/products" &&
                pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors
                ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon
                  size={20}
                  className={active ? "text-blue-600" : "text-gray-500"}
                />

                {!collapsed && (
                  <span className="ml-3 truncate">{item.label}</span>
                )}

                {collapsed && (
                  <span
                    className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap
                    rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg
                    transition-opacity duration-150 group-hover:opacity-100"
                  >
                    {item.label}
                  </span>
                )}

                {active && (
                  <span className="absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-blue-600" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="mt-auto border-t px-3 py-3">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                localStorage.removeItem("admin_token");
                window.location.href = "/admin/login";
              }
            }}
            className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <LogOut size={20} className="text-red-500" />
            {!collapsed && <span className="ml-3">Logout</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
