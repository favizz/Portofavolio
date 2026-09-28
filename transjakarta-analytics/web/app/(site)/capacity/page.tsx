import { api } from "@/lib/api";
import { routeOccupancyFromSnapshot } from "@/lib/crowdEaseSnapshot";
import CapacityExplainer from "@/components/CapacityExplainer";

export const dynamic = "force-dynamic";

export default async function CapacityPage() {
  const headway = await api.headwaySummary();
  const occupancy = routeOccupancyFromSnapshot();

  const rows = occupancy
    .map((o) => {
      const route = headway.routes.find((r) => r.route_short_name === o.routeShortName);
      const avgHeadwayMin = route ? Math.round((parseFloat(route.avg_headway_secs) / 60) * 10) / 10 : null;
      const failsStandard = route ? !route.meets_standard : null;
      // Priority: only meaningful when the route fails the frequency
      // standard - occupancy alone isn't a capacity problem if buses are
      // already coming often enough.
      const priorityScore = failsStandard ? o.occupancyPct : 0;
      return {
        routeShortName: o.routeShortName,
        routeLongName: route?.route_long_name || "unknown",
        occupancyPct: o.occupancyPct,
        busCount: o.busCount,
        avgHeadwayMin,
        failsStandard,
        priorityScore,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const flagged = rows.filter((r) => r.priorityScore > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Capacity Priority</h1>
        <p className="text-neutral-400 mt-2 text-sm max-w-2xl">
          Combines this site&apos;s real service-frequency analysis with CrowdEase&apos;s bus-occupancy data, to flag routes that are both running infrequently and
          running crowded &mdash; a genuine capacity-planning signal, not just a frequency gap.
        </p>
      </div>

      <CapacityExplainer />

      {flagged.length > 0 ? (
        <div className="rounded-xl border border-red-900/40 bg-red-950/10 p-5">
          <div className="text-sm font-medium text-red-400 mb-1">
            {flagged.length} of 3 monitored route{flagged.length === 1 ? "" : "s"} both fail the frequency
            standard and show meaningful occupancy
          </div>
          <div className="text-xs text-neutral-400">
            These are the routes where adding service would address two problems at once.
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-teal-900/40 bg-teal-950/10 p-5 text-sm text-teal-400">
          None of CrowdEase&apos;s 3 monitored routes currently fail the frequency standard while showing high
          occupancy.
        </div>
      )}

      <div className="rounded-xl border border-neutral-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-400">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Route</th>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-right px-4 py-2 font-medium">Avg headway</th>
              <th className="text-right px-4 py-2 font-medium">Frequency standard</th>
              <th className="text-right px-4 py-2 font-medium">Occupancy (CrowdEase snapshot)</th>
              <th className="text-right px-4 py-2 font-medium">Buses monitored</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.routeShortName} className={`border-t border-neutral-900 ${r.priorityScore > 0 ? "bg-red-950/10" : ""}`}>
                <td className="px-4 py-2 font-mono text-xs">{r.routeShortName}</td>
                <td className="px-4 py-2 text-neutral-300">{r.routeLongName}</td>
                <td className="px-4 py-2 text-right">{r.avgHeadwayMin} min</td>
                <td className="px-4 py-2 text-right">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      r.failsStandard ? "bg-red-500/15 text-red-400" : "bg-teal-500/15 text-teal-400"
                    }`}
                  >
                    {r.failsStandard ? "below" : "meets"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">{r.occupancyPct}%</td>
                <td className="px-4 py-2 text-right text-neutral-500">{r.busCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
