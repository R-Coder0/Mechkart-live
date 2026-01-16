"use client";

export default function ShippingHelpPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Shipping</h1>

      <p className="text-sm text-gray-600 mb-8">Last updated: January 2025</p>

      <div className="space-y-8 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            1. Shipping Coverage
          </h2>
          <p>
            We currently ship to select locations across India. Shipping
            availability and delivery timelines are shown at checkout based on
            your pincode.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            2. Order Processing Time
          </h2>
          <p>
            Orders are usually processed within 24–48 working hours after
            confirmation (excluding Sundays and public holidays). Processing may
            take longer during high-demand periods, sales, or unforeseen events.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            3. Estimated Delivery Timelines
          </h2>
          <p>
            Delivery timelines depend on your location and courier partner. As a
            general guide:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Metro / Tier-1 cities: 2–5 working days</li>
            <li>Other cities / towns: 3–7 working days</li>
            <li>Remote areas: 5–10 working days</li>
          </ul>
          <p className="mt-2">
            These are estimated timelines and may vary due to logistics,
            weather, strikes, or other circumstances beyond our control.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            4. Shipping Charges
          </h2>
          <p>
            Shipping charges (if applicable) are calculated at checkout based on
            order value, product type, and delivery location. Any shipping fees
            will be clearly displayed before you complete payment.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            5. Order Tracking
          </h2>
          <p>
            Once your order is shipped, you may receive tracking details via
            SMS/Email (if available). You can also check order status in your
            account under “My Orders”.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            6. Delivery Attempts
          </h2>
          <p>
            Our courier partners generally attempt delivery 2–3 times. If a
            delivery fails due to incorrect address, customer unavailability, or
            refusal to accept the package, the shipment may be returned to us.
            In such cases, re-shipping charges may apply.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            7. Address Changes
          </h2>
          <p>
            Address changes can only be requested before the order is shipped.
            Once shipped, changes may not be possible. Please contact support as
            early as possible with your order details.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            8. Damaged / Missing Packages
          </h2>
          <p>
            If you receive a package that appears damaged, tampered, or missing
            items, please contact support within 24 hours of delivery with
            photos/videos and your order details. We will investigate and
            provide a suitable resolution as per our policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            9. Need Help?
          </h2>
          <p>
            For shipping-related questions, delays, or delivery support, please
            contact us.
          </p>

          <div className="mt-3 rounded-2xl border bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">Contact Support</p>
            <p className="mt-1">
              Email: <span className="font-medium">contact@countryhome.co.in</span>
              <br />
              Phone: <span className="font-medium">+91 98795 11957</span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
