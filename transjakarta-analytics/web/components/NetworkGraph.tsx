"use client";

import { useMemo } from "react";
import { ReactFlow, Background, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { NetworkGraph as NetworkGraphData } from "@/lib/api";

// A simple two-ring layout (no external layout library): the most-connected
// routes (real transfer hubs, by degree) form an inner ring, everything
// else forms an outer ring. Not a force-directed layout, but genuinely
// derived from the real degree data rather than arbitrary placement.
function layout(nodes: NetworkGraphData["nodes"]): Node[] {
  const sorted = [...nodes].sort((a, b) => b.connections - a.connections);
  const hubCount = Math.min(6, sorted.length);
  const hubs = sorted.slice(0, hubCount);
  const rest = sorted.slice(hubCount);

  const place = (items: typeof sorted, radius: number, cx: number, cy: number): Node[] =>
    items.map((n, i) => {
      const angle = (2 * Math.PI * i) / items.length;
      return {
        id: n.id,
        position: { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) },
        data: { label: `${n.label}` },
        style: {
          background: "#171717",
          color: "#e5e5e5",
          border: `1px solid ${hubCount > 0 && items === hubs ? "#2dd4bf" : "#404040"}`,
          borderRadius: 8,
          fontSize: 11,
          padding: "6px 10px",
          width: "auto",
        },
      };
    });

  const cx = 400;
  const cy = 350;
  return [...place(hubs, 120, cx, cy), ...place(rest, 340, cx, cy)];
}

export default function NetworkGraphView({ data }: { data: NetworkGraphData }) {
  const nodes = useMemo(() => layout(data.nodes), [data.nodes]);
  const edges = useMemo<Edge[]>(
    () =>
      data.edges.map((e, i) => ({
        id: `${e.route_a}-${e.route_b}-${i}`,
        source: e.route_a,
        target: e.route_b,
        style: { stroke: "#404040", strokeWidth: Math.min(1 + e.shared_stops / 3, 6) },
        label: e.shared_stops > 5 ? `${e.shared_stops}` : undefined,
        labelStyle: { fill: "#737373", fontSize: 10 },
      })),
    [data.edges]
  );

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50" style={{ height: 700 }}>
      <ReactFlow nodes={nodes} edges={edges} fitView colorMode="dark" nodesDraggable>
        <Background color="#262626" gap={24} />
      </ReactFlow>
    </div>
  );
}
