/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { PRICE_CATEGORIES } from "./priceCategories";

export default function PriceCategorySection() {
    return (
        <section className="w-full py-8 md:py-10 bg-[#E6F7FA]">
            <div className="mx-auto max-w-[1700px] px-4">
                <div className="mb-5">
                    <h2 className="text-xl md:text-2xl font-semibold text-gray-900">
                        Shop by Budget
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        Find products under your budget
                    </p>
                </div>

                {/* mobile: horizontal scroll | desktop: 6 cards in one row */}
                <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-7 md:gap-4 md:overflow-visible">
                    {PRICE_CATEGORIES.map((item) => (
                        <Link
                            key={item.id}
                            href={item.href}
                            className="group min-w-[160px] shrink-0 overflow-hidden bg-white transition hover:-translate-y-0.5 hover:shadow-md md:min-w-0"
                        >
                            <div className="aspect-[3/3] w-full overflow-hidden bg-gray-100">
                                <img
                                    src={item.image}
                                    alt={item.label}
                                    className="h-full w-full object-contain "
                                    loading="lazy"
                                />
                            </div>

                            {/* <div className="px-3 py-3 text-center">
                                <span className="text-sm font-medium text-gray-900">
                                    {item.label}
                                </span>
                            </div> */}
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}