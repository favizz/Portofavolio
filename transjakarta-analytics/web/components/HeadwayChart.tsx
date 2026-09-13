"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import type { HeadwaySummary } from "@/lib/api";

export default function HeadwayChart({ data }: { data: HeadwaySummary }) {
  const [sortAsc, setSortAsc] = useState(false); // false = worst (highest headway) first

  const rows = [...data.routes]
    .map((r) => ({ ...r, avg_headway_min: Math.round((parseFloat(r.avg_headway_secs) / 60) * 10) / 10 }))
    .sort((a, b) => (sortAsc ? a.avg_headway_min - b.avg_headway_min : b.avg_headway_min - a.avg_headway_min));

  const top20 = rows.slice(0, 20);
  const standardMin = data.standardSecs / 60;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-sm">
            {sortAsc ? "20 most frequent routes" : "20 least frequent routes"} (real avg. headway, minutes)
          </h2>
          <button
            onClick={() => setSortAsc((s) => !s)}
            className="text-xs px-2 py-1 rounded border border-neutral-700 text-neutral-300 hover:border-neutral-500"
          >
            Show {sortAsc ? "worst" : "best"} instead
          </button>
        </div>
        <ResponsiveContainer width="100%" height={420}>
          <BarChart data={top20} layout="vertical" margin={{ left: 40 }}>
            <XAxis type="number" stroke="#737373" fontSize={12} label={{ value: "minutes", position: "insideBottomRight", offset: -5, fill: "#737373", fontSize: 11 }} />
            <YAxis type="category" dataKey="route_short_name" stroke="#737373" fontSize={11} width={50} />
            <Tooltip
              contentStyle={{ background: "#171717", border: "1px solid #404040", fontSize: 12 }}
              formatter={(value, _name, item) => [`${value} min avg headway`, item.payload.route_long_name]}
            />
            <ReferenceLine x={standardMin} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `${standardMin}min standard`, fill: "#f59e0b", fontSize: 11, position: "top" }} />
            <Bar dataKey="avg_headway_min" radius={[0, 4, 4, 0]}>
              {top20.map((r, i) => (
                <Cell key={i} fill={r.meets_standard ? "#2dd4bf" : "#f87171"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-neutral-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-400">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Route</th>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-right px-4 py-2 font-medium">Avg headway</th>
              <th className="text-right px-4 py-2 font-medium">Samples</th>
              <th className="text-right px-4 py-2 font-medium">Standard</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.route_id} className="border-t border-neutral-900">
                <td className="px-4 py-2 font-mono text-xs">{r.route_short_name}</td>
                <td className="px-4 py-2 text-neutral-300">{r.route_long_name}</td>
                <td className="px-4 py-2 text-right">{r.avg_headway_min} min</td>
                <td className="px-4 py-2 text-right text-neutral-500">{r.sample_count}</td>
                <td className="px-4 py-2 text-right">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      r.meets_standard ? "bg-teal-500/15 text-teal-400" : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {r.meets_standard ? "meets" : "below"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
