/* eslint-disable @typescript-eslint/no-explicit-any */
 
"use client";

import Sidemenu from "@/components/admin/Sidemenu";
import Topbar from "@/components/admin/Topbar";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function AdminLayout({ children }: any) {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const path = window.location.pathname;

    // ✅ Login page never needs auth check
    if (path === "/admin/login") {
      setChecking(false);
      return;
    }

    // ❌ No token → force login
    if (!token) {
      window.location.replace("/admin/login");
      return;
    }

    // ✅ Verify token ONCE with backend
    const verifyAdmin = async () => {
      try {
        const res = await fetch(`${API_URL}/admin/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          // token expired / invalid
          localStorage.removeItem("admin_token");
          window.location.replace("/admin/login");
          return;
        }

        // ✅ Token valid
        setAuthorized(true);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        localStorage.removeItem("admin_token");
        window.location.replace("/admin/login");
      } finally {
        setChecking(false);
      }
    };

    verifyAdmin();
  }, []);

  // ⏳ Avoid flicker
  if (checking) return null;

  const isLoginPage =
    typeof window !== "undefined" &&
    window.location.pathname === "/admin/login";

  return (
    <div className="flex h-screen bg-gray-50">
      {!isLoginPage && authorized && <Sidemenu />}

      <div className="flex flex-col flex-1">
        {!isLoginPage && authorized && <Topbar />}
        <main className="p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
