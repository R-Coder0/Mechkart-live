import "@/app/globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Mechkart India | Best E-commerce Platform",
  description:
    "Shop top-quality products across categories at Mechkart India. Fast delivery, secure payments, and best deals guaranteed. Call +91 62607 04024 for support.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
  