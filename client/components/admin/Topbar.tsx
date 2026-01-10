"use client";

import ProfileMenu from "@/components/admin/ProfileMenu";

export default function Topbar() {
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white border-b shadow-sm">
      <h2 className="text-lg font-semibold">Dashboard</h2>
      <ProfileMenu />
    </header>
  );
}
