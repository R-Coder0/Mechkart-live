"use client";

export default function CancellationAndReturnsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Cancellation & Returns
      </h1>

      <p className="text-sm text-gray-600 mb-8">
        Last updated: January 2025
      </p>

      <div className="space-y-8 text-sm text-gray-700 leading-relaxed">
        {/* 1 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            1. Overview
          </h2>
          <p>
            At <strong>Country Home</strong>, we strive to provide a smooth and
            transparent shopping experience. This policy explains how order
            cancellations, returns, replacements, and refunds are handled. By
            placing an order on our website, you agree to the terms outlined
            below.
          </p>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            2. Order Cancellation
          </h2>
          <p>
            You may request cancellation of an order only before it is shipped
            or dispatched. Once an order has been shipped, cancellation requests
            may not be accepted.
          </p>
          <p className="mt-2">
            If a cancellation is approved, any prepaid amount will be refunded
            to the original payment method as per applicable timelines.
          </p>
        </section>

        {/* 3 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            3. Return Eligibility
          </h2>
          <p>
            Returns are accepted only for eligible products and within the
            return window mentioned on the product page or order details. To be
            eligible for a return:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>The product must be unused and in original condition</li>
            <li>Original packaging, tags, and accessories must be intact</li>
            <li>Invoice or proof of purchase must be provided</li>
          </ul>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            4. Non-Returnable Items
          </h2>
          <p>
            Certain products may be non-returnable due to hygiene, safety, or
            regulatory reasons. Such items will be clearly marked as
            non-returnable on the product page or at checkout.
          </p>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            5. Valid Reasons for Returns
          </h2>
          <p>Returns or replacements are generally accepted in cases of:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Damaged product received</li>
            <li>Incorrect product delivered</li>
            <li>Missing items in the package</li>
            <li>Manufacturing defects</li>
          </ul>
          <p className="mt-2">
            Such issues must be reported within <strong>24 hours</strong> of
            delivery, along with supporting photos or unboxing videos.
          </p>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            6. Return Request Process
          </h2>
          <p>
            You can request a return through your account under “My Orders”
            (where available) or by contacting our support team with:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Order ID / Order Code</li>
            <li>Product details</li>
            <li>Reason for return</li>
            <li>Photos or videos (mandatory for damage/defect cases)</li>
          </ul>
        </section>

        {/* 7 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            7. Return Pickup & Inspection
          </h2>
          <p>
            Once a return request is approved, a pickup may be arranged through
            our courier partners. After pickup, the returned item may undergo
            inspection to verify eligibility. If the item does not meet return
            conditions, the return may be rejected and sent back to you.
          </p>
        </section>

        {/* 8 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            8. Refund Timelines
          </h2>
          <p>
            Refunds are processed after successful cancellation or return
            approval. Typical timelines are:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>UPI / Debit / Credit Cards / Net Banking: 3–7 working days</li>
            <li>Cash on Delivery (COD): Refund to bank account after verification</li>
          </ul>
          <p className="mt-2">
            Actual timelines may vary depending on your bank or payment provider.
          </p>
        </section>

        {/* 9 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            9. Replacement Policy
          </h2>
          <p>
            In certain cases, a replacement may be offered instead of a refund,
            subject to product availability. If replacement is not possible, a
            refund will be processed as per this policy.
          </p>
        </section>

        {/* 10 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            10. Contact Support
          </h2>
          <p>
            For any questions regarding cancellations, returns, or refunds,
            please contact our support team with your order details.
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
