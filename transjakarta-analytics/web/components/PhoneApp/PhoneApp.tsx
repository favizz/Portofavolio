"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FleetDirection } from "@/lib/api";
import { currentHeadwaySecs, simulatedFleet } from "@/lib/fleetSimulation";
import { BUS_CAPACITY, occupancyRangeAt, simulatedOccupancy } from "@/lib/fleetOccupancy";
import type { MapBus, MapLine, MapStop } from "./MapView";
import { DEMO_ROUTE_IDS, getSnapshotFleet } from "@/lib/fleetData";
import { adviseRide, fmtRange, type Level } from "@/lib/rideAdvisor";
import ClockControl, { useSimClock, type SimClock } from "./ClockControl";
import { RouteBadge, TJ_BLUE } from "./shared";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-neutral-200" />,
});

export interface AppRoute {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_color: string;
}

type Screen = "home" | "routes" | "detail";

function occColors(count: number) {
  const pct = count / BUS_CAPACITY;
  if (pct >= 0.8) return { solid: "#dc2626", soft: "#fee2e2", text: "#b91c1c" };
  if (pct >= 0.5) return { solid: "#d97706", soft: "#fef3c7", text: "#b45309" };
  return { solid: "#15803d", soft: "#dcfce7", text: "#15803d" };
}

function fallbackHeadway(directions: FleetDirection[]): number {
  const vals = directions.flatMap((d) => (d.hourlyHeadwaySecs ?? []).filter((v): v is number => v !== null));
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 900;
}

const hhmm = (d: Date) => new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(11, 16);

function BottomNav({ onHome }: { onHome: () => void }) {
  const items = [
    { label: "Home", icon: "⌂", active: true, onClick: onHome },
    { label: "Feed", icon: "▤" },
    { label: "Ticket", icon: "▭" },
    { label: "Profile", icon: "◔" },
  ];
  return (
    <div className="flex border-t border-neutral-200 bg-white px-2 py-2 shrink-0">
      {items.map((i) => (
        <button
          key={i.label}
          onClick={i.onClick}
          className={`flex-1 flex flex-col items-center gap-0.5 text-[11px] ${i.active ? "font-semibold" : "text-neutral-400"}`}
          style={i.active ? { color: TJ_BLUE } : undefined}
        >
          <span
            className={`w-11 h-8 rounded-xl flex items-center justify-center text-lg ${i.active ? "text-white" : ""}`}
            style={i.active ? { background: TJ_BLUE } : undefined}
          >
            {i.icon}
          </span>
          {i.label}
        </button>
      ))}
    </div>
  );
}

function HomeScreen({ clock, openRoutes }: { clock: SimClock; openRoutes: () => void }) {
  const quick = [
    { label: "Route", icon: "⤳", onClick: openRoutes },
    { label: "Bus Stop", icon: "▥" },
    { label: "BRT Ticket", icon: "▭" },
    { label: "Aspiration", icon: "☺" },
  ];
  return (
    <>
      <div className="px-4 pt-5 pb-6 text-white shrink-0" style={{ background: TJ_BLUE }}>
        <div className="text-lg font-light">
          Hello, <span className="font-bold">Rider</span>
        </div>
        <button onClick={openRoutes} className="mt-3 w-full rounded-xl bg-white/95 text-neutral-400 text-sm text-left px-4 py-3">
          Search Destination
        </button>
      </div>
      <div className="relative flex-1 min-h-0">
        <MapView lines={[]} buses={[]} fit={false} />
        <ClockControl clock={clock} />
      </div>
      <div className="-mt-4 relative z-[600] rounded-t-3xl bg-white px-4 pt-2 pb-3 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,.08)]">
        <div className="mx-auto w-10 h-1 rounded-full bg-neutral-300 mb-3" />
        <div className="rounded-xl p-3 text-white flex items-center justify-between gap-3" style={{ background: TJ_BLUE }}>
          <div>
            <div className="font-bold text-sm">CrowdEase</div>
            <div className="text-xs text-blue-100">See how full your bus is before it arrives.</div>
          </div>
          <button onClick={openRoutes} className="bg-white text-xs font-semibold rounded-lg px-3 py-2 shrink-0" style={{ color: TJ_BLUE }}>
            Try it
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-3">
          {quick.map((q) =>
            q.onClick ? (
              <button key={q.label} onClick={q.onClick} className="flex flex-col items-center gap-1 text-[11px] font-extrabold" style={{ color: TJ_BLUE }}>
                <span className="relative">
                  <span className="absolute inset-0 rounded-2xl animate-ping bg-blue-400/40" />
                  <span
                    className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl text-white shadow-lg ring-4 ring-blue-200"
                    style={{ background: TJ_BLUE }}
                  >
                    {q.icon}
                  </span>
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">TRY</span>
                </span>
                {q.label}
              </button>
            ) : (
              <div key={q.label} className="flex flex-col items-center gap-1 text-[11px] text-neutral-400">
                <span className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center text-xl grayscale">{q.icon}</span>
                {q.label}
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}

function RoutesScreen({ routes, back, pick }: { routes: AppRoute[]; back: () => void; pick: (r: AppRoute) => void }) {
  const [q, setQ] = useState("");
  const enabled = useMemo(
    () =>
      routes
        .filter((r) => DEMO_ROUTE_IDS.includes(r.route_id))
        .sort((a, b) => Number(a.route_short_name) - Number(b.route_short_name)),
    [routes]
  );
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? enabled.filter((r) => r.route_short_name.toLowerCase().includes(s) || r.route_long_name.toLowerCase().includes(s)) : enabled;
  }, [enabled, q]);

  return (
    <div className="flex flex-col h-full bg-white text-neutral-900">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3 shrink-0">
        <button onClick={back} className="w-9 h-9 rounded-full bg-blue-50 text-xl" aria-label="Back" style={{ color: TJ_BLUE }}>
          &lsaquo;
        </button>
        <div className="font-bold text-lg">Pick a route</div>
      </div>
      <div className="px-4 pb-3 shrink-0">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by number, e.g. 2"
          className="w-full rounded-xl bg-blue-50/70 px-4 py-3 text-sm outline-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-3 gap-3">
          {shown.map((r) => (
            <button key={r.route_id} onClick={() => pick(r)} className="flex flex-col items-center gap-1.5 rounded-xl bg-blue-50/60 px-2 py-3 text-center">
              <RouteBadge shortName={r.route_short_name} color={r.route_color} size={44} />
              <span className="text-[11px] font-semibold leading-snug">{r.route_long_name}</span>
            </button>
          ))}
        </div>
        {shown.length === 0 && <div className="text-sm text-neutral-400 py-6 text-center">No match among the {enabled.length} routes in this demo.</div>}
      </div>
    </div>
  );
}

const LEVEL_COLOR: Record<Level, string> = { comfortable: "#22c55e", moderate: "#f59e0b", crowded: "#ef4444" };
const LEVEL_TEXT: Record<Level, string> = { comfortable: "Comfortable", moderate: "Moderately busy", crowded: "Crowded" };

function BestTime({ advice }: { advice: ReturnType<typeof adviseRide> }) {
  const [open, setOpen] = useState(false);
  if (!advice.hasData) return null;
  const shown = advice.hours.filter((h) => h.hour >= 5 && h.hour <= 22);
  const nowHour = advice.hours[advice.nowHour];
  return (
    <div className="rounded-xl bg-blue-50/70">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left px-3 py-2.5 flex items-center gap-2">
        <div className="flex-1 min-w-0 text-[13px] leading-snug">
          <div>
            <b className="text-emerald-600">Best time to ride:</b> <b>{advice.best.map(fmtRange).join(", ")}</b>
          </div>
          {advice.avoid.length > 0 && (
            <div className="text-neutral-600">
              <b className="text-red-600">Avoid:</b> {advice.avoid.map(fmtRange).join(", ")}
            </div>
          )}
        </div>
        <span className="text-neutral-400 text-lg">{open ? "⌃" : "⌄"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          {nowHour?.level && (
            <div className="text-xs text-neutral-600">
              At {String(advice.nowHour).padStart(2, "0")}:00: <b style={{ color: LEVEL_COLOR[nowHour.level] }}>{LEVEL_TEXT[nowHour.level]}</b> ({advice.weekend ? "weekend" : "weekday"})
            </div>
          )}
          <div className="mt-2 flex items-end gap-[3px] h-12">
            {shown.map((h) => (
              <div key={h.hour} className="flex-1 flex flex-col justify-end h-full">
                <div
                  className={`w-full rounded-sm ${h.hour === advice.nowHour ? "ring-2 ring-offset-1 ring-neutral-800" : ""}`}
                  style={{ height: h.index === null ? 4 : Math.max(6, h.index * 44), background: h.level ? LEVEL_COLOR[h.level] : "#d4d4d4" }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-neutral-400 mt-1">
            <span>05:00</span>
            <span>13:00</span>
            <span>22:00</span>
          </div>
          <div className="text-[10px] text-neutral-500 mt-1.5 leading-snug">Estimate from real bus frequency and a typical commuter pattern. Not measured.</div>
        </div>
      )}
    </div>
  );
}

/** A rider's own boarding station: either picked from the real stop list, or (default) a random demo "location detection" stand-in, since there's no real GPS read. */
function TimePlanner({
  direction,
  now,
  fallbackHeadwaySecs,
  routeKey,
}: {
  direction: FleetDirection;
  now: Date;
  fallbackHeadwaySecs: number;
  routeKey: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [stationIdx, setStationIdx] = useState<number | null>(null);

  const stopOptions = useMemo(() => direction.stops.map((s, i) => ({ s, i })).filter((x) => x.s.elapsedSecs !== null), [direction]);

  const detectLocation = () => {
    if (!stopOptions.length) return;
    const pick = stopOptions[Math.floor(Math.random() * stopOptions.length)];
    setMode("auto");
    setStationIdx(pick.i);
  };

  useEffect(() => {
    setStationIdx(null);
    setMode("auto");
  }, [direction]);

  useEffect(() => {
    if (open && stationIdx === null) detectLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const planBuses = useMemo(() => simulatedFleet(direction, now, { fallbackHeadwaySecs, max: 50 }), [direction, now, fallbackHeadwaySecs]);

  const result = useMemo(() => {
    if (stationIdx === null) return null;
    const stop = direction.stops[stationIdx];
    if (!stop || stop.elapsedSecs === null) return null;
    const upcoming = planBuses
      .map((b) => ({ b, delta: stop.elapsedSecs! - b.phase }))
      .filter((x) => x.delta >= -45)
      .sort((a, b) => a.delta - b.delta);
    const best = upcoming[0];
    if (!best) return null;
    const arriveAt = new Date(now.getTime() + Math.max(0, best.delta) * 1000);
    const minutesAway = Math.max(0, Math.round(best.delta / 60));
    const [lo, hi] = occupancyRangeAt(routeKey, best.b.index, stationIdx, arriveAt);
    return { stop, arriveAt, minutesAway, lo, hi, busId: `SIM-${String(best.b.index + 1).padStart(2, "0")}` };
  }, [stationIdx, planBuses, direction, now, routeKey]);

  return (
    <div className="rounded-xl bg-blue-50/70 mt-2">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left px-3 py-2.5 flex items-center gap-2">
        <div className="flex-1 text-[13px] font-bold">🕒 When should I leave?</div>
        <span className="text-neutral-400 text-lg">{open ? "⌃" : "⌄"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2.5">
          <div className="flex gap-2">
            <button
              onClick={detectLocation}
              className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold ${mode === "auto" ? "bg-[#1A4BA0] text-white" : "bg-white text-neutral-600"}`}
            >
              📍 Detect my location (demo)
            </button>
          </div>
          <label className="block">
            <span className="text-[11px] text-neutral-500">Or choose your station</span>
            <select
              value={stationIdx ?? ""}
              onChange={(e) => {
                setMode("manual");
                setStationIdx(Number(e.target.value));
              }}
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm"
            >
              <option value="" disabled>
                Select a station
              </option>
              {stopOptions.map(({ s, i }) => (
                <option key={s.stopId} value={i}>
                  {s.stopName}
                </option>
              ))}
            </select>
          </label>
          {mode === "auto" && stationIdx !== null && (
            <div className="text-[11px] text-neutral-500">
              Demo-detected location: <b className="text-neutral-700">{direction.stops[stationIdx].stopName}</b> (randomized, not a real GPS read)
            </div>
          )}
          {result ? (
            <div className="rounded-lg bg-white px-3 py-2.5">
              <div className="text-[13px] font-bold">{result.stop.stopName}</div>
              <div className="text-xs text-neutral-600 mt-0.5">
                Next bus (<b>{result.busId}</b>) arrives <b>{hhmm(result.arriveAt)}</b>
              </div>
              <div className="text-xs text-neutral-600">
                Leave within <b>{result.minutesAway <= 0 ? "now" : `${result.minutesAway} min`}</b> to catch it
              </div>
              <div className="text-xs mt-1">
                Expected capacity: <b>{result.lo}-{result.hi}/{BUS_CAPACITY}</b> seats
              </div>
            </div>
          ) : (
            <div className="text-xs text-neutral-500">No upcoming bus found for this station right now.</div>
          )}
          <div className="text-[10px] text-neutral-400">Demo: location detection is randomized, and all times/capacities are estimates.</div>
        </div>
      )}
    </div>
  );
}

function DetailScreen({ route, back, clock }: { route: AppRoute; back: () => void; clock: SimClock }) {
  const now = clock.now;
  const fleet = getSnapshotFleet(route.route_id);
  const [dir, setDir] = useState(0);
  const [selIdx, setSelIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const color = `#${route.route_color}`;

  useEffect(() => {
    setDir(0);
    setSelIdx(0);
  }, [route.route_id]);

  const direction = fleet?.directions[dir];
  const routeKey = `${route.route_short_name}${direction?.directionId ?? 0}`;
  const fb = fleet ? fallbackHeadway(fleet.directions) : 900;
  const advice = useMemo(() => (fleet && fleet.directions.length ? adviseRide(fleet.directions, dir, now) : null), [fleet, dir, now]);

  const buses = useMemo(() => {
    if (!direction) return [];
    return simulatedFleet(direction, now, { fallbackHeadwaySecs: fb, max: 6 }).map((b) => ({
      ...b,
      id: `SIM-${String(b.index + 1).padStart(2, "0")}`,
      count: simulatedOccupancy(routeKey, b.index, b.currentStopIndex, now),
    }));
  }, [direction, now, fb, routeKey]);

  const sel = buses[Math.min(selIdx, Math.max(0, buses.length - 1))];
  const headway = direction ? currentHeadwaySecs(direction, now, fb) : null;

  // The selected bus's own journey: stops passed, the one it is at, and each upcoming stop with its arrival time and expected seats.
  const rows = useMemo(() => {
    if (!direction || !sel) return [];
    return direction.stops.map((stop, k) => {
      if (stop.elapsedSecs === null) return null;
      const delta = stop.elapsedSecs - sel.phase;
      const status = delta < -45 ? "passed" : delta <= 45 ? "now" : "next";
      const at = status === "now" ? now : new Date(now.getTime() + delta * 1000);
      return { stop, k, delta, status, time: hhmm(at), count: simulatedOccupancy(routeKey, sel.index, k, at) };
    });
  }, [direction, sel, now, routeKey]);

  const focusIdx = rows.findIndex((r) => r && r.status !== "passed");
  const lastFocusKey = useRef("");
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || focusIdx < 0) return;
    const el = box.querySelector<HTMLElement>(`[data-k="${focusIdx}"]`);
    if (!el) return;
    const key = `${route.route_id}-${dir}-${sel?.id}`;
    const jump = lastFocusKey.current !== key;
    lastFocusKey.current = key;
    box.scrollTo({ top: Math.max(0, el.offsetTop - 70), behavior: jump ? "auto" : "smooth" });
  }, [focusIdx, sel?.id, dir, route.route_id]);

  const lines: MapLine[] = direction ? [{ positions: direction.coordinates, color }] : [];
  const stopPts: MapStop[] = direction
    ? direction.stops.filter((s) => typeof s.lat === "number").map((s) => ({ id: s.stopId, name: s.stopName, position: [s.lat, s.lon] }))
    : [];
  const ends = direction && direction.coordinates.length > 1 ? { start: direction.coordinates[0], end: direction.coordinates[direction.coordinates.length - 1] } : undefined;
  const mapBuses: MapBus[] = buses.map((b) => ({
    key: b.id,
    position: b.position,
    heading: b.heading,
    color,
    badge: `${b.count}/${BUS_CAPACITY}`,
    badgeBg: occColors(b.count).solid,
    selected: b.id === sel?.id,
  }));

  return (
    <div className="flex flex-col h-full bg-white text-neutral-900">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3 shrink-0">
        <button onClick={back} className="text-2xl" aria-label="Back" style={{ color: TJ_BLUE }}>
          &lsaquo;
        </button>
        <div className="font-bold text-lg">Route Details</div>
      </div>
      <div className="relative h-[36%] shrink-0">
        <MapView lines={lines} stops={stopPts} ends={ends} buses={mapBuses} fit fitKey={`${route.route_id}-${dir}`} />
        <ClockControl clock={clock} />
      </div>
      <div className="-mt-4 relative z-[600] flex-1 min-h-0 flex flex-col rounded-t-3xl bg-white shadow-[0_-4px_12px_rgba(0,0,0,.08)]">
        <div className="px-4 pt-2 shrink-0">
          <div className="mx-auto w-10 h-1 rounded-full bg-neutral-300 mb-2" />
          <div className="flex items-center gap-2">
            <RouteBadge shortName={route.route_short_name} color={route.route_color} size={30} />
            <span className="text-[11px] font-bold text-white rounded-full px-2.5 py-1" style={{ background: TJ_BLUE }}>
              BRT
            </span>
            <div className="text-[17px] font-extrabold leading-tight ml-1">{route.route_long_name}</div>
          </div>
          {fleet && fleet.directions.length > 0 && (
            <div className="flex mt-2 border-b border-neutral-200">
              {fleet.directions.map((d, i) => (
                <button
                  key={d.directionId}
                  onClick={() => {
                    setDir(i);
                    setSelIdx(0);
                  }}
                  className={`flex-1 pb-2 pt-1 text-xs font-semibold border-b-[3px] ${i === dir ? "" : "border-transparent text-neutral-400"}`}
                  style={i === dir ? { borderColor: TJ_BLUE, color: TJ_BLUE } : undefined}
                >
                  To {d.stops[d.stops.length - 1]?.stopName}
                </button>
              ))}
            </div>
          )}
          {buses.length > 0 && (
            <div className="flex gap-2 overflow-x-auto py-2.5 -mx-1 px-1">
              {buses.map((b, i) => {
                const oc = occColors(b.count);
                const active = b.id === sel?.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setSelIdx(i)}
                    className={`shrink-0 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 border-2 ${active ? "border-[#1A4BA0] bg-blue-50" : "border-transparent bg-neutral-100"}`}
                  >
                    <span>🚌</span>
                    <span className="text-[11px] font-bold">{b.id}</span>
                    <span className="text-[11px] font-bold rounded-full px-1.5 py-0.5" style={{ background: oc.soft, color: oc.text }}>
                      {b.count}/{BUS_CAPACITY}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 pb-4">
          {advice && <BestTime advice={advice} />}
          {direction && <TimePlanner direction={direction} now={now} fallbackHeadwaySecs={fb} routeKey={routeKey} />}
          <div className="flex items-baseline justify-between mt-3">
            <div className="text-lg font-extrabold">{sel ? `${sel.id} journey` : "Bus Arrival"}</div>
            {headway && <div className="text-xs font-semibold text-neutral-600">Bus every ~{Math.max(1, Math.round(headway / 60))} min</div>}
          </div>
          <div className="text-[11px] text-neutral-400 mb-2">Demo: positions and seat counts are simulated. Time runs fast.</div>
          {buses.length === 0 && <div className="text-xs text-neutral-500 mb-2">No buses running at this time. Service is roughly 05:00 to 22:00.</div>}
          {rows.map((r, i) => {
            if (!r) return null;
            const oc = occColors(r.count);
            const passed = r.status === "passed";
            const isNow = r.status === "now";
            return (
              <div key={`${r.stop.stopId}-${i}`} data-k={i} className={`flex gap-3 ${isNow ? "rounded-xl bg-emerald-50 -mx-2 px-2" : ""}`}>
                <div className="flex flex-col items-center">
                  <div
                    className={`rounded-full flex items-center justify-center shrink-0 mt-1 ${isNow ? "w-6 h-6 bg-emerald-500 text-white text-[11px]" : passed ? "w-5 h-5 bg-neutral-200 text-neutral-500 text-[10px]" : "w-5 h-5 bg-blue-200"}`}
                  >
                    {isNow ? "🚌" : passed ? "✓" : <span className="w-2.5 h-2.5 rounded-full" style={{ background: TJ_BLUE }} />}
                  </div>
                  {i < rows.length - 1 && <div className={`w-1.5 flex-1 ${passed ? "bg-neutral-200" : "bg-blue-100"}`} />}
                </div>
                <div className="flex-1 min-w-0 pb-3 pt-0.5 flex items-start justify-between gap-2">
                  <div className={`font-bold text-[14px] leading-tight ${passed ? "text-neutral-400" : ""}`}>{r.stop.stopName}</div>
                  <div className="text-right shrink-0">
                    <div className={`text-xs font-extrabold ${isNow ? "text-emerald-600" : passed ? "text-neutral-400" : "text-neutral-800"}`}>
                      {isNow ? "Now" : r.time}
                    </div>
                    {r.status === "next" && <div className="text-[10px] text-neutral-500">in {Math.max(1, Math.round(r.delta / 60))} min</div>}
                    <span className="inline-block mt-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ background: passed ? "#f5f5f5" : oc.soft, color: passed ? "#a3a3a3" : oc.text }}>
                      {r.count}/{BUS_CAPACITY}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PhoneApp({ routes }: { routes: AppRoute[] }) {
  const [screen, setScreen] = useState<Screen>("home");
  const [selected, setSelected] = useState<AppRoute | null>(null);
  const clock = useSimClock(screen === "detail" ? 500 : screen === "home" ? 1000 : 60000);

  return (
    <div className="min-h-dvh flex items-center justify-center md:py-8">
      <div className="relative w-full max-w-[400px] h-dvh md:h-[780px] md:rounded-[2.2rem] md:border-[6px] md:border-neutral-800 md:shadow-2xl overflow-hidden flex flex-col bg-white">
        {screen === "home" && (
          <>
            <HomeScreen clock={clock} openRoutes={() => setScreen("routes")} />
            <BottomNav onHome={() => setScreen("home")} />
          </>
        )}
        {screen === "routes" && (
          <RoutesScreen
            routes={routes}
            back={() => setScreen("home")}
            pick={(r) => {
              setSelected(r);
              setScreen("detail");
            }}
          />
        )}
        {screen === "detail" && selected && <DetailScreen route={selected} clock={clock} back={() => setScreen("routes")} />}
      </div>
    </div>
  );
}
