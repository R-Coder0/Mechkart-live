/* eslint-disable @next/next/no-img-element */
"use client";
import { Button } from "@/components/ui/button";

export default function GoldSection() {
  const categories = [
    { name: "Lehengas", img: "/1744722796811.webp" },
    { name: "Menwear", img: "/1744635113661.webp" },
    { name: "Sarees", img: "/1744722796811.webp" },
    { name: "Jewellery", img: "/1744635189897.webp" },
  ];

  return (
    <section
      className="relative w-full bg-cover bg-center bg-no-repeat py-16"
      style={{ backgroundImage: "url('/goldbg.webp')" }}
    >

      <div className="relative max-w-[1700px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-10 px-6 text-white">
        {/* Left text block */}
        <div className="max-w-md">
          <Button
            className="mt-96 border border-[#FFD700] text-[#FFD700] hover:bg-[#FFD700] hover:text-[#2B1A10] rounded-lg px-8 py-3 text-lg font-semibold bg-transparent transition-all ml-20"
          >
            Shop Now
          </Button>
        </div>

        {/* Right side cards */}
        <div className="grid grid-cols-2 gap-6">
          {categories.map((cat, i) => (
            <div
              key={i}
              className="flex flex-col items-center p-4 hover:scale-105 transition-transform duration-300"
            >
              <div className="w-40 h-auto flex items-center justify-center overflow-hidden">
                <img
                  src={cat.img}
                  alt={cat.name}
                  className="object-contain"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
