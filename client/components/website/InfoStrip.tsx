"use client";

import { Package, Wallet, Tag } from "lucide-react";

export default function InfoStrip() {
  const features = [
    {
      icon: <Package size={22} className="text-[#002B5B]" />,
      text: "7 Days Easy Return",
    },
    {
      icon: <Wallet size={22} className="text-[#002B5B]" />,
      text: "Cash on Delivery",
    },
    {
      icon: <Tag size={22} className="text-[#002B5B]" />,
      text: "Lowest Prices",
    },
  ];

  return (
    <section className="w-full bg-[#E6F7FA] py-5">
      <div className="max-w-[1700px] mx-auto px-6">
        <div className="bg-white border border-[#B5E3F0] rounded-lg py-4 flex flex-wrap items-center justify-center gap-10 shadow-sm">
          {features.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 text-[15px] font-semibold text-[#1E3557]"
            >
              {item.icon}
              <span>{item.text}</span>
              {i !== features.length - 1 && (
                <span className="h-5 w-px bg-[#C4E5EF] ml-4" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
