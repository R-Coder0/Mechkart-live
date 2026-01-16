"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

interface ApiCategory {
  _id: string;
  name: string;
  slug: string;
  parentCategory?: ApiCategory | string | null;
}

interface Props {
  categories: ApiCategory[];
}

export default function CategoryBarClient({ categories }: Props) {
  const parentScrollRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // shared dropdown state (desktop hover / mobile click)
  const [openParentId, setOpenParentId] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ left: number } | null>(null);

  const { parents, childrenMap, parentSlugById } = useMemo(() => {
    const parentsArr: ApiCategory[] = [];
    const children: Record<string, ApiCategory[]> = {};
    const slugMap: Record<string, string> = {};

    for (const cat of categories || []) {
      if (!cat?.parentCategory) {
        parentsArr.push(cat);
        slugMap[cat._id] = cat.slug;
        continue;
      }

      const parentId =
        typeof cat.parentCategory === "string"
          ? cat.parentCategory
          : cat.parentCategory?._id;

      if (!parentId) continue;

      if (!children[parentId]) children[parentId] = [];
      children[parentId].push(cat);
    }

    parentsArr.sort((a, b) => a.name.localeCompare(b.name));
    Object.keys(children).forEach((k) => {
      children[k].sort((a, b) => a.name.localeCompare(b.name));
    });

    return { parents: parentsArr, childrenMap: children, parentSlugById: slugMap };
  }, [categories]);

  const scrollParents = (offset: number) => {
    parentScrollRef.current?.scrollBy({ left: offset, behavior: "smooth" });
  };

  // dropdown width (w-64)
  const DROPDOWN_W = 256;

  const openDropdownAt = (el: HTMLElement, parentId: string) => {
    const hasChildren = (childrenMap[parentId] || []).length > 0;
    if (!hasChildren) return;

    if (!wrapperRef.current) return;
    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    let left = elRect.left - wrapperRect.left;

    // clamp inside wrapper
    const maxLeft = Math.max(0, wrapperRect.width - DROPDOWN_W - 8);
    left = Math.min(Math.max(8, left), maxLeft);

    setOpenParentId(parentId);
    setDropdownPos({ left });
  };

  const closeDropdown = () => {
    setOpenParentId(null);
    setDropdownPos(null);
  };

  const activeChildren = (openParentId && childrenMap[openParentId]) || [];
  const activeParentSlug = openParentId ? parentSlugById[openParentId] : "";

  return (
    <div
      ref={wrapperRef}
      className="relative bg-white z-40 border-b border-[#e2e2e2]"
      onMouseLeave={closeDropdown}
    >
      <div className="max-w-[1400px] mx-auto relative px-2 sm:px-2">
        {/* DESKTOP ARROWS */}
        <button
          type="button"
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 items-center justify-center bg-white border shadow-sm rounded-full p-1.5 text-gray-600 hover:bg-gray-100 z-30"
          onClick={() => scrollParents(-280)}
          aria-label="Scroll left"
        >
          <ChevronLeft size={18} />
        </button>

        <button
          type="button"
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 items-center justify-center bg-white border shadow-sm rounded-full p-1.5 text-gray-600 hover:bg-gray-100 z-30"
          onClick={() => scrollParents(280)}
          aria-label="Scroll right"
        >
          <ChevronRight size={18} />
        </button>

        {/* BAR */}
        <div className="relative flex items-center py-2 sm:py-3">
          {/* SCROLL AREA */}
          <div
            ref={parentScrollRef}
            className="
              w-full
              flex items-left
              overflow-x-auto scrollbar-hide scroll-smooth
              whitespace-nowrap
              gap-5 sm:gap-8
              text-[13px] sm:text-[14px] md:text-[15px]
              font-semibold text-gray-800
              md:justify-left
              px-1 md:px-12
            "
          >
            {/* ✅ ALL (now first for both mobile+desktop) */}
            <Link
              href="/website/products"
              className="inline-flex items-center gap-1 text-gray-800 hover:text-[#82008F] transition-colors"
              onClick={closeDropdown}
            >
              All
            </Link>

            {parents.map((parent) => {
              const hasChildren = (childrenMap[parent._id] || []).length > 0;
              const isActive = openParentId === parent._id;

              // No children => normal link
              if (!hasChildren) {
                return (
                  <Link
                    key={parent._id}
                    href={`/website/category/${parent.slug}`}
                    className="inline-flex items-center gap-1 text-gray-800 hover:text-[#82008F] transition-colors"
                    onClick={closeDropdown}
                  >
                    {parent.name}
                  </Link>
                );
              }

              // With children => desktop hover + mobile tap
              return (
                <button
                  key={parent._id}
                  type="button"
                  className={`inline-flex items-center gap-1 transition-colors outline-none
                    ${isActive ? "text-[#82008F]" : "text-gray-800"}
                    hover:text-[#82008F]`}
                  onMouseEnter={(e) => {
                    // desktop hover
                    if (window.innerWidth >= 768) openDropdownAt(e.currentTarget, parent._id);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    // mobile tap toggle + also works on desktop
                    if (isActive) closeDropdown();
                    else openDropdownAt(e.currentTarget, parent._id);
                  }}
                >
                  <span>{parent.name}</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${
                      isActive ? "rotate-180 text-[#82008F]" : "text-gray-400"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* DROPDOWN (same for desktop + mobile, clean & small) */}
      {activeChildren.length > 0 && dropdownPos && activeParentSlug && (
        <div className="absolute top-full" style={{ left: dropdownPos.left }}>
          <div className="w-64 rounded-lg bg-white border border-gray-200 shadow-[0_10px_30px_rgba(15,23,42,0.15)] py-2 overflow-hidden">
            {activeChildren.map((sub) => (
              <Link
                key={sub._id}
                href={`/website/category/${activeParentSlug}/${sub.slug}`}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                onClick={closeDropdown}
              >
                {sub.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
