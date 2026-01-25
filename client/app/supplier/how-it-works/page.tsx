import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it Works | Mechkart",
  description:
    "Understand how selling on Mechkart works – from account creation to shipping and payouts.",
};

export default function HowItWorksPage() {
  return (
    <main className="bg-white">
      <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6 lg:px-8">
        {/* PAGE TITLE */}
        <header className="mb-10">
          <h1 className="text-3xl font-semibold text-slate-900">
            How Mechkart Works
          </h1>
          <p className="mt-3 max-w-3xl text-base text-slate-600">
            Selling on Mechkart is simple and transparent. Follow the steps
            below to start selling, fulfill orders, and receive payouts
            smoothly.
          </p>
        </header>

        {/* SECTION 1 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900">
            1. Create your seller account
          </h2>
          <p className="mt-2 text-slate-600">
            Register on Mechkart using your basic details and create your seller
            profile. You can sign up with or without GST, depending on your
            business type and supported categories.
          </p>
          <ul className="mt-3 list-disc pl-5 text-slate-600">
            <li>Basic business and contact details</li>
            <li>GST or non-GST onboarding flow</li>
            <li>Store name and seller preferences</li>
          </ul>
        </section>

        {/* SECTION 2 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900">
            2. Complete verification
          </h2>
          <p className="mt-2 text-slate-600">
            Submit required KYC and business documents. Verification ensures
            platform trust, enables shipping, and allows timely payouts.
          </p>
          <ul className="mt-3 list-disc pl-5 text-slate-600">
            <li>Identity and address verification</li>
            <li>Bank account details for settlements</li>
            <li>Category-wise approval if applicable</li>
          </ul>
        </section>

        {/* SECTION 3 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900">
            3. List your products
          </h2>
          <p className="mt-2 text-slate-600">
            Add products with accurate information so customers can easily
            discover and purchase them.
          </p>
          <ul className="mt-3 list-disc pl-5 text-slate-600">
            <li>Product name, images, and description</li>
            <li>Price, stock, and variants</li>
            <li>Shipping weight and dimensions</li>
          </ul>
        </section>

        {/* SECTION 4 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900">
            4. Receive and manage orders
          </h2>
          <p className="mt-2 text-slate-600">
            Once your products go live, customers can place orders. All orders
            are visible in your seller dashboard.
          </p>
          <ul className="mt-3 list-disc pl-5 text-slate-600">
            <li>Order notifications and status tracking</li>
            <li>Easy order processing workflow</li>
            <li>Invoice and label generation</li>
          </ul>
        </section>

        {/* SECTION 5 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900">
            5. Ship orders to customers
          </h2>
          <p className="mt-2 text-slate-600">
            Pack the order securely and ship using Mechkart’s integrated courier
            partners.
          </p>
          <ul className="mt-3 list-disc pl-5 text-slate-600">
            <li>Courier pickup and tracking</li>
            <li>Shipping status updates</li>
            <li>Delivery confirmation</li>
          </ul>
        </section>

        {/* SECTION 6 */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-900">
            6. Get paid for your sales
          </h2>
          <p className="mt-2 text-slate-600">
            After successful delivery and return windows, payouts are settled
            directly to your registered bank account.
          </p>
          <ul className="mt-3 list-disc pl-5 text-slate-600">
            <li>Transparent settlement reports</li>
            <li>Commission and fee breakdown</li>
            <li>Scheduled payout cycles</li>
          </ul>
        </section>

        {/* CTA (VERY SIMPLE) */}
        <div className="border-t border-slate-200 pt-8">
          <p className="text-slate-600">
            Ready to start selling on Mechkart?
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/start-selling"
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Start Selling
            </Link>
            <Link
              href="/pricing-and-commission"
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
