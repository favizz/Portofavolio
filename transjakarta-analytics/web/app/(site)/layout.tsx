import Link from "next/link";

const NAV = [
  { href: "/", label: "Demo" },
  { href: "/overview", label: "How it works" },
];

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-neutral-800 sticky top-0 bg-neutral-950/90 backdrop-blur z-50">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold text-sm tracking-tight">
            CrowdEase
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
    </>
  );
}
