/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

type Banner = {
  key?: string;
  image?: string;   // "/uploads/..."
  ctaUrl?: string;  // "/website/..." or full URL
  isActive?: boolean;
};

const resolveImageUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const host = (API_BASE || "").replace(/\/api\/?$/, "");
  return path.startsWith("/") ? `${host}${path}` : `${host}/${path}`;
};

export default function HeroSectionBanner2() {
  const [banner, setBanner] = useState<Banner | null>(null);

  // ✅ Banner 2 key
  const endpoint = useMemo(
    () => `${API_BASE}/common/home-hero-secondary`,
    []
  );

  useEffect(() => {
    const run = async () => {
      try {
        if (!API_BASE) return;

        const res = await fetch(endpoint, { cache: "no-store" });
        const data = await res.json();

        const b: Banner | null = data?.banner || null;
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

  // ✅ fallback (so home page never looks empty)
  const bgSrc = banner?.image ? resolveImageUrl(banner.image) : "/hero.webp";
  const href = banner?.ctaUrl?.trim() ? banner.ctaUrl.trim() : "/website/products";

  return (
    <section className="relative w-full overflow-hidden Z-0">
      {/* ✅ Whole banner clickable (no button) */}
      <Link href={href} className="block w-full">
        <div className="relative h-[150px] md:h-[470px] w-full z-0">
          <img
            src={bgSrc}
            alt="Shopping Banner"
            className="w-full h-full object-cover object-center opacity-95"
          />
        </div>
      </Link>
    </section>
  );
}
