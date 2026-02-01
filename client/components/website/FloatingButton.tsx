/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";

export default function WhatsAppFloatingButton() {
  // ✅ Your WhatsApp number (no +, no spaces)
  const phone = "919879511957";
  const text = "Hi Mechkart, I need help with my order.";
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-5 right-5 z-9999 flex items-center gap-2 bg-transparent rounded-full px-4 py-3 text-white active:scale-95 transition"
    >
      <img src="/WhatsApp.webp" alt="WhatsApp" className="h-14 w-14" />
      {/* <span className="text-sm font-semibold hidden sm:block">WhatsApp</span> */}
    </Link>
  );
}
