"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` at module load time, so the map must never be
// rendered on the server.
const StopsMap = dynamic(() => import("@/components/StopsMap"), { ssr: false });

export default function MapPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stop Map</h1>
        <p className="text-neutral-400 mt-2 text-sm max-w-2xl">
          Every real stop from the current feed. Toggle the coverage grid to see the real,
          computed 500m-walkshed analysis from the Go coverage service — teal cells are within
          walking distance of a stop, red cells are not.
        </p>
      </div>
      <StopsMap />
    </div>
  );
}
