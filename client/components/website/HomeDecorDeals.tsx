/* eslint-disable @next/next/no-img-element */
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

export default function HomeDecorDeals() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (offset: number) => {
    if (scrollRef.current)
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  const products = [
    { name: "Wall Paintings", price: "From ₹499", img: "/decor/painting.png" },
    { name: "Indoor Plants", price: "From ₹299", img: "/decor/plant.png" },
    { name: "Wall Shelves", price: "From ₹799", img: "/decor/shelf.png" },
    { name: "Lamps & Lights", price: "From ₹999", img: "/decor/lamp.png" },
    { name: "Mirrors", price: "From ₹1,299", img: "/decor/mirror.png" },
    { name: "Cushions", price: "From ₹349", img: "/decor/cushion.png" },
    { name: "Vases", price: "From ₹699", img: "/decor/vase.png" },
    { name: "Rugs & Carpets", price: "From ₹1,499", img: "/decor/rug.png" },
  ];

  return (
    <section className="w-full bg-[#f5fafb] py-4">
      <div className="max-w-[1700px] mx-auto px-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-[#003366]">
            Home Decor Deals
          </h2>

          <div className="flex gap-2">
            <button
              onClick={() => scroll(-300)}
              className="p-2 rounded-full border border-[#d6e5ea] text-[#003366] bg-white hover:bg-[#e6f7fa] transition"
              aria-label="Scroll left"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => scroll(300)}
              className="p-2 rounded-full border border-[#d6e5ea] text-[#003366] bg-white hover:bg-[#e6f7fa] transition"
              aria-label="Scroll right"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable product row */}
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto scroll-smooth scrollbar-hide pb-2"
        >
          {products.map((p, i) => (
            <div
              key={i}
              className="flex-none w-[200px] bg-white shadow-sm hover:shadow-md transition-all duration-200 border border-[#e4eff2] text-center p-3"
            >
              <div className="relative w-full h-40 flex items-center justify-center mb-3">
                <img
                  src={p.img}
                  alt={p.name}
                  className="object-contain p-3"
                />
              </div>
              <p className="text-[15px] font-medium text-gray-800 mb-1">
                {p.name}
              </p>
              <p className="text-[14px] font-semibold text-[#003366]">
                {p.price}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
