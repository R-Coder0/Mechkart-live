// app/(website)/layout.tsx
import "@/app/globals.css";
import { ReactNode } from "react";
import { WebsiteHeader } from "@/components/website/Header";
import Footer from "@/components/website/Footer";
import CategoryBar from "@/components/website/CategoryBar";
export const dynamic = "force-dynamic";

export default function WebsiteLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen bg-white">
        <WebsiteHeader />
        <CategoryBar/>
        <main>{children}</main>
        <Footer/>
      </body>
    </html>
  );
}
