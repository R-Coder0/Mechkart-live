 
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export default function BrandCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  const brands = [
    { img: "/brands/nivea.png", name: "Nivea" },
    { img: "/brands/himalaya.png", name: "Himalaya" },
    { img: "/brands/mi.png", name: "Mi" },
    { img: "/brands/bata.png", name: "Bata" },
    { img: "/brands/wow.png", name: "WOW" },
    { img: "/brands/mamaearth.png", name: "Mamaearth" },
    { img: "/brands/wildstone.png", name: "Wild Stone" },
    { img: "/brands/pears.png", name: "Pears" },
    { img: "/brands/lakme.png", name: "Lakme" },
  ];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let x = 0;
    let rafId: number;

    const speed = 0.4; // 👈 adjust speed here

    const animate = () => {
      if (!paused) {
        x -= speed;

        const halfWidth = track.scrollWidth / 2;

        // ✅ seamless reset
        if (Math.abs(x) >= halfWidth) {
          x = 0;
        }

        track.style.transform = `translateX(${x}px)`;
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [paused]);

  return (
    <section className="w-full bg-[#E6F7FA] py-10 overflow-hidden">
      <div className="max-w-[1700px] mx-auto px-6">
        <h2 className="text-2xl font-bold text-[#003366] mb-6">
          Popular Brands on mechkart
        </h2>

        <div
          className="relative overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            ref={trackRef}
            className="flex gap-6 w-max will-change-transform"
          >
            {[...brands, ...brands].map((brand, idx) => (
              <div
                key={idx}
                className="flex-none w-[180px] h-[100px] bg-white rounded-xl flex items-center justify-center shadow-sm border border-[#ece4fa] hover:shadow-md transition-all"
              >
                <Image
                  src={brand.img}
                  alt={brand.name}
                  width={120}
                  height={80}
                  className="object-contain p-2"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
