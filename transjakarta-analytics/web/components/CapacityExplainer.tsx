"use client";

import { useState } from "react";
import { CROWDEASE_SNAPSHOT_CAPTURED_AT } from "@/lib/crowdEaseSnapshot";

export default function CapacityExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs px-3 py-1.5 rounded-full border border-neutral-700 text-neutral-300 hover:border-amber-500 hover:text-amber-400 transition-colors"
      >
        {open ? "Hide" : "How this works & its real limits"}
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-amber-900/40 bg-amber-950/10 p-5 text-sm text-neutral-300 space-y-3 leading-relaxed">
          <p>
            <strong className="text-amber-400">What&apos;s real:</strong> the headway/frequency-standard numbers
            for every route come from the live analytics API on this site &mdash; computed straight from
            TransJakarta&apos;s own published GTFS feed, same as the rest of this dashboard.
          </p>
          <p>
            <strong className="text-amber-400">What&apos;s a snapshot, not live:</strong> occupancy comes from CrowdEase&apos;s bus-occupancy
            counting (webcam + YOLO people-counting). There is no live deployed feed to pull from, so the
            occupancy figures here are a fixed snapshot of its own real seed data (captured {CROWDEASE_SNAPSHOT_CAPTURED_AT}), not a live feed.
          </p>
          <p>
            <strong className="text-amber-400">Scope:</strong> CrowdEase only instruments <strong>5 buses across 3
            routes</strong> (2, 2A, 7F) &mdash; not TransJakarta&apos;s full 240-route network. The priority
            ranking below is only meaningful for those 3 routes; every other route&apos;s occupancy is genuinely
            unknown, not assumed to be fine.
          </p>
          <p>
            <strong className="text-amber-400">The actual logic:</strong> for each of the 3 monitored routes,
            priority = whether it fails the 15-minute frequent-service standard AND how full its buses are
            (average occupancy across all monitored buses on that route). A route that&apos;s both infrequent and
            crowded is a real capacity-planning signal &mdash; riders on it are waiting longer <em>and</em>{" "}
            packing onto the buses that do come. A route that&apos;s crowded but already frequent isn&apos;t
            flagged, since more buses wouldn&apos;t obviously be the fix there.
          </p>
        </div>
      )}
    </div>
  );
}
