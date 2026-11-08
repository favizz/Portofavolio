"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FleetDirection } from "@/lib/api";
import { currentHeadwaySecs, simulatedFleet } from "@/lib/fleetSimulation";
import { BUS_CAPACITY, occupancyRangeAt, simulatedOccupancy } from "@/lib/fleetOccupancy";
import type { MapBus, MapLine, MapStop } from "./MapView";
import { DEMO_ROUTE_IDS, getSnapshotFleet } from "@/lib/fleetData";
import { adviseRide, fmtRange, type Level } from "@/lib/rideAdvisor";
import { DEMO_LOCATION } from "@/lib/locate";
import { planDeparture, planTrips, searchDestinations, type Departure } from "@/lib/tripPlanner";
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

type Screen = "home" | "routes" | "search" | "detail";

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
const jakartaMinutesOfDay = (d: Date) => {
  const s = new Date(d.getTime() + 7 * 3600 * 1000);
  return s.getUTCHours() * 60 + s.getUTCMinutes();
};
const fmtHM = (m: number) => `${String(Math.floor((((m % 1440) + 1440) % 1440) / 60)).padStart(2, "0")}:${String((((m % 1440) + 1440) % 1440) % 60).padStart(2, "0")}`;
const parseHM = (hhmmStr: string): number | null => {
  const [h, m] = hhmmStr.split(":").map(Number);
  return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
};

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

function HomeScreen({ clock, openRoutes, openSearch }: { clock: SimClock; openRoutes: () => void; openSearch: () => void }) {
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
      </div>
      <div className="relative flex-1 min-h-0">
        <MapView lines={[]} buses={[]} fit={false} />
        <ClockControl clock={clock} />
        <button
          onClick={openSearch}
          aria-label="Search destination"
          className="absolute right-4 bottom-8 z-[650] w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center"
          style={{ background: TJ_BLUE }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
        </button>
      </div>
      <div className="-mt-4 relative z-[600] rounded-t-3xl bg-white px-4 pt-2 pb-3 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,.08)]">
        <div className="mx-auto w-10 h-1 rounded-full bg-neutral-300 mb-3" />
        <div className="rounded-xl p-3 text-white flex items-center justify-between gap-3" style={{ background: TJ_BLUE }}>
          <div>
            <div className="font-bold text-sm">CrowdEase</div>
            <div className="text-xs text-blue-100">See how full your bus is before it arrives.</div>
          </div>
          <button onClick={openSearch} className="bg-white text-xs font-semibold rounded-lg px-3 py-2 shrink-0" style={{ color: TJ_BLUE }}>
            Try it
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-3">
          {quick.map((q) =>
            q.onClick ? (
              <button key={q.label} onClick={q.onClick} className="flex flex-col items-center gap-1 text-[11px] font-extrabold" style={{ color: TJ_BLUE }}>
                <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl text-white shadow-lg" style={{ background: TJ_BLUE }}>
                  {q.icon}
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

/** Google-Maps-style: type where you're going (a stop), the app picks the bus. Direct rides only; the bundled data has no transfer graph. */
const walkCache = new Map<string, { coords: [number, number][]; meters: number; secs: number } | null>();

/** Real walking path along streets (OpenStreetMap foot routing). Null until it loads, or if the service is unreachable. */
function useWalkPath(from: [number, number] | null, to: [number, number] | null) {
  const key = from && to ? `${from.join(",")};${to.join(",")}` : "";
  const [, bump] = useState(0);
  useEffect(() => {
    if (!from || !to || walkCache.has(key)) return;
    const ctrl = new AbortController();
    fetch(`https://routing.openstreetmap.de/routed-foot/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        const r = j?.routes?.[0];
        walkCache.set(key, r ? { coords: r.geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon]), meters: r.distance, secs: r.duration } : null);
        bump((n) => n + 1);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) {
          walkCache.set(key, null);
          bump((n) => n + 1);
        }
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return key ? walkCache.get(key) ?? null : null;
}

const LABEL_PILL: Record<string, { bg: string; fg: string }> = {
  "Near empty": { bg: "#dcfce7", fg: "#15803d" },
  "Seats likely": { bg: "#dcfce7", fg: "#15803d" },
  "Fairly quiet": { bg: "#fef3c7", fg: "#b45309" },
  Busy: { bg: "#fef3c7", fg: "#b45309" },
  Crowded: { bg: "#fee2e2", fg: "#b91c1c" },
};

function DepartureCard({
  d,
  leaveMin,
  isNowMode,
  arriveBy,
  boardName,
  hours,
}: {
  d: Departure;
  leaveMin: number;
  isNowMode: boolean;
  arriveBy: number | null;
  boardName: string;
  hours: ReturnType<typeof adviseRide>["hours"] | null;
}) {
  const leavingNow = d.dayOffset === 0 && d.leaveAt === leaveMin;
  const title =
    d.status === "late"
      ? `Can't make ${fmtHM(arriveBy ?? 0)}`
      : d.status === "fallback"
        ? arriveBy !== null
          ? "No quiet bus in time · least crowded"
          : "No quiet bus left · least crowded"
        : "Best time to leave";
  const big = d.status === "late" ? `~${fmtHM(d.arriveAt)}` : leavingNow ? (isNowMode ? "Now" : fmtHM(d.leaveAt)) : fmtHM(d.leaveAt);
  const pill = LABEL_PILL[d.label] ?? LABEL_PILL.Busy;
  return (
    <div className="mt-2 rounded-xl border border-neutral-200 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-neutral-500">{title}</div>
          <div className="text-xl font-extrabold leading-tight">
            {d.status === "late" ? <span className="text-sm font-semibold text-neutral-500">earliest arrival </span> : null}
            {big}
            {d.dayOffset === 1 && <span className="text-xs font-semibold text-neutral-500"> tomorrow</span>}
          </div>
        </div>
        <span className="text-xs font-semibold rounded-full px-2.5 py-1 shrink-0" style={{ background: pill.bg, color: pill.fg }}>
          {d.label}
        </span>
      </div>
      <div className="text-[11px] text-neutral-500 mt-1 truncate">
        {d.status === "late" ? `Leave now · board ${fmtHM(d.boardAt)} at ${boardName}` : `Board ${fmtHM(d.boardAt)} at ${boardName}`} · arrive ~{fmtHM(d.arriveAt)}
      </div>
      {hours && d.dayOffset === 0 && <CrowdStrip hours={hours} pick={Math.floor(d.boardAt / 60)} from={Math.floor(leaveMin / 60)} />}
    </div>
  );
}

/** Estimated crowding per hour (05-22) for the chosen bus. The dashed line is the "good enough" cutoff: halfway up the orange band. */
function CrowdStrip({ hours, pick, from }: { hours: ReturnType<typeof adviseRide>["hours"]; pick: number; from: number }) {
  const shown = hours.filter((h) => h.hour >= 5 && h.hour <= 22);
  return (
    <div className="mt-2">
      <div className="relative flex items-end gap-[2px] h-9">
        <div className="absolute inset-x-0 border-t border-dashed border-neutral-400" style={{ bottom: "60%" }} />
        {shown.map((h) => (
          <div
            key={h.hour}
            className="flex-1 rounded-t-sm"
            title={`${String(h.hour).padStart(2, "0")}:00`}
            style={{
              height: `${Math.max(6, (h.index ?? 0) * 100)}%`,
              background: h.level ? LEVEL_COLOR[h.level] : "#e5e7eb",
              opacity: h.hour === pick ? 1 : h.hour < from ? 0.2 : 0.45,
              outline: h.hour === pick ? "2px solid #111" : undefined,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-neutral-400 mt-0.5">
        <span>05</span>
        <span>12</span>
        <span>18</span>
        <span>22</span>
      </div>
    </div>
  );
}

function SearchScreen({
  routes,
  clock,
  back,
  openRoute,
  dest,
  setDest,
}: {
  routes: AppRoute[];
  clock: SimClock;
  back: () => void;
  openRoute: (r: AppRoute, directionIndex: number) => void;
  dest: string | null;
  setDest: (d: string | null) => void;
}) {
  const [query, setQuery] = useState(dest ?? "");
  const [planIdx, setPlanIdx] = useState(0);
  // Leave time follows the clock ("now") until the rider sets one.
  const [leaveSet, setLeaveSet] = useState<number | null>(null);
  const [arriveBy, setArriveBy] = useState<number | null>(null);
  const nowMin = jakartaMinutesOfDay(clock.now);
  const leaveMin = leaveSet ?? nowMin;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dest) inputRef.current?.focus();
  }, [dest]);

  const suggestions = useMemo(() => searchDestinations(query), [query]);
  const plans = useMemo(() => (dest ? planTrips(dest) : []), [dest]);
  const plan = plans[Math.min(planIdx, Math.max(0, plans.length - 1))];
  const route = plan ? routes.find((r) => r.route_id === plan.routeId) ?? null : null;
  const fleet = plan ? getSnapshotFleet(plan.routeId) : null;
  const walkPath = useWalkPath(plan ? [DEMO_LOCATION.lat, DEMO_LOCATION.lon] : null, plan?.board.position ?? null);
  const walkMeters = walkPath?.meters ?? (plan ? plan.walkMeters * 1.3 : 0);
  const walkMin = walkPath ? Math.max(1, Math.round(walkPath.secs / 60)) : Math.max(1, Math.round(walkMeters / 75));
  const rideMin = plan ? (plan.rideSecs !== null && plan.rideSecs > 0 ? Math.max(1, Math.round(plan.rideSecs / 60)) : plan.rideStops * 2) : 0;
  // The crowding curve depends on the Jakarta day (weekday vs weekend), not the minute.
  const dayKey = Math.floor((clock.now.getTime() + 7 * 3600000) / 86400000);
  const dayDate = useMemo(() => new Date(dayKey * 86400000 - 7 * 3600000 + 12 * 3600000), [dayKey]);
  const departure = useMemo(
    () => (fleet && plan ? planDeparture(fleet.directions, plan.directionIndex, dayDate, { leaveMin, arriveByMin: arriveBy, walkMin, rideMin }) : null),
    [fleet, plan, dayDate, leaveMin, arriveBy, walkMin, rideMin]
  );
  const dayHours = useMemo(() => (fleet && plan ? adviseRide(fleet.directions, plan.directionIndex, dayDate).hours : null), [fleet, plan, dayDate]);
  const shortName = (id: string) => routes.find((r) => r.route_id === id)?.route_short_name ?? id;
  const colorOf = (id: string) => routes.find((r) => r.route_id === id)?.route_color ?? "666666";

  const choose = (name: string) => {
    setDest(name);
    setQuery(name);
    setPlanIdx(0);
  };

  const walk = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
  const here: [number, number] = [DEMO_LOCATION.lat, DEMO_LOCATION.lon];

  return (
    <div className="flex flex-col h-full bg-white text-neutral-900">
      <div className="px-3 pt-4 pb-3 shrink-0 shadow-sm z-[700] bg-white">
        <div className="flex items-center gap-2">
          <button onClick={dest ? () => setDest(null) : back} className="w-9 h-9 rounded-full text-2xl leading-none shrink-0" aria-label="Back" style={{ color: TJ_BLUE }}>
            &lsaquo;
          </button>
          <div className="flex-1 rounded-full bg-neutral-100 flex items-center px-4">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (dest) setDest(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions[0]) choose(suggestions[0].name);
              }}
              placeholder="Where to?"
              className="flex-1 bg-transparent py-2.5 text-sm outline-none"
            />
            {query && (
              <button onClick={() => { setQuery(""); setDest(null); }} className="text-neutral-400 text-lg leading-none" aria-label="Clear">
                ×
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500 mt-2 ml-11">
          <span className="w-2.5 h-2.5 rounded-full border-2 border-white shadow" style={{ background: TJ_BLUE }} />
          From your location (demo)
        </div>
      </div>

      {!dest ? (
        <div className="flex-1 overflow-y-auto">
          {query.trim() === "" ? (
            <div className="px-5 py-6 text-sm text-neutral-400">Type a stop name, e.g. Blok M, Harmoni, Kota.</div>
          ) : suggestions.length === 0 ? (
            <div className="px-5 py-6 text-sm text-neutral-400">No stop called “{query}” on the routes in this demo.</div>
          ) : (
            suggestions.map((s) => (
              <button key={s.name} onClick={() => choose(s.name)} className="w-full flex items-center gap-3 px-4 py-3 border-b border-neutral-100 text-left">
                <span className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 shrink-0">⌖</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{s.name}</span>
                </span>
                <span className="flex gap-1 shrink-0">
                  {s.routeIds.slice(0, 3).map((id) => (
                    <RouteBadge key={id} shortName={shortName(id)} color={colorOf(id)} size={20} />
                  ))}
                </span>
              </button>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="relative flex-1 min-h-0">
            <MapView
              lines={
                plan
                  ? [
                      { positions: walkPath?.coords ?? [here, plan.board.position], color: TJ_BLUE, dashArray: "1 9" },
                      { positions: plan.segment, color: `#${colorOf(plan.routeId)}` },
                    ]
                  : []
              }
              ends={plan ? { start: plan.board.position, end: plan.alight.position } : undefined}
              buses={[]}
              fit={!!plan}
              fitKey={plan ? `${plan.routeId}-${plan.directionIndex}-${plan.alight.index}` : ""}
              center={here}
              zoom={15}
              myLocation={{ position: here, label: "You (demo)" }}
            />
          </div>
          <div className="-mt-4 relative z-[600] rounded-t-3xl bg-white px-4 pt-2 pb-4 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,.08)]">
            <div className="mx-auto w-10 h-1 rounded-full bg-neutral-300 mb-3" />
            {!plan || !route ? (
              <div className="text-sm text-neutral-600 py-2">
                No direct bus to <b>{dest}</b> from here in this demo. Transfers aren&apos;t covered yet.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <RouteBadge shortName={route.route_short_name} color={route.route_color} size={36} />
                  <div className="min-w-0">
                    <div className="font-bold text-[15px] leading-tight truncate">To {plan.alight.name}</div>
                    <div className="text-xs text-neutral-500 truncate">
                      Walk {walk(walkMeters)} ({walkMin} min) to {plan.board.name} · {plan.rideStops} {plan.rideStops === 1 ? "stop" : "stops"} · ~{rideMin} min
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-neutral-500">
                  <label className="rounded-lg border border-neutral-200 px-2.5 py-1.5">
                    <span className="flex justify-between">
                      Leave after
                      {leaveSet !== null && (
                        <button onClick={() => setLeaveSet(null)} className="font-semibold" style={{ color: TJ_BLUE }}>
                          Now
                        </button>
                      )}
                    </span>
                    <input
                      type="time"
                      step={60}
                      value={fmtHM(leaveMin)}
                      onChange={(e) => setLeaveSet(parseHM(e.target.value))}
                      className="w-full bg-transparent text-sm font-semibold text-neutral-900 outline-none"
                    />
                  </label>
                  <label className="rounded-lg border border-neutral-200 px-2.5 py-1.5">
                    <span className="flex justify-between">
                      Arrive by
                      {arriveBy !== null && (
                        <button onClick={() => setArriveBy(null)} className="font-semibold" style={{ color: TJ_BLUE }} aria-label="Clear arrive-by time">
                          Clear
                        </button>
                      )}
                    </span>
                    <input
                      type="time"
                      step={60}
                      value={arriveBy === null ? "" : fmtHM(arriveBy)}
                      onChange={(e) => setArriveBy(e.target.value ? parseHM(e.target.value) : null)}
                      className="w-full bg-transparent text-sm font-semibold text-neutral-900 outline-none"
                    />
                  </label>
                </div>

                {departure && <DepartureCard d={departure} leaveMin={leaveMin} isNowMode={leaveSet === null} arriveBy={arriveBy} boardName={plan.board.name} hours={dayHours} />}

                {plans.length > 1 && (
                  <div className="mt-2 text-right text-xs">
                    <button onClick={() => setPlanIdx((i) => (i + 1) % plans.length)} className="font-semibold" style={{ color: TJ_BLUE }}>
                      Other route ({plans.length - 1})
                    </button>
                  </div>
                )}

                <button onClick={() => openRoute(route, plan.directionIndex)} className="mt-3 w-full rounded-full py-2.5 text-sm font-semibold text-white" style={{ background: TJ_BLUE }}>
                  See live buses
                </button>
                <div className="text-[10px] text-neutral-400 mt-2 text-center">Demo location · crowding estimated from real schedules and typical demand</div>
              </>
            )}
          </div>
        </>
      )}
    </div>
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
    const [lo, hi] = occupancyRangeAt(routeKey, best.b.index, stationIdx, arriveAt, direction.stops.length);
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

function DetailScreen({ route, initialDir = 0, back, clock }: { route: AppRoute; initialDir?: number; back: () => void; clock: SimClock }) {
  const now = clock.now;
  const fleet = getSnapshotFleet(route.route_id);
  const [dir, setDir] = useState(initialDir);
  const [selIdx, setSelIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const color = `#${route.route_color}`;

  useEffect(() => {
    setDir(initialDir);
    setSelIdx(0);
  }, [route.route_id, initialDir]);

  const direction = fleet?.directions[dir];
  const routeKey = `${route.route_short_name}${direction?.directionId ?? 0}`;
  const fb = fleet ? fallbackHeadway(fleet.directions) : 900;
  const advice = useMemo(() => (fleet && fleet.directions.length ? adviseRide(fleet.directions, dir, now) : null), [fleet, dir, now]);

  const buses = useMemo(() => {
    if (!direction) return [];
    return simulatedFleet(direction, now, { fallbackHeadwaySecs: fb, max: 6 }).map((b) => ({
      ...b,
      id: `SIM-${String(b.index + 1).padStart(2, "0")}`,
      count: simulatedOccupancy(routeKey, b.index, b.currentStopIndex, now, direction.stops.length),
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
      return { stop, k, delta, status, time: hhmm(at), count: simulatedOccupancy(routeKey, sel.index, k, at, direction.stops.length) };
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
  const [selectedDir, setSelectedDir] = useState(0);
  const [detailBack, setDetailBack] = useState<Screen>("routes");
  const [searchDest, setSearchDest] = useState<string | null>(null);
  const clock = useSimClock(screen === "detail" ? 500 : screen === "home" ? 1000 : 60000);

  const goToRoute = (r: AppRoute, directionIndex = 0, from: Screen = "routes") => {
    setSelected(r);
    setSelectedDir(directionIndex);
    setDetailBack(from);
    setScreen("detail");
  };

  return (
    <div className="min-h-dvh flex items-center justify-center md:py-8">
      <div className="relative w-full max-w-[400px] h-dvh md:h-[780px] md:rounded-[2.2rem] md:border-[6px] md:border-neutral-800 md:shadow-2xl overflow-hidden flex flex-col bg-white">
        {screen === "home" && (
          <>
            <HomeScreen clock={clock} openRoutes={() => setScreen("routes")} openSearch={() => {
                setSearchDest(null);
                setScreen("search");
              }} />
            <BottomNav onHome={() => setScreen("home")} />
          </>
        )}
        {screen === "routes" && <RoutesScreen routes={routes} back={() => setScreen("home")} pick={(r) => goToRoute(r)} />}
        {screen === "search" && <SearchScreen routes={routes} clock={clock} back={() => setScreen("home")} openRoute={(r, d) => goToRoute(r, d, "search")} dest={searchDest} setDest={setSearchDest} />}
        {screen === "detail" && selected && <DetailScreen route={selected} initialDir={selectedDir} clock={clock} back={() => setScreen(detailBack)} />}
      </div>
    </div>
  );
}
