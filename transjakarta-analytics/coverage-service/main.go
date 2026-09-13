// Coverage service: a real geospatial batch job, not an HTTP server. It
// loads every real stop coordinate from Postgres, builds a spatial-hash
// index over them (so nearest-stop lookups don't degrade to an O(cells *
// stops) brute-force scan across ~8,000+ real stops), grids the network's
// actual bounding box at a configurable resolution, and for each cell
// computes real haversine distance to the nearest stop. Results are
// written to coverage_cells for the API to serve read-only.
package main

import (
	"context"
	"fmt"
	"math"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	earthRadiusMeters = 6371000.0
	// Grid resolution matches the walkable-distance standard used
	// elsewhere in this project (see api/src/config.ts): if the standard
	// changes, this should too.
	gridResolutionMeters = 500.0
	walkableStandardM    = 500.0
	// Spatial-hash bucket size in degrees (~1.1km at this latitude) -
	// coarser than the grid so each bucket holds a handful of stops.
	bucketSizeDeg = 0.01
)

type stop struct {
	id  string
	lat float64
	lon float64
}

type bucketKey struct {
	latBucket int
	lonBucket int
}

func haversineMeters(lat1, lon1, lat2, lon2 float64) float64 {
	toRad := func(d float64) float64 { return d * math.Pi / 180 }
	dLat := toRad(lat2 - lat1)
	dLon := toRad(lon2 - lon1)
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(toRad(lat1))*math.Cos(toRad(lat2))*math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadiusMeters * c
}

func bucketFor(lat, lon float64) bucketKey {
	return bucketKey{
		latBucket: int(math.Floor(lat / bucketSizeDeg)),
		lonBucket: int(math.Floor(lon / bucketSizeDeg)),
	}
}

// nearestStop searches the target cell's bucket, then expands outward ring
// by ring (3x3, 5x5, ...) until at least one candidate is found and no
// closer stop could possibly exist in a further ring - a standard
// spatial-hash nearest-neighbor search, not a full scan.
func nearestStop(index map[bucketKey][]stop, lat, lon float64) (stop, float64, bool) {
	center := bucketFor(lat, lon)
	var best stop
	bestDist := math.Inf(1)
	found := false

	for ring := 0; ring < 50; ring++ { // 50 rings * 1.1km ~= 55km safety cap
		any := false
		for dLat := -ring; dLat <= ring; dLat++ {
			for dLon := -ring; dLon <= ring; dLon++ {
				// Only the outer edge of this ring (inner cells already
				// checked in previous iterations).
				if ring > 0 && abs(dLat) != ring && abs(dLon) != ring {
					continue
				}
				key := bucketKey{center.latBucket + dLat, center.lonBucket + dLon}
				candidates, ok := index[key]
				if !ok {
					continue
				}
				any = true
				for _, s := range candidates {
					d := haversineMeters(lat, lon, s.lat, s.lon)
					if d < bestDist {
						bestDist = d
						best = s
						found = true
					}
				}
			}
		}
		// Once we have a candidate, one more ring guarantees correctness
		// (a closer point could still sit just across the searched
		// boundary), then stop - good enough for a 500m-resolution grid
		// where bucket size is ~1.1km.
		if found && (any || ring > 0) {
			return best, bestDist, true
		}
	}
	return best, bestDist, found
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

func metersToDegreesLat(m float64) float64 {
	return m / 111320.0 // ~constant everywhere
}

func metersToDegreesLon(m, atLat float64) float64 {
	return m / (111320.0 * math.Cos(atLat*math.Pi/180))
}

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://localhost/transjakarta"
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		fmt.Println("connect error:", err)
		os.Exit(1)
	}
	defer pool.Close()

	start := time.Now()

	rows, err := pool.Query(ctx, `SELECT stop_id, stop_lat, stop_lon FROM stops`)
	if err != nil {
		fmt.Println("query error:", err)
		os.Exit(1)
	}
	var stops []stop
	minLat, maxLat := math.Inf(1), math.Inf(-1)
	minLon, maxLon := math.Inf(1), math.Inf(-1)
	index := make(map[bucketKey][]stop)

	for rows.Next() {
		var s stop
		if err := rows.Scan(&s.id, &s.lat, &s.lon); err != nil {
			fmt.Println("scan error:", err)
			os.Exit(1)
		}
		stops = append(stops, s)
		if s.lat < minLat {
			minLat = s.lat
		}
		if s.lat > maxLat {
			maxLat = s.lat
		}
		if s.lon < minLon {
			minLon = s.lon
		}
		if s.lon > maxLon {
			maxLon = s.lon
		}
		key := bucketFor(s.lat, s.lon)
		index[key] = append(index[key], s)
	}
	rows.Close()

	fmt.Printf("Loaded %d real stops. Bounding box: [%.4f,%.4f] to [%.4f,%.4f]\n", len(stops), minLat, minLon, maxLat, maxLon)

	// Pad the bounding box by one grid cell so edge stops get full coverage.
	midLat := (minLat + maxLat) / 2
	padLat := metersToDegreesLat(gridResolutionMeters)
	padLon := metersToDegreesLon(gridResolutionMeters, midLat)
	minLat -= padLat
	maxLat += padLat
	minLon -= padLon
	maxLon += padLon

	latStep := metersToDegreesLat(gridResolutionMeters)

	var cellRows [][]any
	totalCells := 0
	coveredCells := 0

	for lat := minLat; lat <= maxLat; lat += latStep {
		lonStep := metersToDegreesLon(gridResolutionMeters, lat)
		for lon := minLon; lon <= maxLon; lon += lonStep {
			nearest, dist, ok := nearestStop(index, lat, lon)
			if !ok {
				continue
			}
			within := dist <= walkableStandardM
			totalCells++
			if within {
				coveredCells++
			}
			cellRows = append(cellRows, []any{lat, lon, nearest.id, dist, within})
		}
	}

	fmt.Printf("Computed %d grid cells (%.1f%% within %vm of a stop) in %v\n",
		totalCells, 100*float64(coveredCells)/float64(totalCells), int(walkableStandardM), time.Since(start))

	tx, err := pool.Begin(ctx)
	if err != nil {
		fmt.Println("tx begin error:", err)
		os.Exit(1)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `TRUNCATE coverage_cells RESTART IDENTITY`); err != nil {
		fmt.Println("truncate error:", err)
		os.Exit(1)
	}

	const insertSQL = `
		INSERT INTO coverage_cells (cell_lat, cell_lon, nearest_stop_id, distance_meters, within_standard)
		VALUES ($1, $2, $3, $4, $5)
	`
	batch := &pgx.Batch{}
	for _, r := range cellRows {
		batch.Queue(insertSQL, r...)
	}
	br := tx.SendBatch(ctx, batch)
	for range cellRows {
		if _, err := br.Exec(); err != nil {
			fmt.Println("batch insert error:", err)
			os.Exit(1)
		}
	}
	if err := br.Close(); err != nil {
		fmt.Println("batch close error:", err)
		os.Exit(1)
	}

	if err := tx.Commit(ctx); err != nil {
		fmt.Println("commit error:", err)
		os.Exit(1)
	}

	fmt.Printf("Wrote %d rows to coverage_cells. Total time: %v\n", len(cellRows), time.Since(start))
}
