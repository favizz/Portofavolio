import { api } from "@/lib/api";
import NetworkGraphView from "@/components/NetworkGraph";

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const graph = await api.networkGraph(3, 30);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transfer Network</h1>
        <p className="text-neutral-400 mt-2 text-sm max-w-2xl">
          Two routes are connected if they share at least {graph.minSharedStops} real stops — a genuine
          transfer point, computed from the feed&apos;s own stop_times data. Showing the {graph.topN} most-connected
          of {graph.totalRoutesConsidered} routes that have any qualifying connection (240 routes total would be
          too dense to read). Teal-bordered nodes are the top 6 transfer hubs by connection count.
        </p>
      </div>
      <NetworkGraphView data={graph} />
    </div>
  );
}
