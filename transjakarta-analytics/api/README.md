# API (NestJS)

Serves real, computed analytics over the ingested GTFS data. No ORM —
plain `pg` queries, since the schema is simple and hand-written SQL keeps
the actual computation (headway averages, spatial coverage summary,
route-pair transfer graph) legible.

Deploys to Render as its own web service (see the root `render.yaml`).
Headway stats are recomputed automatically once at boot
(`HeadwayService.onModuleInit`), so a fresh deploy is fully working
without a manual call.

## Endpoints

| Method | Path | What it returns |
|---|---|---|
| GET | `/health` | `{status: "ok"}` — Render's health check target |
| GET | `/routes` | All 240 routes with trip counts |
| GET | `/routes/:id/stops` | Real stops served by one route |
| GET | `/stops` | All 8,091 real stops (id, name, lat/lon) |
| GET | `/headway/summary` | Every route's real avg/min/max headway, flagged against the frequent-service standard |
| POST | `/headway/compute` | Recomputes headway stats from `frequencies.txt` data (run after re-ingesting) |
| GET | `/coverage/summary` | Real coverage-grid stats (from the Go coverage-service's output) |
| GET | `/coverage/cells` | Every computed grid cell, for the map overlay |
| GET | `/network/graph?minSharedStops=3&topN=30` | Real route-to-route transfer graph (routes sharing stops) |

## Run locally

```sh
npm install
DATABASE_URL="postgres://localhost/transjakarta" npm run dev
```

Requires the schema applied and data ingested first (see the root README).

## Environment variables

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (local, or Neon in production) |
| `PORT` | Render sets this automatically; defaults to 3001 locally |
| `CORS_ORIGIN` | The frontend's origin (`*` for local dev; the deployed `web` URL in production) |
