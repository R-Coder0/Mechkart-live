/* eslint-disable @next/next/no-img-element */
"use client";

import { Facebook, Instagram, Youtube, Twitter } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full bg-[#212121] text-gray-300 text-[14px]">
      <div className="max-w-[1700px] mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 px-6 py-10 border-b border-gray-700">
        {/* About */}
        <div>
          <h3 className="text-gray-400 text-[13px] font-semibold uppercase mb-3 tracking-wide">
            About
          </h3>
          <ul className="space-y-2">
            <li><Link href="/contact" className="hover:underline font-medium text-white">Contact Us</Link></li>
            <li><Link href="#" className="hover:underline font-medium text-white">About Us</Link></li>
            <li><Link href="#" className="hover:underline font-medium text-white">Careers</Link></li>
            {/* <li><Link href="#" className="hover:underline font-medium text-white">Mechkart Stories</Link></li>
            <li><Link href="#" className="hover:underline font-medium text-white">Press</Link></li>
            <li><Link href="#" className="hover:underline font-medium text-white">Corporate Information</Link></li> */}
          </ul>
        </div>

        {/* Group Companies */}
        {/* <div>
          <h3 className="text-gray-400 text-[13px] font-semibold uppercase mb-3 tracking-wide">
            Group Companies
          </h3>
          <ul className="space-y-2">
            <li><Link href="#" className="hover:underline font-medium text-white">AutoKart</Link></li>
            <li><Link href="#" className="hover:underline font-medium text-white">StyleKart</Link></li>
            <li><Link href="#" className="hover:underline font-medium text-white">TechTrip</Link></li>
          </ul>
        </div> */}

        {/* Help */}
        <div>
          <h3 className="text-gray-400 text-[13px] font-semibold uppercase mb-3 tracking-wide">
            Help
          </h3>
          <ul className="space-y-2">
            <li><Link href="/help/payments" className="hover:underline font-medium text-white">Payments</Link></li>
            <li><Link href="/help/shipping" className="hover:underline font-medium text-white">Shipping</Link></li>
            <li><Link href="/help/cancellation-return" className="hover:underline font-medium text-white">Cancellation & Returns</Link></li>
            <li><Link href="/help/Faqs" className="hover:underline font-medium text-white">FAQ</Link></li>
          </ul>
        </div>

        {/* Policy */}
        <div>
          <h3 className="text-gray-400 text-[13px] font-semibold uppercase mb-3 tracking-wide">
            Consumer Policy
          </h3>
          <ul className="space-y-2">
            {/* <li><Link href="#" className="hover:underline font-medium text-white">Cancellation & Returns</Link></li> */}
            <li><Link href="/consumer-policies/t&c" className="hover:underline font-medium text-white">Terms Of Use</Link></li>
            <li><Link href="/consumer-policies/security" className="hover:underline font-medium text-white">Security</Link></li>
            <li><Link href="/consumer-policies/privacy" className="hover:underline font-medium text-white">Privacy</Link></li>
            <li><Link href="/consumer-policies/return&refund" className="hover:underline font-medium text-white">Returns & Refund</Link></li>
            <li><Link href="#" className="hover:underline font-medium text-white">Sitemap</Link></li>
          </ul>
        </div>

        {/* Mail Us */}
        <div className="lg:pl-6 border-l border-gray-700 hidden lg:block">
          <h3 className="text-gray-400 text-[13px] font-semibold uppercase mb-2 tracking-wide">
            Mail Us
          </h3>
          <Link href="mailto:contact@Mechkart.co.in"> contact@Mechkart.co.in</Link>
          <h3 className="text-gray-400 text-[13px] font-semibold uppercase mt-3 mb-2 tracking-wide">
            Contact Us
          </h3>
          <Link href="tel: +916260704024">  +91 62607-04024</Link>

          <div className="mt-4">
            {/* <h4 className="text-gray-400 text-[13px] font-semibold mb-2">Warehouse:</h4> */}
            
          </div>
          <div className="mt-4">
            <h4 className="text-gray-400 text-[13px] font-semibold mb-2">Social:</h4>
            <div className="flex items-center space-x-4 text-gray-300">
              <Link href="#" aria-label="Facebook" className="hover:text-white"><Facebook size={18} /></Link>
              <Link href="#" aria-label="X" className="hover:text-white"><Twitter size={18} /></Link>
              <Link href="#" aria-label="YouTube" className="hover:text-white"><Youtube size={18} /></Link>
              <Link href="#" aria-label="Instagram" className="hover:text-white"><Instagram size={18} /></Link>
            </div>
          </div>

        </div>

        {/* Office Address */}
        <div className="hidden lg:block">
          <h3 className="text-gray-400 text-[13px] font-semibold uppercase mb-3 tracking-wide">
            Registered Office Address
          </h3>
          <p className="text-gray-300 leading-relaxed text-[13px]">
            Mechkart Private Limited,
            <br /> Pankaj Palace Shop No.7
            <br />  Near City Palace Mall Burhanpur
            <br /> Madhya Pradesh, 450331, India
            <br />
            CIN: U51109KA2024PTC099999
            <br />
            Telephone:{" "}
            <Link
              href="#"
              className="text-[#0077B6] hover:underline"
            >
              +91 62607-04024
            </Link>
          </p>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-700 px-6 py-3 flex flex-col md:flex-row items-center justify-between text-[13px] text-gray-400 gap-3">
        <div className="flex flex-wrap items-center justify-center gap-6">
          <p className="text-gray-400">
            © 2025 <span className="text-white font-medium">Mechkart.co.in</span>
          </p>
        </div>

        <div className="text-center md:text-right">

          <div className="flex items-center justify-center md:justify-end gap-2 mt-2">
            <img src="/payment.svg" alt="payments" className="h-5" />
          </div>
        </div>
      </div>
    </footer>
  );
}
