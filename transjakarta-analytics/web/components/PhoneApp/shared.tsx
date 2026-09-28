"use client";

import { useEffect, useState } from "react";

export const TJ_BLUE = "#1A4BA0";

export function RouteBadge({
  shortName,
  color,
  size = 40,
}: {
  shortName: string;
  color: string;
  size?: number;
}) {
  const light = color.toUpperCase() === "FDCB1C";
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold shrink-0"
      style={{
        width: size,
        height: size,
        background: `#${color || "666666"}`,
        color: light ? "#3b2f00" : "#fff",
        fontSize: shortName.length > 2 ? size * 0.3 : size * 0.4,
      }}
    >
      {shortName}
    </div>
  );
}

export function useNow(intervalMs = 5000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function occupancyStyle(pct: number) {
  if (pct >= 80) return { bg: "#fee2e2", fg: "#b91c1c", label: "Crowded" };
  if (pct >= 50) return { bg: "#fef3c7", fg: "#b45309", label: "Busy" };
  return { bg: "#dcfce7", fg: "#15803d", label: "Seats available" };
}
