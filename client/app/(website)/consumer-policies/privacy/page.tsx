"use client";

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>

      <p className="text-sm text-gray-600 mb-8">Last updated: January 2025</p>

      <div className="space-y-8 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            1. Overview
          </h2>
          <p>
            This Privacy Policy describes how <strong>Mechkart</strong>{" "}
            (“we”, “us”, “our”) collects, uses, shares, and protects your
            personal information when you use our website and services. By using
            our platform, you consent to the practices described in this policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            2. Information We Collect
          </h2>
          <p>We may collect the following categories of information:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <strong>Identity & Contact:</strong> name, phone number, email
              address.
            </li>
            <li>
              <strong>Delivery Information:</strong> shipping address, city,
              state, pincode, landmark (if provided).
            </li>
            <li>
              <strong>Order & Transaction:</strong> products purchased, order
              history, invoices, payment status.
            </li>
            <li>
              <strong>Technical:</strong> IP address, browser type, device
              information, pages visited, usage data (cookies/analytics).
            </li>
            <li>
              <strong>Support:</strong> messages or information shared with our
              customer support team.
            </li>
          </ul>
          <p className="mt-3">
            We do not intentionally collect sensitive personal data unless it is
            necessary for providing our services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            3. How We Use Your Information
          </h2>
          <p>We use your information for purposes including:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Processing orders, payments, deliveries, and returns.</li>
            <li>Communicating order updates and service-related information.</li>
            <li>Providing customer support and resolving disputes.</li>
            <li>Improving our website, products, and user experience.</li>
            <li>
              Preventing fraud, enforcing our Terms, and maintaining platform
              security.
            </li>
            <li>Complying with legal and regulatory obligations.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            4. Cookies & Tracking Technologies
          </h2>
          <p>
            We may use cookies and similar technologies to enhance your browsing
            experience, remember preferences, and analyze traffic. You can
            control cookies through your browser settings. Disabling cookies may
            impact some site features.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            5. Sharing of Information
          </h2>
          <p>
            We may share your information only as necessary, including with:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <strong>Logistics/Delivery Partners</strong> for shipping your
              orders.
            </li>
            <li>
              <strong>Payment Gateway Partners</strong> to process payments
              securely (we do not store full card details).
            </li>
            <li>
              <strong>Service Providers</strong> (hosting, analytics, customer
              support tools) who work under confidentiality obligations.
            </li>
            <li>
              <strong>Legal/Regulatory Authorities</strong> when required by
              law, court order, or to protect our rights.
            </li>
          </ul>
          <p className="mt-3">
            We do not sell your personal information to third parties.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            6. Data Security
          </h2>
          <p>
            We implement reasonable security measures to protect your
            information from unauthorized access, misuse, loss, alteration, or
            disclosure. However, no online system is completely secure. Please
            protect your account credentials and do not share OTPs/passwords.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            7. Data Retention
          </h2>
          <p>
            We retain your information for as long as necessary to provide
            services, comply with legal obligations, resolve disputes, and
            enforce agreements. When no longer required, we take reasonable
            steps to delete or anonymize the data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            8. Your Choices & Rights
          </h2>
          <p>
            You may request access, correction, or deletion of your personal
            information, subject to legal and operational limitations. You may
            also opt out of non-essential marketing communications where
            applicable.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            9. Third-Party Links
          </h2>
          <p>
            Our website may contain links to third-party websites. We are not
            responsible for the privacy practices of those sites. Please review
            their policies before providing any information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            10. Children’s Privacy
          </h2>
          <p>
            Our services are not directed to children under 18. We do not
            knowingly collect personal information from minors.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            11. Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. Updates will be
            posted on this page with a revised “Last updated” date.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            12. Contact Us
          </h2>
          <p>
            For questions or requests related to this Privacy Policy, contact us
            at:
          </p>

          <div className="mt-3 rounded-2xl border bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">Mechkart</p>
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
