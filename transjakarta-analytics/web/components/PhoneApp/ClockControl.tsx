"use client";

import { useState } from "react";
import { useNow } from "./shared";

export interface SimClock {
  now: Date;
  speed: number;
  live: boolean;
  setTime: (d: Date) => void;
  setSpeed: (n: number) => void;
  toLive: () => void;
}

/** A demo clock. Starts at the real Jakarta time but runs fast (default 60x) so buses visibly move. `tickMs` is how often the UI refreshes. */
export function useSimClock(tickMs: number): SimClock {
  useNow(tickMs);
  const [s, setS] = useState(() => ({ base: Date.now(), setAt: Date.now(), speed: 60, live: false }));
  const now = new Date(s.base + (Date.now() - s.setAt) * s.speed);
  return {
    now,
    speed: s.speed,
    live: s.live,
    setTime: (d) => setS({ base: d.getTime(), setAt: Date.now(), speed: s.speed, live: false }),
    setSpeed: (n) => setS({ base: now.getTime(), setAt: Date.now(), speed: n, live: false }),
    toLive: () => setS({ base: Date.now(), setAt: Date.now(), speed: 1, live: true }),
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
const SPEEDS = [
  { label: "Pause", value: 0 },
  { label: "1x", value: 1 },
  { label: "10x", value: 10 },
  { label: "60x", value: 60 },
];

export default function ClockControl({ clock }: { clock: SimClock }) {
  const [open, setOpen] = useState(false);
  const p = jakartaParts(clock.now);
  const speedLabel = clock.speed === 0 ? "paused" : `${clock.speed}x`;

  return (
    <>
      {open && <div className="fixed inset-0 z-[690] bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />}
      <div className="absolute top-3 left-3 z-[700]">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`rounded-lg shadow px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 ${
            clock.live ? "bg-white text-neutral-800" : "bg-amber-400 text-neutral-900"
          }`}
        >
          <span>🕒</span>
          {clock.live ? "Live time" : `${DAYS[p.day]} ${fmt(p.minutes)} · ${speedLabel}`}
        </button>
        {open && (
          <div className="mt-2 w-64 rounded-xl bg-white shadow-lg p-3 text-neutral-900 text-xs space-y-3">
            <div className="font-bold text-sm">Demo clock</div>
            <div>
              <span className="text-neutral-500">Speed (1 second = {clock.speed === 0 ? "0" : clock.speed} sec)</span>
              <div className="mt-1 flex gap-1.5">
                {SPEEDS.map((sp) => (
                  <button
                    key={sp.label}
                    onClick={() => clock.setSpeed(sp.value)}
                    className={`flex-1 rounded-lg py-1.5 font-semibold ${clock.speed === sp.value ? "bg-[#1A4BA0] text-white" : "bg-neutral-100"}`}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <label className="flex-1 block min-w-0">
                <span className="text-neutral-500">Date</span>
                <input
                  type="date"
                  value={p.date}
                  onChange={(e) => e.target.value && clock.setTime(build(e.target.value, p.minutes))}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5"
                />
              </label>
              <label className="flex-1 block min-w-0">
                <span className="text-neutral-500">Time ({DAYS[p.day]})</span>
                <input
                  type="time"
                  step={60}
                  value={fmt(p.minutes)}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number);
                    if (!Number.isNaN(h) && !Number.isNaN(m)) clock.setTime(build(p.date, h * 60 + m));
                  }}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((pr) => (
                <button key={pr.label} onClick={() => clock.setTime(build(p.date, pr.minutes))} className="rounded-full bg-blue-50 text-[#1A4BA0] font-semibold px-2.5 py-1">
                  {pr.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => clock.toLive()} className="flex-1 rounded-lg bg-[#1A4BA0] text-white font-semibold py-1.5">
                Real time
              </button>
              <button onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-neutral-100 font-semibold py-1.5">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
