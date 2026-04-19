/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { PRICE_CATEGORIES } from "./priceCategories";

export default function PriceCategorySection() {
    return (
        <section className="w-full bg-[#E6F7FA] py-6 md:py-10">
            <div className="mx-auto max-w-[1700px] px-4">
                <div className="mb-4 md:mb-5">
                    <h2 className="text-lg font-semibold text-gray-900 md:text-2xl">
                        Shop by Budget
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        Find products under your budget
                    </p>
                </div>

                {/* Mobile: horizontal scroll | Desktop: grid */}
                <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-7 md:gap-4 md:overflow-visible">
                    {PRICE_CATEGORIES.map((item) => (
                        <Link
                            key={item.id}
                            href={item.href}
                            className="group w-[120px] shrink-0 overflow-hidden rounded-xl bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:w-auto"
                        >
                            <div className="flex h-[120px] w-full items-center justify-center overflow-hidden bg-gray-100 p-2 md:h-[160px]">
                                <img
                                    src={item.image}
                                    alt={item.label}
                                    className="max-h-full max-w-full object-contain"
                                    loading="lazy"
                                />
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
} 