import Link from "next/link";
import { api } from "@/lib/api";

// This dashboard's entire point is live data from the API - without this,
// Next.js would statically prerender the page at build time and freeze
// the numbers from whenever `next build` last ran.
export const dynamic = "force-dynamic";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-neutral-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-neutral-600 mt-2">{sub}</div>}
    </div>
  );
}

export default async function OverviewPage() {
  const [routes, headway, coverage] = await Promise.all([
    api.routes(),
    api.headwaySummary(),
    api.coverageSummary(),
  ]);

  const totalTrips = routes.reduce((sum, r) => sum + r.trip_count, 0);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">How it works</h1>
        <p className="text-neutral-400 mt-2 max-w-2xl text-sm leading-relaxed">
          Every number below is computed directly from TransJakarta&apos;s own real, currently-published
          GTFS feed — not synthetic or illustrative data. This tool answers a real planning question:
          where is the network well-served, and where are the frequency and coverage gaps?
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Routes" value={routes.length.toString()} />
        <StatCard label="Scheduled trips" value={totalTrips.toLocaleString()} />
        <StatCard
          label="Meet frequent-service standard"
          value={`${headway.routesMeetingStandard}/${headway.routesWithFrequencyData}`}
          sub={headway.standardLabel}
        />
        <StatCard
          label="Area within walking distance of a stop"
          value={coverage.computed ? `${coverage.coveragePct}%` : "—"}
          sub={coverage.computed ? coverage.standardLabel : coverage.message}
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Link
          href="/map"
          className="rounded-xl border border-neutral-800 p-5 hover:border-neutral-600 transition-colors"
        >
          <div className="font-medium mb-1">Map</div>
          <div className="text-sm text-neutral-400">
            All 8,091 real stops plotted, plus the computed coverage grid.
          </div>
        </Link>
        <Link
          href="/headway"
          className="rounded-xl border border-neutral-800 p-5 hover:border-neutral-600 transition-colors"
        >
          <div className="font-medium mb-1">Service Frequency</div>
          <div className="text-sm text-neutral-400">
            Every route ranked by real headway, flagged against a frequent-service standard.
          </div>
        </Link>
        <Link
          href="/network"
          className="rounded-xl border border-neutral-800 p-5 hover:border-neutral-600 transition-colors"
        >
          <div className="font-medium mb-1">Transfer Network</div>
          <div className="text-sm text-neutral-400">
            Which routes share stops (and how much) — the real transfer graph.
          </div>
        </Link>
        <Link
          href="/capacity"
          className="rounded-xl border border-neutral-800 p-5 hover:border-neutral-600 transition-colors"
        >
          <div className="font-medium mb-1">Capacity Priority</div>
          <div className="text-sm text-neutral-400">
            Routes that are both infrequent and crowded, from real headways plus MPB-OMS occupancy.
          </div>
        </Link>
        <Link
          href="/fleet"
          className="rounded-xl border border-neutral-800 p-5 hover:border-neutral-600 transition-colors"
        >
          <div className="font-medium mb-1">Fleet View</div>
          <div className="text-sm text-neutral-400">
            The monitored buses on their real route paths, positions simulated from the real schedule.
          </div>
        </Link>
      </div>
    </div>
  );
}
