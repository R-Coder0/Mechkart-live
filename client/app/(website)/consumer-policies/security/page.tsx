"use client";

export default function SecurityPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Security Policy</h1>

      <p className="text-sm text-gray-600 mb-8">
        Last updated: January 2025
      </p>

      <div className="space-y-8 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            1. Overview
          </h2>
          <p>
            At <strong>Mechkart</strong>, we take the security of your
            personal information and transactions seriously. This Security
            Policy explains the measures we use to help protect your data and
            how you can help keep your account secure.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            2. Secure Communication
          </h2>
          <p>
            We use industry-standard security measures such as HTTPS/TLS to help
            protect data transmitted between your browser and our servers. You
            should always ensure the website URL begins with “https://” before
            entering any sensitive information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            3. Payment Security
          </h2>
          <p>
            We do not store your full card details on our servers. Payments are
            processed through secure, compliant payment gateway partners. Please
            follow on-screen instructions carefully while making payments and do
            not share OTPs or banking credentials with anyone.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            4. Data Access & Controls
          </h2>
          <p>
            Access to personal data is restricted to authorized personnel only
            and is provided strictly on a need-to-know basis. We also apply
            reasonable safeguards to reduce the risk of unauthorized access,
            alteration, disclosure, or destruction of data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            5. Account Protection
          </h2>
          <p>
            You are responsible for maintaining the confidentiality of your
            login details. We recommend:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Using a strong, unique password.</li>
            <li>Not sharing your password or OTP with anyone.</li>
            <li>Logging out from shared/public devices.</li>
            <li>Updating your password if you suspect unauthorized activity.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            6. Fraud Prevention & Suspicious Activity
          </h2>
          <p>
            We may monitor transactions for unusual or suspicious behavior and
            may temporarily hold or cancel orders if fraud is suspected. If we
            detect potential unauthorized access to your account, we may request
            additional verification.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            7. Device & Browser Safety
          </h2>
          <p>
            Your device security also matters. Please keep your operating
            system, browser, and antivirus up to date. Avoid using unknown
            networks when making purchases, and never save card or password
            information on public devices.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            8. Security Limitations
          </h2>
          <p>
            While we implement reasonable safeguards, no method of transmission
            over the internet is 100% secure. Mechkart cannot guarantee
            absolute security; however, we continuously improve our security
            practices to reduce risks.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            9. Reporting Security Issues
          </h2>
          <p>
            If you believe your account has been compromised or you have
            identified a potential security vulnerability, please notify us
            immediately. Provide as much detail as possible so we can investigate.
          </p>

          <div className="mt-3 rounded-2xl border bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">Contact Security Team</p>
            <p className="mt-1">
              Email: <span className="font-medium">contact@Mechkart.co.in</span>
              <br />
              Phone: <span className="font-medium">+91 98795 11957</span>
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            10. Policy Updates
          </h2>
          <p>
            We may update this Security Policy from time to time to reflect
            improvements in our practices or changes in legal requirements. The
            updated version will be posted on this page with a revised “Last
            updated” date.
          </p>
        </section>
      </div>
    </div>
  );
}
