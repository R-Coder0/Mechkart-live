// app/(vendor)/layout.tsx
import "@/styles/vendor.css";
import { ReactNode } from "react";

export default function VendorLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-purple-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
