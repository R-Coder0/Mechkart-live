/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

type Banner = {
  key?: string;
  image?: string; // "/uploads/xxx.webp"
  ctaUrl?: string; // "/website/products" or full
  isActive?: boolean;
};

const resolveImageUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const apiBase = API_BASE || "";
  const host = apiBase.replace(/\/api\/?$/, "");
  if (path.startsWith("/")) return `${host}${path}`;
  return `${host}/${path}`;
};

export default function HeroSection() {
  const [banner, setBanner] = useState<Banner | null>(null);

  // ✅ UPDATED: new common route supports key param
  // Backend: GET /api/common/banners/:key
  const endpoint = useMemo(() => `${API_BASE}/common/home-hero`, []);

  useEffect(() => {
    const run = async () => {
      try {
        if (!API_BASE) return;

        const res = await fetch(endpoint, { cache: "no-store" });
        const data = await res.json();

        const b: Banner | null = data?.banner || null;

        // only accept active banners
        if (b?.isActive === false) {
          setBanner(null);
          return;
        }
        setBanner(b);
      } catch {
        setBanner(null);
      }
    };

    run();
  }, [endpoint]);

  // ✅ fallback (keeps UI same if no banner set)
  const bgSrc = banner?.image ? resolveImageUrl(banner.image) : "/hero.webp";
  const ctaHref = banner?.ctaUrl?.trim()
    ? banner.ctaUrl.trim()
    : "/products";

  return (
    <section className="relative w-full overflow-hidden Z-0">
      {/* Background banner image */}
      <div className="relative h-[150px] md:h-[470px] w-full z-0">
        {/* ✅ IMPORTANT: keep layout correct by adding w-full h-full */}
        <img
          src={bgSrc}
          alt="Shopping Banner"
          className="w-full h-full object-cover object-center opacity-95"
        />
      </div>

      {/* Text + CTA */}
      <div className="absolute inset-0 flex items-center justify-end max-w-[1700px] mx-auto px-4 md:px-8">
        <div className="text-right text-white space-y-1 md:space-y-4 max-w-[400px]">
          <h2 className="text-[11px] md:text-[36px] font-extrabold leading-tight drop-shadow-lg">
            Smart Shopping <br /> Trusted by Millions
          </h2>

          <Link
            href={ctaHref}
            className="inline-block bg-white text-[#82008F] font-semibold text-[8px] md:text-[16px] px-4 md:px-8 py-1 md:py-3 rounded-md shadow hover:bg-[#f6e9fa] transition"
          >
            Shop Now
          </Link>
        </div>
      </div>
    </section>
  );
}
