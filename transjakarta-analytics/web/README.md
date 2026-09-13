# Web (Next.js)

Dashboard over the real, computed TransJakarta analytics: an overview
page, a Leaflet map (all 8,091 real stops + the real coverage grid), a
service-frequency page (real headway per route, chart + table), and a
transfer-network page (React Flow graph of routes sharing real stops).

Deploys to Render as its own web service (see the root `render.yaml`),
calling the separately-deployed `api/` service.

## Run locally

```sh
npm install
npm run dev
```

Requires the API running (`NEXT_PUBLIC_API_URL` in `.env.local`, defaults
to `http://localhost:3001`).

## Notes

- `StopsMap` and `NetworkGraphView` are client components (`"use client"`)
  — Leaflet and React Flow both need `window`/DOM access, so the map page
  loads `StopsMap` via `next/dynamic` with `ssr: false`.
- `NEXT_PUBLIC_API_URL` is inlined into the client bundle **at build
  time** — changing it in Render's dashboard requires a rebuild, not just
  a restart, before it takes effect.
- Data-driven pages (`/`, `/headway`, `/network`) have
  `export const dynamic = "force-dynamic"` — without it, Next.js would
  statically prerender them at build time and freeze the numbers from
  whenever the last build ran, defeating the point of a live dashboard.
