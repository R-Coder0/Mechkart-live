/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ProductCard from "@/components/website/ProductCard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

type ApiCategoryRef = {
  _id?: string;
  name?: string;
  slug?: string;
};

type ApiVariant = {
  _id?: string;
  label?: string;
  size?: string;
  weight?: string;
  comboText?: string;
  mrp?: number;
  salePrice?: number;
  quantity?: number;
  images?: string[];
};

type ApiProduct = {
  _id: string;
  title: string;
  slug: string;
  featureImage?: string;
  mrp?: number;
  salePrice?: number;
  totalStock?: number;
  baseStock?: number;
  variants?: ApiVariant[];
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  isActive?: boolean;
  ownerType?: "ADMIN" | "VENDOR";
  vendorId?: {
    company?: { name?: string };
  };

  category?: string | ApiCategoryRef | null;
  categoryId?: string | ApiCategoryRef | null;
  subCategory?: string | ApiCategoryRef | null;
  subCategoryId?: string | ApiCategoryRef | null;
};

type SectionConfig = {
  title: string;
  slug: string;
  href: string;
};

const SECTION_CONFIG: SectionConfig[] = [
  {
    title: "Trending",
    slug: "trending",
    href: "/category/trending",
  },
  {
    title: "Bags",
    slug: "bags",
    href: "/category/bags",
  },
];

function getRefSlug(ref: any): string {
  if (!ref || typeof ref === "string") return "";
  return String(ref.slug || "").trim().toLowerCase();
}

function getAllProductSlugs(product: ApiProduct): string[] {
  const slugs = [
    getRefSlug(product.category),
    getRefSlug(product.categoryId),
    getRefSlug(product.subCategory),
    getRefSlug(product.subCategoryId),
  ].filter(Boolean);

  return [...new Set(slugs)];
}

function calcTotalStock(product: ApiProduct) {
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.reduce((sum, v) => sum + Number(v.quantity ?? 0), 0);
  }
  return Number(product.totalStock ?? product.baseStock ?? 0);
}

function SectionSkeleton() {
  return (
    <div className="bg-white border border-[#dcecf0] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-40 rounded bg-gray-100 animate-pulse" />
        <div className="h-5 w-5 rounded bg-gray-100 animate-pulse" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-[#e4eff2] bg-white p-2">
            <div className="aspect-square bg-gray-100 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DealsSection() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);

        if (!API_BASE) {
          setProducts([]);
          return;
        }

        const res = await fetch(`${API_BASE}/admin/products`, {
          cache: "no-store",
        });

        if (!res.ok) {
          setProducts([]);
          return;
        }

        const data = await res.json();
        const list: ApiProduct[] = data?.data || data?.products || [];

        setProducts(Array.isArray(list) ? list : []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const visibleProducts = useMemo(() => {
    return products.filter(
      (p) => p.approvalStatus === "APPROVED" && p.isActive !== false
    );
  }, [products]);

  const deals = useMemo(() => {
    return SECTION_CONFIG.map((section) => {
      const matchedProducts = visibleProducts
        .filter((product) => {
          const slugs = getAllProductSlugs(product);
          return slugs.includes(section.slug);
        })
        .slice(0, 4);

      return {
        ...section,
        products: matchedProducts,
      };
    }).filter((section) => section.products.length > 0);
  }, [visibleProducts]);

  if (!loading && deals.length === 0) {
    return null;
  }

  return (
    <section className="w-full bg-[#E6F7FA] py-4">
      <div className="max-w-[1700px] mx-auto flex flex-col lg:flex-row gap-2 px-4">
        {/* Left side - same old 2 block layout */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
          {loading
            ? Array.from({ length: 2 }).map((_, idx) => <SectionSkeleton key={idx} />)
            : deals.map((deal) => (
                <div
                  key={deal.slug}
                  className="bg-white border border-[#dcecf0] p-5 transition-all"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[18px] font-semibold text-[#003366]">
                      {deal.title}
                    </h3>

                    <Link
                      href={deal.href}
                      className="text-[#0077B6] hover:text-[#005f8f] transition"
                      aria-label={`Go to ${deal.title}`}
                    >
                      <ChevronRight size={20} />
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {deal.products.map((p) => {
                      const totalStock = calcTotalStock(p);

                      return (
                        <ProductCard
                          key={p._id}
                          product={{
                            _id: p._id,
                            title: p.title,
                            slug: p.slug,
                            featureImage: p.featureImage,
                            mrp: p.mrp,
                            salePrice: p.salePrice,
                            variants: p.variants || [],
                            totalStock,
                            inStock: totalStock > 0,
                            ownerType: p.ownerType,
                            vendorId: p.vendorId || null,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
        </div>

        {/* Right side - promo banner same as before */}
<div className="w-full lg:w-[360px] lg:self-start grid grid-cols-1 gap-2 align-middle">
  {/* Promo Card 1 */}
  <div className="overflow-hidden bg-[#003366] text-white shadow-[0_2px_12px_rgba(0,0,0,0.1)]">
    <div className="px-6 py-8 flex flex-col items-center text-center">
      <h2 className="text-3xl font-semibold mb-3 leading-snug">
        Shop your <span className="text-[#00B4D8]">fashion</span> Needs
      </h2>
      <p className="text-[#d3e7ff] mb-6 text-[15px]">
        with Latest &amp; Trendy Choices
      </p>
      <Link
        href="/products"
        className="bg-[#00B4D8] hover:bg-[#009ec4] text-white px-7 py-3 rounded-lg font-medium transition"
      >
        Shop Now
      </Link>
    </div>

    <div className="w-full">
      <img
        src="/bedsheet.jpg"
        alt="Shop Fashion"
        className="object-cover w-full h-[220px]"
      />
    </div>
  </div>

  {/* Promo Card 2 */}
  <div className="overflow-hidden bg-[#003366] text-white shadow-[0_2px_12px_rgba(0,0,0,0.1)]">
    <div className="px-6 py-8 flex flex-col items-center text-center">
      <h2 className="text-3xl font-semibold mb-3 leading-snug">
        Refresh your <span className="text-[#00B4D8]">home</span> Style
      </h2>
      <p className="text-[#d3e7ff] mb-6 text-[15px]">
        Discover fresh picks for every space
      </p>
      <Link
        href="/products"
        className="bg-[#00B4D8] hover:bg-[#009ec4] text-white px-7 py-3 rounded-lg font-medium transition"
      >
        Explore Now
      </Link>
    </div>

    <div className="w-full">
      <img
        src="/bedsheet.jpg"
        alt="Home Style"
        className="object-cover w-full h-[220px]"
      />
    </div>
  </div>
</div>
      </div>
    </section>
  );
}