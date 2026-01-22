/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";

export default function SupplierHero() {
  return (
    <section className="relative w-full h-[50vh] min-h-[420px] overflow-hidden bg-[#fff7fb]">
      {/* BG IMAGE (you will replace src) */}
      <img
        src="/VENDOR.png"
        alt="Supplier hero background"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* soft overlay to keep text readable (optional) */}
      <div className="absolute inset-0 bg-linear-to-r from-white/95 via-white/70 to-transparent" />

      <div className="relative mx-auto max-w-[1400px] h-full px-4">
        <div className="h-full grid grid-cols-1 lg:grid-cols-12 items-center">
          {/* LEFT CONTENT */}
          <div className="lg:col-span-6 xl:col-span-5 py-10">
            <h1 className="text-[34px] sm:text-[44px] lg:text-[48px] leading-[1.08] font-extrabold text-gray-900">
              Sell online to Crores of Customers
              <br />
              <span className="text-[#ff2e93]">at 0% Commission</span>
            </h1>

            <p className="mt-4 text-[14px] sm:text-[15px] text-gray-600 max-w-[520px]">
              Become a seller and grow your business across India with fast onboarding,
              easy cataloging, and smooth shipping support.
            </p>

            {/* Info pill */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-[#ff2e93] px-3 py-1 text-[12px] font-bold text-white">
                NEW
              </span>
              <p className="text-[13px] sm:text-[14px] text-gray-700">
                Don’t have a GSTIN? You can still sell.{" "}
                <Link href="/supplier/no-gst" className="font-semibold text-[#ff2e93] hover:underline">
                  Know more
                </Link>
              </p>
            </div>

            {/* CTA */}
            <div className="mt-8 flex items-center gap-3">
              <Link
                href="/supplier/register"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#3b2cc4] px-7 text-[14px] font-semibold text-white hover:opacity-95"
              >
                Start Selling
              </Link>

              <Link
                href="/supplier/how-it-works"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-6 text-[14px] font-semibold text-gray-800 hover:bg-gray-50"
              >
                How it works
              </Link>
            </div>

            {/* Trust row (optional) */}
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-gray-600">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3b2cc4]" />
                Zero commission categories
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3b2cc4]" />
                Pan-India shipping support
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3b2cc4]" />
                Fast seller onboarding
              </span>
            </div>
          </div>

          {/* RIGHT SPACE (leave empty; your bg already contains model/graphics) */}
          <div className="hidden lg:block lg:col-span-6 xl:col-span-7" />
        </div>
      </div>
    </section>
  );
}
