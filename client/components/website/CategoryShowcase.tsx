"use client";

import Image from "next/image";

export default function CategoryShowcase() {
  const categories = [
    {
      name: "Ethnic Wear",
      img: "/categoryshowcase.webp",
    },
    {
      name: "Western Dresses",
      img: "/1744634725496.webp",
    },
    {
      name: "Menswear",
      img: "/1744634780426.webp",
    },
    {
      name: "Footwear",
      img: "/1744634780426.webp",
    },
    {
      name: "Home Decor",
        img: "/1744634780426.webp",
    },
    {
      name: "Beauty",
      img: "/1744634780426.webp",
    },
    {
      name: "Accessories",
      img: "/1744634780426.webp",
    },
    {
      name: "Grocery",
      img: "/1744634780426.webp",
    },
  ];

  return (
    <section className="w-full bg-[#E6F7FA] py-10">
      <div className="max-w-[1700px] mx-auto px-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-6 place-items-center">
          {categories.map((cat, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center text-center cursor-pointer group"
            >
              <div className="w-[120px] h-[120px] flex items-center justify-center rounded-2xl overflow-hidden transition-transform duration-300 group-hover:scale-105">
                <Image
                  src={cat.img}
                  alt={cat.name}
                  width={120}
                  height={120}
                  className="object-contain"
                />
              </div>
              <span className="mt-3 text-[15px] font-medium text-gray-800 group-hover:text-[#002B5B] transition">
                {cat.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
