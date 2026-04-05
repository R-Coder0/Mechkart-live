"use client";

export default function AboutInfoSection() {
  return (
    <section className="w-full bg-[#E6F7FA] text-gray-700 py-12 border-t border-[#e2e4ea]">
      <div className="max-w-[1700px] mx-auto px-4 space-y-10 text-[14px] leading-relaxed">
        
        {/* About */}
        <div>
          <h2 className="text-[18px] font-semibold text-[#003366] mb-2">
            About Mechkart
          </h2>
          <p>
            <strong>Mechkart</strong> is a fast-growing online marketplace that
            connects customers with a wide range of everyday, trending, and
            value-driven products — all in one place. Built with strong market
            experience and product understanding, Mechkart is designed to serve
            both buyers and sellers through a seamless digital platform.
          </p>
          <p className="mt-2">
            Whether you are looking to shop for daily essentials, gifts, toys,
            lifestyle products, or home solutions — or you want to grow your
            business by selling online — Mechkart makes it simple, accessible,
            and scalable.
          </p>
        </div>

        {/* Categories */}
        <div>
          <h3 className="text-[16px] font-semibold text-[#003366] mb-2">
            What You Can Explore on Mechkart
          </h3>

          <p className="mt-2">
            <strong>Toys & Kids:</strong> Plastic toys, battery toys, soft toys,
            RC toys, dolls, baby products, and games.
          </p>

          <p className="mt-2">
            <strong>Stationery & School Essentials:</strong> Pencil boxes, lunch
            boxes, bottles, pouches, and daily-use school products.
          </p>

          <p className="mt-2">
            <strong>Gifts & Party Items:</strong> Gift items, return gifts,
            frames, festive products, and celebration essentials.
          </p>

          <p className="mt-2">
            <strong>Electronics & Accessories:</strong> Useful gadgets, mobile
            accessories, lamps, lights, and everyday electronics.
          </p>

          <p className="mt-2">
            <strong>Fashion & Lifestyle:</strong> Watches, belts, wallets,
            jewellery, sunglasses, cosmetics, and more.
          </p>

          <p className="mt-2">
            <strong>Home, Kitchen & Decor:</strong> Kitchen items, mugs,
            sippers, home essentials, and decorative products.
          </p>
        </div>

        {/* Sellers Section */}
        <div>
          <h3 className="text-[16px] font-semibold text-[#003366] mb-2">
            Sell on Mechkart
          </h3>
          <p>
            Mechkart is not just a shopping platform — it is also a marketplace
            for vendors, wholesalers, and businesses to expand their reach
            online. Sellers can list products, manage inventory, and connect
            with customers across regions through a growing digital ecosystem.
          </p>
          <p className="mt-2">
            With simple onboarding, product listing support, and a scalable
            platform, Mechkart helps businesses move from offline to online
            selling with ease.
          </p>
        </div>

        {/* Value */}
        <div>
          <h3 className="text-[16px] font-semibold text-[#003366] mb-2">
            Our Approach
          </h3>
          <p>
            We focus on making buying and selling more practical, affordable,
            and accessible. Our platform is built around real customer demand
            and everyday product utility, ensuring both buyers and sellers
            benefit from a balanced and growing marketplace.
          </p>
        </div>

        {/* Why */}
        <div>
          <h3 className="text-[16px] font-semibold text-[#003366] mb-2">
            Why Choose Mechkart
          </h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Wide range of everyday and trending products</li>
            <li>Open marketplace for vendors and sellers</li>
            <li>Affordable pricing across categories</li>
            <li>Simple buying and selling experience</li>
            <li>Growing platform with expanding product base</li>
          </ul>
        </div>

        {/* Closing */}
        <div className="pt-6 border-t border-[#e3e5eb] text-[13px] text-gray-600">
          <p>
            <strong>Mechkart</strong> is built to simplify commerce — for
            customers who want convenience, and for sellers who want growth.
            Explore, shop, or start selling — all in one place.
          </p>
        </div>

      </div>
    </section>
  );
}