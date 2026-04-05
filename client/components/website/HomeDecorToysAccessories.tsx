/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ProductCard from "@/components/website/ProductCard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

type ApiCategory = {
  _id: string;
  name: string;
  slug: string;
  image?: string;
  parentCategory?: ApiCategory | string | null;
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

type ApiCategoryRef = {
  _id?: string;
  name?: string;
  slug?: string;
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
  matchName: string;
};

const SECTION_CONFIG: SectionConfig[] = [
  {
    title: "Baby Products",
    matchName: "Baby Products",
  },
  {
    title: "Battery Operated Toys",
    matchName: "Battery Operated Toys",
  },
  {
    title: "Toys & MechTech",
    matchName: "Toys & MechTech",
  },
];

const CATEGORIES_ENDPOINT = () => `${API_BASE}/admin/categories`;
const PRODUCTS_ENDPOINT = () => `${API_BASE}/admin/products`;

function normalizeText(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getRefName(ref: any): string {
  if (!ref || typeof ref === "string") return "";
  return String(ref.name || "").trim();
}

function getRefSlug(ref: any): string {
  if (!ref || typeof ref === "string") return "";
  return String(ref.slug || "").trim();
}

function getAllProductCategoryNames(product: ApiProduct): string[] {
  const names = [
    getRefName(product.category),
    getRefName(product.categoryId),
    getRefName(product.subCategory),
    getRefName(product.subCategoryId),
  ]
    .filter(Boolean)
    .map(normalizeText);

  return [...new Set(names)];
}

function calcTotalStock(product: ApiProduct) {
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.reduce((sum, v) => sum + Number(v.quantity ?? 0), 0);
  }
  return Number(product.totalStock ?? product.baseStock ?? 0);
}

function SectionSkeleton() {
  return (
    <div className="bg-white border border-[#dcecf0] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-40 rounded bg-gray-100 animate-pulse" />
        <div className="h-5 w-20 rounded bg-gray-100 animate-pulse" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-gray-200 bg-white p-3 animate-pulse">
            <div className="aspect-square bg-gray-100 mb-3" />
            <div className="h-4 bg-gray-100 rounded mb-2" />
            <div className="h-3 bg-gray-100 rounded w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomeDecorToysAccessories() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        if (!API_BASE) {
          setCategories([]);
          setProducts([]);
          return;
        }

        const [catRes, prodRes] = await Promise.all([
          fetch(CATEGORIES_ENDPOINT(), { cache: "no-store" }),
          fetch(PRODUCTS_ENDPOINT(), { cache: "no-store" }),
        ]);

        const catData = await catRes.json();
        const prodData = await prodRes.json();

        const cats: ApiCategory[] = catData?.data || catData?.categories || [];
        const prods: ApiProduct[] = prodData?.data || prodData?.products || [];

        setCategories(Array.isArray(cats) ? cats : []);
        setProducts(Array.isArray(prods) ? prods : []);
      } catch {
        setCategories([]);
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

  const sectionData = useMemo(() => {
    return SECTION_CONFIG.map((section) => {
      const matchedCategory = categories.find(
        (cat) => normalizeText(cat.name) === normalizeText(section.matchName)
      );

      const matchedProducts = visibleProducts
        .filter((product) => {
          const names = getAllProductCategoryNames(product);
          return names.includes(normalizeText(section.matchName));
        })
        .slice(0, 4);

      return {
        title: section.title,
        href: matchedCategory ? `/category/${matchedCategory.slug}` : "#",
        products: matchedProducts,
      };
    }).filter((section) => section.products.length > 0);
  }, [categories, visibleProducts]);

  if (!loading && sectionData.length === 0) {
    return null;
  }

  return (
    <section className="w-full bg-[#E6F7FA] py-4">
      <div className="max-w-[1700px] mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {loading
            ? Array.from({ length: 3 }).map((_, idx) => <SectionSkeleton key={idx} />)
            : sectionData.map((section) => (
                <div
                  key={section.title}
                  className="bg-white border border-[#dcecf0] p-5 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[22px] font-bold text-[#003366]">
                      {section.title}
                    </h3>

                    <Link
                      href={section.href}
                      className="inline-flex items-center gap-1 text-[#0077B6] hover:underline text-sm"
                    >
                      View all <ChevronRight size={18} />
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {section.products.map((p) => {
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
      </div>
    </section>
  );
}