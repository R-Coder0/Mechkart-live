"use client";

export default function ReturnsAndRefundsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Cancellation, Returns & Refunds
      </h1>

      <p className="text-sm text-gray-600 mb-8">Last updated: January 2025</p>

      <div className="space-y-8 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            1. Overview
          </h2>
          <p>
            We aim to ensure a smooth shopping experience at <strong>Country Home</strong>.
            This policy explains the rules for order cancellation, returns, replacements,
            and refunds. By placing an order, you agree to the terms below.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            2. Order Cancellation
          </h2>
          <p>
            You can request cancellation only before the order is shipped/dispatch.
            Once shipped, cancellation is not guaranteed. If cancellation is accepted,
            refunds (if applicable) will be initiated to the original payment method.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            3. Return Eligibility
          </h2>
          <p>
            Returns are accepted only for eligible products and within the permitted
            return window shown on the product page or order details. To be eligible,
            items must be:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Unused, unwashed, and in original condition</li>
            <li>With original packaging, tags, and accessories (if any)</li>
            <li>Accompanied by invoice / proof of purchase</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            4. Non-Returnable / Non-Refundable Items
          </h2>
          <p>
            Certain items may not be eligible for return or refund due to hygiene,
            safety, or regulatory reasons. Such exclusions (if any) will be mentioned
            on the product page and/or at checkout.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            5. Return Reasons Covered
          </h2>
          <p>We typically support returns/refunds for:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Damaged product received</li>
            <li>Wrong item delivered</li>
            <li>Missing item(s) in the package</li>
            <li>Defective product (manufacturing defect)</li>
          </ul>
          <p className="mt-2">
            For damage/defect/missing items, please report within <strong>24 hours</strong>{" "}
            of delivery with unboxing photos/videos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            6. How to Request a Return
          </h2>
          <p>
            You can initiate a return request from your account under “My Orders”
            (if available) or by contacting support with:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Order ID / Order Code</li>
            <li>Product name and quantity</li>
            <li>Reason for return</li>
            <li>Photos/videos (mandatory for damage/defect/missing)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            7. Return Pickup & Inspection
          </h2>
          <p>
            If return pickup is approved, our courier partner will attempt pickup at your
            address. After pickup, the item may be inspected to verify eligibility.
            If the product does not meet the policy conditions, the return may be rejected
            and shipped back to you.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            8. Refund Process & Timelines
          </h2>
          <p>
            Once the return is approved (or cancellation is confirmed), refunds are initiated
            to the original payment method. Typical timelines:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>UPI / Cards / Net Banking: 3–7 working days</li>
            <li>COD Orders: Refund to bank account after verification</li>
          </ul>
          <p className="mt-2">
            Timelines may vary depending on banks/payment providers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            9. Replacement (If Applicable)
          </h2>
          <p>
            In certain cases, replacement may be offered instead of refund (subject to stock availability).
            If replacement is not available, we will process a refund as per policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            10. Contact Support
          </h2>
          <p>
            For return/refund related queries, please contact us with your order details.
          </p>

          <div className="mt-3 rounded-2xl border bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">Country Home Support</p>
            <p className="mt-1">
              Email: <span className="font-medium">contact@Mechkart.co.in</span>
              <br />
              Phone: <span className="font-medium">+91 98795 11957</span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
