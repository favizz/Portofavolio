"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { api, type FleetDirection, type FleetRoute } from "@/lib/api";
import { currentHeadwaySecs, simulatedFleet } from "@/lib/fleetSimulation";
import { BUS_CAPACITY, simulatedOccupancy } from "@/lib/fleetOccupancy";
import type { MapBus, MapLine } from "./MapView";
import { getSnapshotFleet, SNAPSHOT_ROUTE_IDS } from "@/lib/fleetData";
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

const MONITORED = ["2", "2A", "7F"];
type Screen = "home" | "routes" | "detail";

function occColors(count: number) {
  const pct = count / BUS_CAPACITY;
  if (pct >= 0.8) return { solid: "#dc2626", soft: "#fee2e2", text: "#b91c1c", label: "Crowded" };
  if (pct >= 0.5) return { solid: "#d97706", soft: "#fef3c7", text: "#b45309", label: "Busy" };
  return { solid: "#15803d", soft: "#dcfce7", text: "#15803d", label: "Seats available" };
}

/** Route-wide average of the published hourly headways, used only so every route shows a running fleet in the demo. */
function fallbackHeadway(directions: FleetDirection[]): number {
  const vals = directions.flatMap((d) => (d.hourlyHeadwaySecs ?? []).filter((v): v is number => v !== null));
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 900;
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
  const buses: MapBus[] = fleets.flatMap((f) => {
    const color = `#${colors[f.routeShortName] ?? "666666"}`;
    const fb = fallbackHeadway(f.directions);
    return f.directions.flatMap((d) =>
      simulatedFleet(d, now, { fallbackHeadwaySecs: fb, max: 3 }).map((b) => {
        const n = simulatedOccupancy(`${f.routeShortName}${d.directionId}`, b.index, b.currentStopIndex, now);
        return {
          key: `${f.routeShortName}-${d.directionId}-${b.index}`,
          label: f.routeShortName,
          position: b.position,
          color,
          badge: `${n}/${BUS_CAPACITY}`,
          badgeBg: occColors(n).solid,
          tooltip: `Route ${f.routeShortName} · ${n}/${BUS_CAPACITY} seats taken`,
        };
      })
    );
  });
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

function BestTime({ advice }: { advice: ReturnType<typeof adviseRide> }) {
  const [open, setOpen] = useState(false);
  if (!advice.hasData) return null;
  const shown = advice.hours.filter((h) => h.hour >= 5 && h.hour <= 22);
  const nowHour = advice.hours[advice.nowHour];
  return (
    <div className="mt-3 rounded-xl bg-blue-50/70">
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
  const fb = fleet ? fallbackHeadway(fleet.directions) : 900;
  const advice = useMemo(() => (fleet && fleet.directions.length ? adviseRide(fleet.directions, dir, now) : null), [fleet, dir, now]);

  const buses = useMemo(() => {
    if (!direction) return [];
    return simulatedFleet(direction, now, { fallbackHeadwaySecs: fb, max: 8 }).map((b) => ({
      ...b,
      id: `SIM-${String(b.index + 1).padStart(2, "0")}`,
      count: simulatedOccupancy(`${route.route_short_name}${direction.directionId}`, b.index, b.currentStopIndex, now),
    }));
  }, [direction, now, fb, route.route_short_name]);

  const headway = direction ? currentHeadwaySecs(direction, now, fb) : null;
  const duration = direction?.tripDurationSecs ?? null;

  // For every stop: the buses at it right now, or the soonest bus that will reach it.
  const board = useMemo(() => {
    if (!direction || !duration) return [];
    return direction.stops.map((stop) => {
      if (stop.elapsedSecs === null) return null;
      const options = buses.map((b) => ({ b, eta: (((stop.elapsedSecs! - b.phase) % duration) + duration) % duration }));
      options.sort((x, y) => x.eta - y.eta);
      const best = options[0];
      return best ? { bus: best.b, eta: best.eta } : null;
    });
  }, [direction, duration, buses]);

  const lines: MapLine[] = direction ? [{ positions: direction.coordinates, color }] : [];
  const stops = direction ? direction.stops.filter((s) => typeof s.lat === "number").map((s) => [s.lat, s.lon] as [number, number]) : [];
  const ends = direction && direction.coordinates.length > 1 ? { start: direction.coordinates[0], end: direction.coordinates[direction.coordinates.length - 1] } : undefined;
  const mapBuses: MapBus[] = buses.map((b) => ({
    key: b.id,
    label: route.route_short_name,
    position: b.position,
    color,
    badge: `${b.count}/${BUS_CAPACITY}`,
    badgeBg: occColors(b.count).solid,
    tooltip: `${b.id} · ${b.count}/${BUS_CAPACITY} seats taken`,
  }));

  return (
    <div className="flex flex-col h-full bg-white text-neutral-900">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3 shrink-0">
        <button onClick={back} className="text-2xl" aria-label="Back" style={{ color: TJ_BLUE }}>
          &lsaquo;
        </button>
        <div className="font-bold text-lg">Route Details</div>
      </div>
      <div className="relative h-[42%] shrink-0">
        <MapView lines={lines} stops={stops} ends={ends} buses={mapBuses} fit />
        <StatusChip state={fleet ? "ok" : failed ? "waking" : "loading"} />
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
                  onClick={() => setDir(i)}
                  className={`flex-1 pb-2 pt-1 text-xs font-semibold border-b-[3px] ${i === dir ? "" : "border-transparent text-neutral-400"}`}
                  style={i === dir ? { borderColor: TJ_BLUE, color: TJ_BLUE } : undefined}
                >
                  To {d.stops[d.stops.length - 1]?.stopName}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {!fleet && !failed && <div className="text-sm text-neutral-500 py-6">Loading route...</div>}
          {failed && <div className="text-sm text-neutral-500 py-6">Waking up the server, this can take up to a minute. Retrying automatically...</div>}
          {advice && <BestTime advice={advice} />}
          {direction && (
            <>
              <div className="flex items-baseline justify-between mt-4">
                <div className="text-lg font-extrabold">Bus Arrival</div>
                {headway && <div className="text-xs font-semibold text-neutral-600">Bus every ~{Math.max(1, Math.round(headway / 60))} min</div>}
              </div>
              <div className="text-[11px] text-neutral-400 mb-2">Demo: bus positions and seat counts are simulated.</div>
              {buses.length === 0 && <div className="text-xs text-neutral-500 mb-2">No buses running at this time. Service is roughly 05:00 to 22:00.</div>}
            </>
          )}
          {direction?.stops.map((stop, i) => {
            const b = board[i];
            const isNow = !!b && b.eta <= 45;
            const oc = b ? occColors(b.bus.count) : null;
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
                  {b && oc && (
                    <div className="mt-1.5 rounded-xl bg-blue-50/70 px-3 py-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span>🚌</span>
                        <span className="text-[11px] font-bold text-white rounded px-1.5 py-0.5" style={{ background: color }}>
                          {b.bus.id}
                        </span>
                        <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: oc.soft, color: oc.text }}>
                          {b.bus.count}/{BUS_CAPACITY}
                        </span>
                      </div>
                      <span className={`font-extrabold text-emerald-600 ${isNow ? "text-base" : "text-sm"}`}>
                        {isNow ? "Now" : `${Math.max(1, Math.round(b.eta / 60))} min`}
                      </span>
                    </div>
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
