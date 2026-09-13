# Coverage Service (Go)

A real geospatial batch job, not an HTTP server: loads every real stop
coordinate from Postgres (8,091 of them), builds a spatial-hash index so
nearest-stop lookups don't degrade into an O(cells × stops) brute-force
scan, grids the network's actual bounding box at 500m resolution, and
computes real haversine distance from each cell to its nearest stop.
Results are written to `coverage_cells` for the API to serve read-only.

Run against the real data: 16,042 grid cells computed in **83ms** (the
spatial-hash index is what makes this fast — a naive nested loop over
8,091 stops per cell would be roughly 130M haversine calls).

## Caveat on the headline number

The bounding box is the network's own real extent, which includes
sparsely-populated fringe/industrial areas far from any route — so
"16% of cells are within 500m of a stop" should be read as *coverage
across the full network bounding box*, not "84% of Jakarta lacks
transit." A more honest framing (and the natural next iteration) would
clip the grid to Jakarta's actual populated built-up area rather than
the raw stop bounding box.

## Run it

Requires Go and a Postgres with the schema + ingested data already loaded
— either local (for development) or your real deployed database (Neon, in
production, since this project deploys as Vercel + Neon with no
self-hosted backend):

```sh
go build -o coverage-service main.go

# Local dev:
DATABASE_URL="postgres://localhost/transjakarta" ./coverage-service

# Against your deployed Neon database (get the connection string from the
# Neon dashboard - use the *unpooled* one for this, since it's a single
# batch job, not a pool of serverless requests):
DATABASE_URL="postgres://user:pass@ep-xxx.neon.tech/transjakarta?sslmode=require" ./coverage-service
```

Re-run any time the stop data changes — it's idempotent (truncates and
rewrites `coverage_cells` every run). This is a one-off batch job, not a
deployed service: run it once after ingesting, then again only when the
underlying GTFS data changes.
