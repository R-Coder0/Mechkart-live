"use client";

import Image from "next/image";
import { ChevronRight } from "lucide-react";

type DealItem = { name: string; img: string; offer?: string; tag?: string };
type DealBoard = { title: string; products: DealItem[] };

const BOARDS: DealBoard[] = [
  {
    title: "Best Deals on Designer Furniture",
    products: [
      { name: "Shoe Rack", img: "/boards/shoerack.png", offer: "Min. 50% Off" },
      { name: "Collapsible Wardrobes", img: "/boards/wardrobe.png", offer: "Min. 50% Off" },
      { name: "Inflatable Sofas", img: "/boards/sofa.png", offer: "Min. 50% Off" },
      { name: "Home Temple", img: "/boards/temple.png", offer: "Min. 50% Off" },
    ],
  },
  {
    title: "Home Decor & Furnishing",
    products: [
      { name: "Blankets", img: "/boards/blanket.png", offer: "Min. 50% Off" },
      { name: "Wall Clocks", img: "/boards/clock.png", tag: "Top Sellers" },
      { name: "Bedsheets", img: "/boards/bedsheet.png", offer: "Min. 60% Off" },
      { name: "Cushion Covers", img: "/boards/cushion.png", offer: "Min. 50% Off" },
    ],
  },
  {
    title: "Fashion's Top Deals",
    products: [
      { name: "Men’s Sports Shoes", img: "/boards/sportshoe.png", offer: "Min. 70% Off" },
      { name: "Wrist Watches", img: "/boards/watch.png", offer: "Min. 90% Off" },
      { name: "Men’s Slippers & Flip Flops", img: "/boards/slippers.png", offer: "Min. 70% Off" },
      { name: "Laptop Bags", img: "/boards/bag.png", offer: "Min. 70% Off" },
    ],
  },
];

export default function DealsBoards() {
  return (
    <section className="w-full bg-[#E6F7FA] py-4">
      <div className="max-w-[1700px] mx-auto px-4">
        {/* 3-column boards on desktop; 1/2 on smaller */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {BOARDS.map((board, bIdx) => (
            <div
              key={bIdx}
              className="bg-white border border-[#dcecf0] p-5 shadow-sm"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[16px] font-bold text-[#003366]">
                  {board.title}
                </h3>
                <button
                  className="inline-flex items-center gap-1 text-[#0077B6] hover:underline text-sm"
                  aria-label="See more"
                >
                  See more <ChevronRight size={18} />
                </button>
              </div>

              {/* Products grid 2 x 3 */}
              <div className="grid grid-cols-2 gap-4">
                {board.products.map((p, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-[#e7f1f4] overflow-hidden bg-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
                  >
                    <div className="relative w-full h-40 bg-white">
                      <Image
                        src={p.img}
                        alt={p.name}
                        fill
                        className="object-contain p-3 scale-95 group-hover:scale-100 transition-transform duration-300"
                      />
                      {/* gentle bottom fade so text never clashes */}
                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-linear-to-t from-white to-transparent" />
                    </div>

                    <div className="px-3 pb-3 pt-1">
                      <p className="text-[15px] font-medium text-gray-800 leading-snug line-clamp-2">
                        {p.name}
                      </p>

                      {p.tag ? (
                        <p className="text-[13px] font-semibold text-[#00B4D8] mt-1">
                          {p.tag}
                        </p>
                      ) : p.offer ? (
                        <p className="text-[13px] font-semibold text-green-600 mt-1">
                          {p.offer}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
