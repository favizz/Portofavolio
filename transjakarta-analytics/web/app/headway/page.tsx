import { api } from "@/lib/api";
import HeadwayChart from "@/components/HeadwayChart";

export const dynamic = "force-dynamic";

export default async function HeadwayPage() {
  const data = await api.headwaySummary();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Service Frequency</h1>
        <p className="text-neutral-400 mt-2 text-sm max-w-2xl">
          Real headway computed from every <code>frequencies.txt</code> entry in the current feed,
          per route. {data.standardLabel}. <strong>{data.routesBelowStandard} of {data.routesWithFrequencyData}</strong> routes
          with defined frequency data fall below that standard.
        </p>
      </div>
      <HeadwayChart data={data} />
    </div>
  );
}
