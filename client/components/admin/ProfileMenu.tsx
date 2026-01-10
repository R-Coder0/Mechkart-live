/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef, useEffect } from "react";

export default function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<any>(null);

  useEffect(() => {
    function handleClick(e: any) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div
        className="w-10 h-10 rounded-full bg-gray-300 cursor-pointer"
        onClick={() => setOpen(!open)}
      ></div>

      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-white shadow-lg border rounded-md py-2">
          <p className="px-4 py-2 text-gray-700 text-sm cursor-pointer hover:bg-gray-100">
            Profile
          </p>
          <p
            className="px-4 py-2 text-red-600 text-sm cursor-pointer hover:bg-gray-100"
            onClick={() => {
              localStorage.removeItem("admin_token");
              window.location.href = "/admin/login";
            }}
          >
            Logout
          </p>
        </div>
      )}
    </div>
  );
}
