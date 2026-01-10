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
  title?: string;
  mrp?: number;
  salePrice?: number;
  variants?: ApiVariant[];

  // category refs can be in different keys (we handle all)
  category?: any;
  categoryId?: any;
  subCategory?: any;
  subCategoryId?: any;
};

// image resolver
const resolveImageUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;

  const host = (API_BASE || "").replace(/\/api\/?$/, "");
  return path.startsWith("/") ? `${host}${path}` : `${host}/${path}`;
};

// ✅ boards parent slugs (working)
const BOARD_PARENT_SLUGS = ["fashion", "tv--appliances", "bedsheet"];

// ✅ endpoints (same style as your project)
const CATEGORIES_ENDPOINT = () => `${API_BASE}/admin/categories`;
const PRODUCTS_ENDPOINT = () => `${API_BASE}/admin/products`;

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

// choose “best” price for discount calculation
// - if variants exist: pick variant that gives MAX discount (good for "Min. X% Off" display?)
//   Actually you asked average discount of products; for each product we compute a representative discount.
//   We'll pick maximum discount within that product variants (common ecom practice).
const getProductDiscount = (p: ApiProduct) => {
  // variant-based (commercial)
  const vars = Array.isArray(p.variants) ? p.variants : [];

  let best = 0;

  for (const v of vars) {
    const mrp = toNum(v?.mrp);
    const sale = toNum(v?.salePrice);
    if (!mrp || !sale) continue;

    const d = calcDiscountPercent(mrp, sale);
    if (d > best) best = d;
  }

  // fallback to base price
  if (best === 0) {
    const mrp = toNum(p?.mrp);
    const sale = toNum(p?.salePrice);
    if (mrp && sale) best = calcDiscountPercent(mrp, sale);
  }

  return best; // 0..100
};

// resolve product -> subcategory id (covers multiple shapes)
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

export default function HomeDecorToysAccessories() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(false);

  // fetch categories + products
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        if (!API_BASE) return;

        const [catRes, prodRes] = await Promise.all([
          fetch(CATEGORIES_ENDPOINT(), { cache: "no-store" }),
          fetch(PRODUCTS_ENDPOINT(), { cache: "no-store" }),
        ]);

        const catData = await catRes.json();
        const prodData = await prodRes.json();

        const cats: ApiCategory[] = catData?.data || catData?.categories || [];
        const prods: ApiProduct[] =
          prodData?.data || prodData?.products || [];

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

  // parents + children map
  const { parents, childrenMap } = useMemo(() => {
    const p: ApiCategory[] = [];
    const c: Record<string, ApiCategory[]> = {};

    for (const cat of categories) {
      if (!cat.parentCategory) {
        p.push(cat);
      } else {
        const pid =
          typeof cat.parentCategory === "string"
            ? cat.parentCategory
            : cat.parentCategory._id;

        if (!c[pid]) c[pid] = [];
        c[pid].push(cat);
      }
    }

    return { parents: p, childrenMap: c };
  }, [categories]);

  // ✅ build avg discount map by subCategoryId
  const subAvgDiscountMap = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};

    for (const p of products) {
      const subId = getProductSubCategoryId(p);
      if (!subId) continue;

      const d = getProductDiscount(p);
      // only count meaningful discounts (optional)
      // If you want to include 0% in avg, remove this condition.
      if (d <= 0) continue;

      if (!map[subId]) map[subId] = { sum: 0, count: 0 };
      map[subId].sum += d;
      map[subId].count += 1;
    }

    // convert to rounded avg
    const out: Record<string, number> = {};
    for (const subId of Object.keys(map)) {
      const { sum, count } = map[subId];
      out[subId] = count ? Math.round(sum / count) : 0;
    }
    return out;
  }, [products]);

  // build boards
  const boards = useMemo(() => {
    return BOARD_PARENT_SLUGS.map((slug) => {
      const parent = parents.find((p) => (p.slug || "").toLowerCase() === slug);
      if (!parent) return null;

      const subs = (childrenMap[parent._id] || []).slice(0, 4);

      return {
        title: parent.name,
        parentSlug: parent.slug,
        products: subs.map((sub) => {
          const avg = subAvgDiscountMap[sub._id] || 0;

          // if no products or no discount data -> fallback label
          const offerText = avg > 0 ? `Min. ${avg}% Off` : "New Range";

          return {
            name: sub.name,
            img: sub.image ? resolveImageUrl(sub.image) : "/tshirt.webp",
            href: `/website/category/${parent.slug}/${sub.slug}`,
            offer: offerText,
            offerType: avg > 0 ? "discount" : "new",
          };
        }),
      };
    }).filter(Boolean) as any[];
  }, [parents, childrenMap, subAvgDiscountMap]);

  if (loading || boards.length === 0) return null;

  return (
    <section className="w-full bg-[#E6F7FA] py-4">
      <div className="max-w-[1700px] mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {boards.map((board: any, bIdx: number) => (
            <div
              key={bIdx}
              className="bg-white border border-[#dcecf0] p-5 shadow-sm hover:shadow-md transition-all"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[22px] font-bold text-[#003366]">
                  {board.title}
                </h3>
                <Link
                  href={`/website/category/${board.parentSlug}`}
                  className="inline-flex items-center gap-1 text-[#0077B6] hover:underline text-sm"
                >
                  See more <ChevronRight size={18} />
                </Link>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-2 gap-4">
                {board.products.map((p: any, i: number) => (
                  <Link
                    key={i}
                    href={p.href}
                    className="rounded-xl border border-[#e7f1f4] overflow-hidden bg-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group block"
                  >
                    <div className="relative w-full h-40 bg-white overflow-hidden">
                      <img
                        src={p.img}
                        alt={p.name}
                        className="w-full h-full object-contain rounded-xl scale-95 group-hover:scale-100 transition-transform duration-300"
                      />
                      <div className="absolute bottom-0 left-0 right-0 h-10 bg-linear-to-t from-white to-transparent" />
                    </div>

                    <div className="px-3 pb-3 pt-1 text-center">
                      <p className="text-[15px] font-medium text-gray-800 leading-snug truncate">
                        {p.name}
                      </p>

                      {/* ✅ dynamic offer */}
                      <p
                        className={`text-[13px] font-semibold mt-1 ${
                          p.offerType === "new" ? "text-[#00B4D8]" : "text-green-600"
                        }`}
                      >
                        {p.offer}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
