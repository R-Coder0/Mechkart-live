"use client";

import Link from "next/link";

export default function TopContactBar() {
  return (
    <div className="w-full bg-[#1b1b1b] text-gray-200">
      <div className="mx-auto max-w-[1700px] px-4 sm:px-6 py-2">
        <div className="flex items-center justify-between gap-3 text-[12px] sm:text-[13px]">
          {/* Email */}
          <Link
            href="mailto:contact@Mechkart.co.in"
            className="truncate hover:text-white"
            title="contact@Mechkart.co.in"
          >
            contact@Mechkart.co.in
          </Link>

          {/* Phone */}
          <Link
            href="tel:+919879511957"
            className="shrink-0 hover:text-white"
            title="+91 98795 11957"
          >
            +91 98795 11957
          </Link>
        </div>
      </div>
    </div>
  );
}
