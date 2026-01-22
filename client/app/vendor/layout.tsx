// app/(website)/layout.tsx
import "@/app/globals.css";
import SupplierHeader from "@/components/vendor/header";
import { ReactNode } from "react";
export const dynamic = "force-dynamic";

export default function WebsiteLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen bg-white">
      <SupplierHeader/>
        <main>{children}</main>

      </body>
    </html>
  );
}
