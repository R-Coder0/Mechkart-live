/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";

export default function VendorSignupPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/vendors/register`,
        {
          method: "POST",
          
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Registration failed");
      }

      setMessage("✅ Registration submitted. Please check your email.");
      form.reset();
    } catch (err: any) {
      setMessage(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Vendor Registration
          </h1>
          <p className="text-gray-500 mt-2">
            Become a verified seller on our multivendor marketplace
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {message && (
            <div className="mb-6 text-center text-sm font-medium text-red-600 bg-red-50 border border-red-200 py-2 rounded">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-10">
            {/* BASIC INFO */}
            <Section title="Basic Information">
              <Grid>
                <Input name="firstName" label="First Name" required />
                <Input name="lastName" label="Last Name" required />
                <Input
                  name="email"
                  type="email"
                  label="Email Address"
                  required
                />
                <Input name="phone" label="Phone Number" required />
              </Grid>
            </Section>

            {/* PASSWORD */}
            <Section title="Security Details">
              <Grid>
                <Input
                  name="password"
                  type="password"
                  label="Password"
                  required
                />
                <Input
                  name="confirmPassword"
                  type="password"
                  label="Confirm Password"
                  required
                />
              </Grid>
            </Section>

            {/* KYC */}
            <Section title="KYC Verification">
              <Grid>
                <Input name="panNumber" label="PAN Number" required />
                <FileInput
                  name="panImage"
                  label="Upload PAN Image"
                  required
                />
              </Grid>
            </Section>

            {/* COMPANY */}
            <Section title="Company Information">
              <Grid>
                <Input
                  name="companyName"
                  label="Company Name"
                  required
                />
                <Input
                  name="companyEmail"
                  type="email"
                  label="Company Email"
                />
                <Input name="gst" label="GST Number (Optional)" />
              </Grid>
            </Section>

            {/* PICKUP ADDRESS */}
            <Section title="Pickup Address">
              <div className="space-y-4">
                <Grid>
                  <Input
                    name="pickupName"
                    label="Pickup Contact Name"
                    required
                  />
                  <Input
                    name="pickupPhone"
                    label="Pickup Phone Number"
                    required
                  />
                </Grid>

                <Input
                  name="pickupAddress"
                  label="Complete Address"
                  required
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input name="pickupCity" label="City" required />
                  <Input name="pickupState" label="State" required />
                  <Input name="pickupPincode" label="Pincode" required />
                </div>
              </div>
            </Section>

            {/* PAYMENT */}
            <Section title="Payment Details">
              <Grid>
                <Input name="upiId" label="UPI ID" />
                <Input
                  name="bankAccount"
                  label="Bank Account Number"
                />
                <Input name="ifsc" label="IFSC Code" />
                <FileInput
                  name="qrImage"
                  label="UPI QR Code (Optional)"
                />
              </Grid>
            </Section>

            {/* SUBMIT */}
            <button
              disabled={loading}
              className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-900 transition disabled:opacity-60"
            >
              {loading ? "Submitting..." : "Register as Vendor"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* -------------------- */
/* REUSABLE COMPONENTS */
/* -------------------- */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-700 mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {children}
    </div>
  );
}

function Input({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-600">
        {label}
      </label>
      <input
        {...props}
        className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
      />
    </div>
  );
}

function FileInput({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-600">
        {label}
      </label>
      <input
        {...props}
        type="file"
        className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
      />
    </div>
  );
}
