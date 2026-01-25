"use client";

export default function PaymentsHelpPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Payments
      </h1>

      <p className="text-sm text-gray-600 mb-8">
        Last updated: January 2025
      </p>

      <div className="space-y-8 text-sm text-gray-700 leading-relaxed">
        {/* 1 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            1. Accepted Payment Methods
          </h2>
          <p>
            Mechkart offers multiple secure and convenient payment options to
            make your shopping experience smooth. You can choose from the
            following methods at checkout:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>UPI (Google Pay, PhonePe, Paytm, BHIM, etc.)</li>
            <li>Debit Cards</li>
            <li>Credit Cards</li>
            <li>Net Banking</li>
            <li>Cash on Delivery (COD) – available on select locations/products</li>
          </ul>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            2. Payment Security
          </h2>
          <p>
            All online payments on Mechkart are processed through secure and
            trusted payment gateway partners. We do not store your card details,
            CVV, or banking credentials on our servers.
          </p>
          <p className="mt-2">
            Please never share your OTP, UPI PIN, or card details with anyone,
            including people claiming to represent Mechkart.
          </p>
        </section>

        {/* 3 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            3. Cash on Delivery (COD)
          </h2>
          <p>
            Cash on Delivery may be available for certain products and delivery
            locations. Availability of COD is determined automatically at
            checkout based on your pincode and order value.
          </p>
          <p className="mt-2">
            Please ensure someone is available at the delivery address to make
            the payment at the time of delivery.
          </p>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            4. Payment Failures
          </h2>
          <p>
            If your payment fails but the amount is debited from your bank
            account, the amount is usually reversed automatically by your bank
            within 3–7 working days.
          </p>
          <p className="mt-2">
            In case of repeated failures, we recommend trying a different
            payment method or contacting your bank for assistance.
          </p>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            5. Refunds
          </h2>
          <p>
            Refunds for cancelled or returned orders are processed to the
            original mode of payment used at checkout.
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>UPI / Cards / Net Banking: 3–7 working days</li>
            <li>Cash on Delivery: Refund processed to bank account after verification</li>
          </ul>
          <p className="mt-2">
            Refund timelines may vary depending on your bank or payment provider.
          </p>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            6. Price & Payment Disputes
          </h2>
          <p>
            If you notice any discrepancy in pricing or payment amount, please
            contact our support team immediately with your order details. We
            will review and resolve the issue at the earliest.
          </p>
        </section>

        {/* 7 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            7. Fraud Prevention
          </h2>
          <p>
            Mechkart reserves the right to cancel or hold orders if a
            transaction appears suspicious or fraudulent. Additional
            verification may be requested in such cases to protect customers.
          </p>
        </section>

        {/* 8 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            8. Need Help?
          </h2>
          <p>
            If you have any questions regarding payments, refunds, or billing,
            feel free to reach out to us.
          </p>

          <div className="mt-3 rounded-2xl border bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">Contact Support</p>
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
