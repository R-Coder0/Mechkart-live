"use client";

import Link from "next/link";

export default function FAQPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">FAQ</h1>

      <p className="text-sm text-gray-600 mb-8">Last updated: January 2025</p>

      <div className="space-y-6">
        {/* Order */}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Orders</h2>

          <div className="space-y-3 text-sm text-gray-700">
            <details className="group rounded-xl border p-4">
              <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                How do I place an order?
                <span className="text-gray-400 group-open:rotate-180 transition">▾</span>
              </summary>
              <p className="mt-2 leading-relaxed text-gray-700">
                Browse products, add items to your cart, and proceed to checkout. Enter
                your delivery details and choose a payment method to confirm the order.
              </p>
            </details>

            <details className="group rounded-xl border p-4">
              <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                Can I cancel my order after placing it?
                <span className="text-gray-400 group-open:rotate-180 transition">▾</span>
              </summary>
              <p className="mt-2 leading-relaxed text-gray-700">
                You can request cancellation only before the order is shipped/dispatch.
                Once shipped, cancellation may not be possible. Please refer to our{" "}
                <Link href="/website/help/return-refund" className="text-blue-700 hover:underline">
                  Cancellation & Returns
                </Link>{" "}
                page for details.
              </p>
            </details>

            <details className="group rounded-xl border p-4">
              <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                Where can I check my order status?
                <span className="text-gray-400 group-open:rotate-180 transition">▾</span>
              </summary>
              <p className="mt-2 leading-relaxed text-gray-700">
                You can check your order status in your account under{" "}
                <Link href="/website/user/orders" className="text-blue-700 hover:underline">
                  My Orders
                </Link>
                .
              </p>
            </details>
          </div>
        </section>

        {/* Payments */}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payments</h2>

          <div className="space-y-3 text-sm text-gray-700">
            <details className="group rounded-xl border p-4">
              <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                What payment methods do you accept?
                <span className="text-gray-400 group-open:rotate-180 transition">▾</span>
              </summary>
              <p className="mt-2 leading-relaxed text-gray-700">
                We accept UPI, Debit/Credit Cards, Net Banking, and Cash on Delivery
                (COD) where available. More details are available on the{" "}
                <Link href="/website/help/payments" className="text-blue-700 hover:underline">
                  Payments
                </Link>{" "}
                page.
              </p>
            </details>

            <details className="group rounded-xl border p-4">
              <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                My payment failed but money got debited. What should I do?
                <span className="text-gray-400 group-open:rotate-180 transition">▾</span>
              </summary>
              <p className="mt-2 leading-relaxed text-gray-700">
                In most cases, banks reverse the amount automatically within 3–7
                working days. If the amount is not reversed within this time, please
                contact your bank first and then reach out to our support team with
                transaction details.
              </p>
            </details>
          </div>
        </section>

        {/* Shipping */}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipping</h2>

          <div className="space-y-3 text-sm text-gray-700">
            <details className="group rounded-xl border p-4">
              <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                How long does delivery take?
                <span className="text-gray-400 group-open:rotate-180 transition">▾</span>
              </summary>
              <p className="mt-2 leading-relaxed text-gray-700">
                Delivery timelines depend on your location and courier partner. As a
                general estimate, deliveries may take 2–10 working days. For more,
                visit our{" "}
                <Link href="/website/help/shipping" className="text-blue-700 hover:underline">
                  Shipping
                </Link>{" "}
                page.
              </p>
            </details>

            <details className="group rounded-xl border p-4">
              <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                How can I track my order?
                <span className="text-gray-400 group-open:rotate-180 transition">▾</span>
              </summary>
              <p className="mt-2 leading-relaxed text-gray-700">
                If tracking is available, you will receive details via SMS/Email, and
                you can also check updates in{" "}
                <Link href="/website/user/orders" className="text-blue-700 hover:underline">
                  My Orders
                </Link>
                .
              </p>
            </details>
          </div>
        </section>

        {/* Returns */}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Returns & Refunds</h2>

          <div className="space-y-3 text-sm text-gray-700">
            <details className="group rounded-xl border p-4">
              <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                How do I request a return?
                <span className="text-gray-400 group-open:rotate-180 transition">▾</span>
              </summary>
              <p className="mt-2 leading-relaxed text-gray-700">
                You can request a return from your order section (if available) or by
                contacting support with your Order ID, product details, and reason.
                Please review our{" "}
                <Link href="/website/help/return-refund" className="text-blue-700 hover:underline">
                  Cancellation, Returns & Refunds
                </Link>{" "}
                policy.
              </p>
            </details>

            <details className="group rounded-xl border p-4">
              <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                When will I get my refund?
                <span className="text-gray-400 group-open:rotate-180 transition">▾</span>
              </summary>
              <p className="mt-2 leading-relaxed text-gray-700">
                Refunds are typically processed within 3–7 working days after approval.
                Timelines may vary depending on bank/payment provider.
              </p>
            </details>
          </div>
        </section>

        {/* Support */}
        <section className="rounded-2xl border bg-gray-50 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Need help?</h2>
          <p className="text-sm text-gray-700">
            If you still have questions, contact us:
          </p>

          <div className="mt-3 text-sm text-gray-800">
            <div>
              Email:{" "}
              <a className="font-semibold text-blue-700 hover:underline" href="mailto:contact@countryhome.co.in">
                contact@countryhome.co.in
              </a>
            </div>
            <div className="mt-1">
              Phone:{" "}
              <a className="font-semibold text-blue-700 hover:underline" href="tel:+919879511957">
                +91 98795 11957
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
