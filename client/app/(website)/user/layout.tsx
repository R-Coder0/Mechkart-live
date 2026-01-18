/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

function pickUser(json: any) {
  // backend can return: {data:{user}}, {user}, {data}, direct user
  return json?.data?.user ?? json?.user ?? json?.data ?? json ?? {};
}

export default function WebsiteUserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const [name, setName] = useState(""); // default blank
  const [avatar, setAvatar] = useState<string | null>(null); // ✅ avatar url

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/users/auth/me`, {
          credentials: "include",
          cache: "no-store",
        });

        const json = await res.json().catch(() => ({}));

        if (res.ok) {
          const u = pickUser(json);

          setName(String(u?.name || ""));

          // ✅ Try common keys: avatar/profileImage/image/photo
          const avatarUrl =
            u?.avatar || u?.profileImage || u?.image || u?.photo || null;

          setAvatar(avatarUrl ? String(avatarUrl) : null);
        }
      } catch {
        // silent
      }
    })();
  }, []);

  const isActive = (href: string) => {
    if (href === "/user") return pathname === "/user";
    return pathname.startsWith(href);
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT SIDEBAR */}
        <aside className="lg:col-span-3">
          <div className="border bg-white overflow-hidden">
            {/* Top profile box */}
            <div className="flex items-center gap-4 p-5 border-b">
              {/* ✅ Avatar Image with fallback */}
              <div className="h-12 w-12 shrink-0 relative">
{/* Avatar (always show default svg) */}
<div className="h-12 w-12 shrink-0 relative">
  <img
    src="/avatar.svg"
    alt="User Avatar"
    className="h-12 w-12 rounded-full object-cover border hover:ring-2 hover:ring-gray-300 transition"
  />
</div>

              </div>

              <div className="min-w-0">
                <div className="text-xs text-gray-500">Hello,</div>

                {/* ✅ User name */}
                <div className="text-sm font-bold text-gray-900 truncate">
                  {name || "User"}
                </div>
              </div>
            </div>

            <div className="p-2">
              {/* MY ORDERS */}
              <div className="px-3 pt-2 pb-1 text-xs font-bold text-gray-500">
                MY ORDERS
              </div>
              <Link
                href="/user/orders"
                className={`block px-4 py-3 text-sm font-semibold transition ${
                  isActive("/user/orders")
                    ? "bg-gray-900 text-white"
                    : "text-gray-800 hover:bg-gray-50"
                }`}
              >
                Orders
              </Link>

              {/* ACCOUNT SETTINGS */}
              <div className="px-3 pt-4 pb-1 text-xs font-bold text-gray-500">
                ACCOUNT SETTINGS
              </div>

              <Link
                href="/user/dashboard"
                className={`block px-4 py-3 text-sm font-semibold transition ${
                  isActive("/user/dashboard")
                    ? "bg-gray-900 text-white"
                    : "text-gray-800 hover:bg-gray-50"
                }`}
              >
                Profile Information
              </Link>

              <Link
                href="/user/addresses"
                className={`block px-4 py-3 text-sm font-semibold transition ${
                  isActive("/user/addresses")
                    ? "bg-gray-900 text-white"
                    : "text-gray-800 hover:bg-gray-50"
                }`}
              >
                Manage Addresses
              </Link>
            </div>
          </div>
        </aside>

        {/* RIGHT CONTENT */}
        <main className="lg:col-span-9">{children}</main>
      </div>
    </div>
  );
}
