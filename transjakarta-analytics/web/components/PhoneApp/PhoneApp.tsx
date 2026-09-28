"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { api, type FleetRoute } from "@/lib/api";
import { namedBusStatus } from "@/lib/fleetSimulation";
import { assignBusesToDirections } from "@/lib/liveFleetAssignment";
import type { MapBus, MapLine } from "./MapView";
import { getSnapshotFleet, SNAPSHOT_ROUTE_IDS } from "@/lib/fleetData";
import { adviseRide, fmtRange, type Level } from "@/lib/rideAdvisor";
import ClockControl, { useSimClock, type SimClock } from "./ClockControl";
import { RouteBadge, TJ_BLUE, occupancyStyle } from "./shared";

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

const MONITORED = ["2", "2A", "7F"];
type Screen = "home" | "routes" | "detail";

function liveBuses(fleet: FleetRoute, color: string, now: Date) {
  return assignBusesToDirections(fleet).flatMap(({ bus, directionIndex, busIndexWithinDirection }) => {
    const direction = fleet.directions[directionIndex];
    const status = direction ? namedBusStatus(direction, busIndexWithinDirection, now) : null;
    if (!status) return [];
    const pct = Math.round((bus.baseOccupancy / bus.capacity) * 100);
    return [{ bus, directionIndex, status, color, pct, routeShortName: fleet.routeShortName }];
  });
}

function StatusChip({ state }: { state: "ok" | "loading" | "waking" }) {
  const text = state === "ok" ? "Live simulation" : state === "loading" ? "Loading route..." : "Waking up the server...";
  return (
    <div className="absolute top-3 right-3 z-[500] bg-white rounded-lg shadow px-3 py-1.5 text-xs font-semibold text-neutral-800 flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${state === "ok" ? "bg-emerald-500" : "bg-amber-400 animate-pulse"}`} />
      {text}
    </div>
  );
}

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

function HomeScreen({
  fleets,
  colors,
  clock,
  openRoutes,
}: {
  fleets: FleetRoute[];
  colors: Record<string, string>;
  clock: SimClock;
  openRoutes: () => void;
}) {
  const now = clock.now;
  const buses: MapBus[] = fleets.flatMap((f) =>
    liveBuses(f, `#${colors[f.routeShortName] ?? "666666"}`, now).map((b) => ({
      key: b.bus.busId,
      label: b.routeShortName,
      position: b.status.position,
      color: b.color,
      tooltip: `${b.bus.busId} · ${b.pct}% full`,
    }))
  );
  const lines: MapLine[] = fleets.flatMap((f) =>
    f.directions.map((d) => ({ positions: d.coordinates, color: `#${colors[f.routeShortName] ?? "666666"}` }))
  );
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
        <button
          onClick={openRoutes}
          className="mt-3 w-full rounded-xl bg-white/95 text-neutral-400 text-sm text-left px-4 py-3"
        >
          Search Destination
        </button>
      </div>
      <div className="relative flex-1 min-h-0">
        <MapView lines={lines} buses={buses} fit={false} />
        <StatusChip state="ok" />
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
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s
      ? routes.filter((r) => r.route_short_name.toLowerCase().includes(s) || r.route_long_name.toLowerCase().includes(s))
      : routes;
  }, [routes, q]);
  return (
    <div className="flex flex-col h-full bg-white text-neutral-900">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3 shrink-0">
        <button onClick={back} className="w-9 h-9 rounded-full bg-blue-50 text-xl" aria-label="Back" style={{ color: TJ_BLUE }}>
          &lsaquo;
        </button>
        <div className="font-bold text-lg">Route</div>
      </div>
      <div className="px-4 pb-3 shrink-0">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search route name or code..."
          className="w-full rounded-xl bg-blue-50/70 px-4 py-3 text-sm outline-none"
        />
      </div>
      <div className="px-4 pb-1 text-xs font-bold text-neutral-500 shrink-0">ALL ROUTES ({list.length})</div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {list.map((r) => (
          <button key={r.route_id} onClick={() => pick(r)} className="w-full flex items-center gap-3 rounded-xl bg-blue-50/60 px-3 py-3 text-left">
            <RouteBadge shortName={r.route_short_name} color={r.route_color} size={42} />
            <span className="flex-1 text-sm font-semibold leading-tight">{r.route_long_name}</span>
            {MONITORED.includes(r.route_short_name) && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">LIVE</span>
            )}
            <span className="text-neutral-400">&rsaquo;</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const LEVEL_COLOR: Record<Level, string> = { comfortable: "#22c55e", moderate: "#f59e0b", crowded: "#ef4444" };
const LEVEL_TEXT: Record<Level, string> = { comfortable: "Comfortable", moderate: "Moderately busy", crowded: "Crowded" };

function AdviceCard({ advice }: { advice: ReturnType<typeof adviseRide> }) {
  const shown = advice.hours.filter((h) => h.hour >= 5 && h.hour <= 22);
  const nowHour = advice.hours[advice.nowHour];
  return (
    <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
      <div className="flex items-center justify-between">
        <div className="font-extrabold text-[15px]">Best time to ride today</div>
        <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-white text-neutral-600">{advice.weekend ? "Weekend" : "Weekday"}</span>
      </div>
      {!advice.hasData ? (
        <div className="text-xs text-neutral-500 mt-2">Not enough published schedule data on this route to recommend a time.</div>
      ) : (
        <>
          <div className="mt-2 text-sm">
            <span className="font-bold text-emerald-600">Best: </span>
            <span className="font-semibold">{advice.best.map(fmtRange).join(", ")}</span>
            {advice.bestHeadwayMin !== null && <span className="text-neutral-500"> (a bus about every {advice.bestHeadwayMin} min)</span>}
          </div>
          {advice.avoid.length > 0 && (
            <div className="mt-1 text-sm">
              <span className="font-bold text-red-600">Avoid: </span>
              <span className="font-semibold">{advice.avoid.map(fmtRange).join(", ")}</span>
              <span className="text-neutral-500"> (peak hours)</span>
            </div>
          )}
          {nowHour?.level && (
            <div className="mt-1 text-xs text-neutral-600">
              At {String(advice.nowHour).padStart(2, "0")}:00: <b style={{ color: LEVEL_COLOR[nowHour.level] }}>{LEVEL_TEXT[nowHour.level]}</b>
            </div>
          )}
          <div className="mt-3 flex items-end gap-[3px] h-14">
            {shown.map((h) => (
              <div key={h.hour} className="flex-1 flex flex-col items-center justify-end h-full">
                <div
                  className={`w-full rounded-sm ${h.hour === advice.nowHour ? "ring-2 ring-offset-1 ring-neutral-800" : ""}`}
                  style={{
                    height: h.index === null ? 4 : Math.max(6, Math.min(1, h.index) * 52),
                    background: h.level ? LEVEL_COLOR[h.level] : "#d4d4d4",
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-neutral-400 mt-1">
            <span>05:00</span>
            <span>09:00</span>
            <span>13:00</span>
            <span>17:00</span>
            <span>22:00</span>
          </div>
          <div className="text-[10px] text-neutral-500 mt-2 leading-snug">
            Estimate, not measured. Combines this route&apos;s real published bus frequency{advice.routeWide ? " (route-wide, this direction publishes little)" : ""} with a typical
            Jakarta commuter demand pattern (weekday peaks about 06:00-09:00 and 16:00-20:00). Grey bars: no published service.
          </div>
        </>
      )}
    </div>
  );
}

function DetailScreen({ route, back, clock }: { route: AppRoute; back: () => void; clock: SimClock }) {
  const now = clock.now;
  const [fleet, setFleet] = useState<FleetRoute | null>(null);
  const [failed, setFailed] = useState(false);
  const [dir, setDir] = useState(0);
  const color = `#${route.route_color}`;

  useEffect(() => {
    setDir(0);
    setFailed(false);
    const snap = getSnapshotFleet(route.route_id);
    if (snap) {
      setFleet(snap);
      return;
    }
    setFleet(null);
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let tries = 0;
    const load = () =>
      api
        .fleet(route.route_id)
        .then((f) => {
          if (stopped) return;
          setFailed(false);
          setFleet(f);
        })
        .catch(() => {
          if (stopped) return;
          setFailed(true);
          if (++tries < 40) timer = setTimeout(load, 4000);
        });
    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [route.route_id]);

  const direction = fleet?.directions[dir];
  const advice = useMemo(() => (fleet && fleet.directions.length ? adviseRide(fleet.directions, dir, now) : null), [fleet, dir, now]);
  const live = useMemo(() => (fleet ? liveBuses(fleet, color, now) : []), [fleet, color, now]);
  const inDir = live.filter((b) => b.directionIndex === dir);

  const arrivals = new Map<string, { now: typeof inDir; next: { b: (typeof inDir)[number]; eta: number }[] }>();
  for (const b of inDir) {
    const { currentStopName, nextStopName, etaToNextStopSecs } = b.status;
    if (currentStopName) {
      const e = arrivals.get(currentStopName) ?? { now: [], next: [] };
      e.now.push(b);
      arrivals.set(currentStopName, e);
    }
    if (nextStopName && etaToNextStopSecs !== null) {
      const e = arrivals.get(nextStopName) ?? { now: [], next: [] };
      e.next.push({ b, eta: etaToNextStopSecs });
      arrivals.set(nextStopName, e);
    }
  }

  const lines: MapLine[] = direction ? [{ positions: direction.coordinates, color }] : [];
  const stops = direction ? direction.stops.filter((s) => typeof s.lat === "number").map((s) => [s.lat, s.lon] as [number, number]) : [];
  const mapBuses: MapBus[] = inDir.map((b) => ({
    key: b.bus.busId,
    label: route.route_short_name,
    position: b.status.position,
    color,
    tooltip: `${b.bus.busId} · ${b.pct}% full`,
  }));

  const busCard = (b: (typeof inDir)[number], right: React.ReactNode, key: string) => {
    const occ = occupancyStyle(b.pct);
    return (
      <div key={key} className="mt-2 rounded-xl bg-blue-50/70 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-base">🚌</span>
            <span className="text-[11px] font-bold text-white rounded px-1.5 py-0.5" style={{ background: color }}>
              {route.route_short_name}
            </span>
            <span className="text-[11px] font-bold text-white rounded px-1.5 py-0.5 truncate" style={{ background: color }}>
              {b.bus.busId}
            </span>
          </div>
          {right}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] font-semibold rounded-full px-2 py-0.5" style={{ background: occ.bg, color: occ.fg }}>
            {b.bus.baseOccupancy}/{b.bus.capacity} · {occ.label}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white text-neutral-900">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3 shrink-0">
        <button onClick={back} className="text-2xl" aria-label="Back" style={{ color: TJ_BLUE }}>
          &lsaquo;
        </button>
        <div className="font-bold text-lg">Route Details</div>
      </div>
      <div className="relative h-[34%] shrink-0">
        <MapView lines={lines} stops={stops} buses={mapBuses} fit />
        <StatusChip state={fleet ? "ok" : failed ? "waking" : "loading"} />
        <ClockControl clock={clock} />
      </div>
      <div className="-mt-4 relative z-[600] flex-1 min-h-0 flex flex-col rounded-t-3xl bg-white shadow-[0_-4px_12px_rgba(0,0,0,.08)]">
        <div className="px-4 pt-2 shrink-0">
          <div className="mx-auto w-10 h-1 rounded-full bg-neutral-300 mb-3" />
          <div className="flex items-center gap-2">
            <RouteBadge shortName={route.route_short_name} color={route.route_color} size={34} />
            <span className="text-xs font-bold text-white rounded-full px-3 py-1.5" style={{ background: TJ_BLUE }}>
              BRT
            </span>
          </div>
          <div className="text-xl font-extrabold mt-2 leading-tight">{route.route_long_name}</div>
          {fleet && fleet.directions.length > 0 && (
            <div className="flex mt-2 border-b border-neutral-200">
              {fleet.directions.map((d, i) => (
                <button
                  key={d.directionId}
                  onClick={() => setDir(i)}
                  className={`flex-1 pb-2 pt-1 text-xs font-semibold border-b-[3px] ${i === dir ? "" : "border-transparent text-neutral-400"}`}
                  style={i === dir ? { borderColor: TJ_BLUE, color: TJ_BLUE } : undefined}
                >
                  {d.stops[0]?.stopName} - {d.stops[d.stops.length - 1]?.stopName}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {advice && <AdviceCard advice={advice} />}
          <div className="text-lg font-extrabold mt-4">Bus Arrival</div>
          <div className="text-[11px] text-neutral-500 mt-1 mb-2">
            Demo: bus positions are simulated from TransJakarta&apos;s real published schedule (no live GPS exists). Occupancy is
            CrowdEase&apos;s own addition, from a real snapshot of its bus counts.
          </div>
          {!fleet && !failed && <div className="text-sm text-neutral-500 py-6">Loading route...</div>}
          {failed && <div className="text-sm text-neutral-500 py-6">Waking up the server, this can take up to a minute. Retrying automatically...</div>}
          {direction && live.length === 0 && (
            <div className="text-xs text-neutral-500 mb-2">
              CrowdEase has no occupancy counts on this route yet. The stops below are TransJakarta&apos;s real published data.
            </div>
          )}
          {direction?.stops.map((stop, i) => {
            const a = arrivals.get(stop.stopName);
            return (
              <div key={`${stop.stopId}-${i}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center shrink-0 mt-0.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: TJ_BLUE }} />
                  </div>
                  {i < direction.stops.length - 1 && <div className="w-1.5 flex-1 bg-blue-100" />}
                </div>
                <div className="flex-1 min-w-0 pb-3">
                  <div className="font-bold text-[15px] leading-tight">{stop.stopName}</div>
                  {a?.now.map((b) =>
                    busCard(b, <span className="text-lg font-extrabold text-emerald-600">Now</span>, `now-${b.bus.busId}`)
                  )}
                  {a?.next.map(({ b, eta }) =>
                    busCard(
                      b,
                      <span className="text-right leading-tight">
                        <span className="block text-[10px] font-bold text-emerald-600">Estimated Arrival</span>
                        <span className="text-sm font-extrabold text-emerald-600">{Math.max(1, Math.round(eta / 60))} min</span>
                      </span>,
                      `next-${b.bus.busId}`
                    )
                  )}
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
  const clock = useSimClock();

  const colors = useMemo(() => Object.fromEntries(routes.map((r) => [r.route_short_name, r.route_color])), [routes]);
  const fleets = useMemo(() => SNAPSHOT_ROUTE_IDS.map((id) => getSnapshotFleet(id)).filter((f): f is FleetRoute => !!f), []);

  return (
    <div className="min-h-dvh flex items-center justify-center md:py-8">
      <div className="relative w-full max-w-[400px] h-dvh md:h-[780px] md:rounded-[2.2rem] md:border-[6px] md:border-neutral-800 md:shadow-2xl overflow-hidden flex flex-col bg-white">
        {screen === "home" && (
          <>
            <HomeScreen fleets={fleets} colors={colors} clock={clock} openRoutes={() => setScreen("routes")} />
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
