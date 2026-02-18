// app/(website)/layout.tsx
import "@/app/globals.css";
import { ReactNode } from "react";
import { WebsiteHeader } from "@/components/website/Header";
import Footer from "@/components/website/Footer";
import CategoryBar from "@/components/website/CategoryBar";
import WhatsAppFloatingButton from "@/components/website/FloatingButton";
import TopContactBar from "@/components/website/TopBar";
export const dynamic = "force-dynamic";

export default function WebsiteLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen bg-white">
        <TopContactBar/>
        <WebsiteHeader />
        <CategoryBar/>
        <main>{children}</main>
        {/* <WhatsAppFloatingButton/> */}
        <Footer/>
      </body>
    </html>
  );
}
