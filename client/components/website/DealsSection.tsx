/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

type ApiCategory = {
  _id: string;
  name: string;
  slug: string;
  image?: string;
  parentCategory?: ApiCategory | string | null;
};

type ApiVariant = {
  mrp?: number;
  salePrice?: number;
};

type ApiProduct = {
  _id: string;
  mrp?: number;
  salePrice?: number;
  variants?: ApiVariant[];

  // category refs may vary (support all)
  category?: any;
  categoryId?: any;
  subCategory?: any;
  subCategoryId?: any;
};

// image resolver (unchanged)
const resolveImageUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const apiBase = API_BASE || "";
  const host = apiBase.replace(/\/api\/?$/, "");
  if (path.startsWith("/")) return `${host}${path}`;
  return `${host}/${path}`;
};

// ---------- discount helpers ----------
const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const calcDiscountPercent = (mrp: number, sale: number) => {
  if (!mrp || mrp <= 0) return 0;
  if (!sale || sale <= 0) return 0;
  if (sale >= mrp) return 0;
  return Math.round(((mrp - sale) / mrp) * 100);
};

// for each product, pick max discount across variants; fallback to base mrp/salePrice
const getProductDiscount = (p: ApiProduct) => {
  const vars = Array.isArray(p.variants) ? p.variants : [];
  let best = 0;

  for (const v of vars) {
    const mrp = toNum(v?.mrp);
    const sale = toNum(v?.salePrice);
    if (!mrp || !sale) continue;
    const d = calcDiscountPercent(mrp, sale);
    if (d > best) best = d;
  }

  if (best === 0) {
    const mrp = toNum(p?.mrp);
    const sale = toNum(p?.salePrice);
    if (mrp && sale) best = calcDiscountPercent(mrp, sale);
  }

  return best;
};

const getProductSubCategoryId = (p: ApiProduct): string => {
  const pickId = (x: any) => {
    if (!x) return "";
    if (typeof x === "string") return x;
    if (typeof x === "object" && x._id) return String(x._id);
    return "";
  };

  return (
    pickId(p.subCategoryId) ||
    pickId(p.subCategory) ||
    pickId(p.categoryId) ||
    pickId(p.category) ||
    ""
  );
};

export default function DealsSection() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(false);

  // ✅ fetch categories + products (for avg discount)
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        if (!API_BASE) return;

        const [catRes, prodRes] = await Promise.all([
          fetch(`${API_BASE}/admin/categories`, { cache: "no-store" }),
          fetch(`${API_BASE}/admin/products`, { cache: "no-store" }),
        ]);

        const catData = await catRes.json();
        const prodData = await prodRes.json();

        const catList: ApiCategory[] = catData?.data || catData?.categories || [];
        const prodList: ApiProduct[] = prodData?.data || prodData?.products || [];

        setCategories(Array.isArray(catList) ? catList : []);
        setProducts(Array.isArray(prodList) ? prodList : []);
      } catch {
        setCategories([]);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  // ✅ avg discount map by subcategory id
  const subAvgDiscountMap = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};

    for (const p of products) {
      const subId = getProductSubCategoryId(p);
      if (!subId) continue;

      const d = getProductDiscount(p);
      if (d <= 0) continue; // remove this line if you want include 0% in avg

      if (!map[subId]) map[subId] = { sum: 0, count: 0 };
      map[subId].sum += d;
      map[subId].count += 1;
    }

    const out: Record<string, number> = {};
    for (const k of Object.keys(map)) {
      out[k] = map[k].count ? Math.round(map[k].sum / map[k].count) : 0;
    }
    return out;
  }, [products]);

  // build parents + children map (unchanged)
  const { parents, childrenMap } = useMemo(() => {
    const p: ApiCategory[] = [];
    const children: Record<string, ApiCategory[]> = {};

    for (const c of categories) {
      if (!c?.parentCategory) {
        p.push(c);
        continue;
      }

      const pid =
        typeof c.parentCategory === "string"
          ? c.parentCategory
          : c.parentCategory?._id;

      if (!pid) continue;
      if (!children[pid]) children[pid] = [];
      children[pid].push(c);
    }

    p.sort((a, b) => a.name.localeCompare(b.name));
    Object.keys(children).forEach((k) =>
      children[k].sort((a, b) => a.name.localeCompare(b.name))
    );

    return { parents: p, childrenMap: children };
  }, [categories]);

  // ---------------- WINTER (PARENT BASED - SAME) ----------------
  const winterParent = useMemo(() => {
    return parents.find((x) => (x.slug || "").toLowerCase() === "winter");
  }, [parents]);

  const winterItems = useMemo(() => {
    if (!winterParent) return [];
    const subs = childrenMap[winterParent._id] || [];

    return subs.slice(0, 4).map((sub) => {
      const avg = subAvgDiscountMap[sub._id] || 0;
      return {
        name: sub.name,
        img: sub.image ? resolveImageUrl(sub.image) : "/tshirt.webp",
        offer: avg > 0 ? `Min. ${avg}% Off` : "New Range",
        href: `/website/category/${winterParent.slug}/${sub.slug}`,
        offerType: avg > 0 ? "discount" : "new",
      };
    });
  }, [winterParent, childrenMap, subAvgDiscountMap]);

  // ---------------- TOP PICKS (PARENT FREE - UPDATED) ----------------
  const getParentSlugForSub = (sub: ApiCategory) => {
    if (!sub.parentCategory) return "";

    if (typeof sub.parentCategory === "string") {
      const parent = categories.find((c) => c._id === sub.parentCategory);
      return parent?.slug || "";
    }

    return sub.parentCategory.slug || "";
  };

  const TOP_PICKS_SUB_SLUGS = ["mens-clothing", "womens-clothing", "audio", "accessories"];

  const topPicksItems = useMemo(() => {
    const allSubCategories = Object.values(childrenMap).flat();

    const picked = allSubCategories
      .filter((sub) => TOP_PICKS_SUB_SLUGS.includes((sub.slug || "").toLowerCase()))
      .slice(0, 4);

    return picked.map((sub) => {
      const parentSlug = getParentSlugForSub(sub);
      const avg = subAvgDiscountMap[sub._id] || 0;

      return {
        name: sub.name,
        img: sub.image ? resolveImageUrl(sub.image) : "/tshirt.webp",
        offer: avg > 0 ? `Min. ${avg}% Off` : "New Range",
        offerType: avg > 0 ? "discount" : "new",
        href: parentSlug
          ? `/website/category/${parentSlug}/${sub.slug}`
          : `/website/category/${sub.slug}`,
      };
    });
  }, [childrenMap, categories, subAvgDiscountMap]);

  const deals = [
    { title: "Top picks of the sale", products: topPicksItems },
    { title: "Winter Essentials for You", products: winterItems },
  ];

  return (
    <section className="w-full bg-[#E6F7FA] py-4">
      <div className="max-w-[1700px] mx-auto flex flex-col lg:flex-row gap-2 px-4">
        {/* Left side - Deals Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
          {deals.map((deal, idx) => (
            <div key={idx} className="bg-white border border-[#dcecf0] p-5 transition-all">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[18px] font-semibold text-[#003366]">{deal.title}</h3>
                <ChevronRight className="text-[#0077B6]" size={20} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {(loading && deal.products.length === 0 ? new Array(4).fill(null) : deal.products).map(
                  (p: any, i: number) => {
                    if (!p) {
                      return (
                        <div
                          key={i}
                          className="border border-[#e4eff2] rounded-sm overflow-hidden bg-white"
                        >
                          <div className="relative w-full h-36 bg-gray-50" />
                          <div className="text-center py-2">
                            <div className="h-4 bg-gray-100 mx-4 rounded" />
                            <div className="h-3 bg-gray-100 mx-10 mt-2 rounded" />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={i}
                        href={p.href}
                        className="border border-[#e4eff2] rounded-sm overflow-hidden bg-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group block"
                      >
                        <div className="relative w-full h-36 overflow-hidden">
                          <img
                            src={p.img}
                            alt={p.name}
                            className="object-contain scale-95 group-hover:scale-100 transition-transform duration-300"
                          />
                          <div className="absolute bottom-0 left-0 right-0 h-12 bg-linear-to-t from-white/95 to-transparent" />
                        </div>

                        <div className="text-center py-2">
                          <p className="text-[14px] font-medium text-[#002B5B] truncate">
                            {p.name}
                          </p>
                          <p
                            className={`text-[13px] font-semibold ${
                              p.offerType === "new" ? "text-[#00B4D8]" : "text-green-600"
                            }`}
                          >
                            {p.offer}
                          </p>
                        </div>
                      </Link>
                    );
                  }
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Right side - Promo Banner (UNCHANGED) */}
        <div className="w-full lg:w-[360px] flex flex-col justify-between overflow-hidden bg-[#003366] text-white shadow-[0_2px_12px_rgba(0,0,0,0.1)]">
          <div className="p-10 flex flex-col items-center text-center">
            <h2 className="text-3xl font-semibold mb-3 leading-snug">
              Shop your <span className="text-[#00B4D8]">fashion</span> Needs
            </h2>
            <p className="text-[#d3e7ff] mb-8 text-[15px]">with Latest &amp; Trendy Choices</p>
            <Link
              href="/website/products"
              className="bg-[#00B4D8] hover:bg-[#009ec4] text-white px-7 py-3 rounded-lg font-medium transition"
            >
              Shop Now
            </Link>
          </div>
          <div className="w-full">
            <img src="/bedsheet.jpg" alt="Shop Fashion" className="object-cover w-full h-[300px]" />
          </div>
        </div>
      </div>
    </section>
  );
}
