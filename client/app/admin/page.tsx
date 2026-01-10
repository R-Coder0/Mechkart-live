"use client";

import { useEffect } from "react";

export default function AdminIndexPage() {
  useEffect(() => {
    const token = localStorage.getItem("admin_token");

    // ✅ logged in → dashboard
    if (token) {
      window.location.replace("/admin/dashboard");
      return;
    }

    // ❌ not logged in → login
    window.location.replace("/admin/login");
  }, []);

  return null;
}
