import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
          {/* Copyright */}
          <p className="text-xs text-slate-500">
            © {year} Mechkart. All rights reserved.
          </p>

          {/* Links */}
          <div className="flex gap-4 text-xs">
            <Link
              href="/privacy-policy"
              className="text-slate-500 hover:text-slate-900"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-slate-500 hover:text-slate-900"
            >
              Terms
            </Link>
            <Link
              href="/shipping-and-returns"
              className="text-slate-500 hover:text-slate-900"
            >
              Shipping
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
