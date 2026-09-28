"use client";

import { useState } from "react";
import { useNow } from "./shared";

export interface SimClock {
  now: Date;
  simulated: boolean;
  setSim: (d: Date | null) => void;
}

/** Real clock by default, or a user-chosen Jakarta date/time that keeps ticking forward from where it was set. */
export function useSimClock(): SimClock {
  const tick = useNow();
  const [sim, setSimState] = useState<{ base: number; setAt: number } | null>(null);
  const now = sim ? new Date(sim.base + (Date.now() - sim.setAt)) : tick;
  return {
    now,
    simulated: sim !== null,
    setSim: (d) => setSimState(d ? { base: d.getTime(), setAt: Date.now() } : null),
  };
}

function jakartaParts(d: Date) {
  const s = new Date(d.getTime() + 7 * 3600 * 1000);
  return { date: s.toISOString().slice(0, 10), minutes: s.getUTCHours() * 60 + s.getUTCMinutes(), day: s.getUTCDay() };
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const build = (date: string, minutes: number) => new Date(`${date}T${fmt(minutes)}:00+07:00`);

const PRESETS = [
  { label: "Morning peak", minutes: 7 * 60 + 30 },
  { label: "Midday", minutes: 11 * 60 },
  { label: "Evening peak", minutes: 18 * 60 },
];

export default function ClockControl({ clock }: { clock: SimClock }) {
  const [open, setOpen] = useState(false);
  const p = jakartaParts(clock.now);

  return (
    <div className="absolute top-3 left-3 z-[700]">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`rounded-lg shadow px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 ${
          clock.simulated ? "bg-amber-400 text-neutral-900" : "bg-white text-neutral-800"
        }`}
      >
        <span>🕒</span>
        {clock.simulated ? `${DAYS[p.day]} ${p.date.slice(5)} ${fmt(p.minutes)} (simulated)` : "Live time"}
      </button>
      {open && (
        <div className="mt-2 w-64 rounded-xl bg-white shadow-lg p-3 text-neutral-900 text-xs space-y-3">
          <div className="font-bold text-sm">Simulate date and time</div>
          <label className="block">
            <span className="text-neutral-500">Date (Jakarta)</span>
            <input
              type="date"
              value={p.date}
              onChange={(e) => e.target.value && clock.setSim(build(e.target.value, p.minutes))}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5"
            />
          </label>
          <label className="block">
            <span className="text-neutral-500">
              Time: <b className="text-neutral-900">{fmt(p.minutes)}</b> ({DAYS[p.day]})
            </span>
            <input
              type="range"
              min={0}
              max={1425}
              step={15}
              value={Math.floor(p.minutes / 15) * 15}
              onChange={(e) => clock.setSim(build(p.date, Number(e.target.value)))}
              className="mt-1 w-full"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((pr) => (
              <button
                key={pr.label}
                onClick={() => clock.setSim(build(p.date, pr.minutes))}
                className="rounded-full bg-blue-50 text-[#1A4BA0] font-semibold px-2.5 py-1"
              >
                {pr.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => clock.setSim(null)} className="flex-1 rounded-lg bg-[#1A4BA0] text-white font-semibold py-1.5">
              Back to live
            </button>
            <button onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-neutral-100 font-semibold py-1.5">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
