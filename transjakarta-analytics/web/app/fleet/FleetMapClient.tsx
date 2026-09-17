"use client";

import dynamic from "next/dynamic";
import type { FleetRoute } from "@/lib/api";

// Leaflet touches `window` at module load time, so the map must never be
// rendered on the server, same reason /map's StopsMap is loaded this way.
const FleetMap = dynamic(() => import("@/components/FleetMap"), { ssr: false });

export default function FleetMapClient({ routes }: { routes: FleetRoute[] }) {
  return <FleetMap routes={routes} />;
}
