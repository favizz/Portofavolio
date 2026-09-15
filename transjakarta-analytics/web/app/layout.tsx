import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TransJakarta Network Analytics",
  description:
    "Real service-frequency, coverage, and transfer-network analysis built on TransJakarta's own official GTFS feed.",
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/map", label: "Map" },
  { href: "/headway", label: "Service Frequency" },
  { href: "/network", label: "Transfer Network" },
  { href: "/capacity", label: "Capacity Priority" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <header className="border-b border-neutral-800 sticky top-0 bg-neutral-950/90 backdrop-blur z-50">
          <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
            <Link href="/" className="font-semibold text-sm tracking-tight">
              TransJakarta Network Analytics
            </Link>
            <nav className="flex gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 rounded-md text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-6xl w-full mx-auto px-5 py-8">{children}</main>
        <footer className="border-t border-neutral-900 py-6">
          <div className="max-w-6xl mx-auto px-5 text-xs text-neutral-500">
            Built on TransJakarta&apos;s real, official GTFS feed (gtfs.transjakarta.co.id) — 240 routes, 8,091 stops.
            Not affiliated with or endorsed by TransJakarta.
          </div>
        </footer>
      </body>
    </html>
  );
}
