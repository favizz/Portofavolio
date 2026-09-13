# Go WASM — Telemetry Anomaly Detector

A small, rule-based anomaly detector written in Go, compiled to WebAssembly
(`GOOS=js GOARCH=wasm`), and run entirely client-side against a simulated
stream of utility-meter telemetry (voltage + flow rate). No backend, no API
call — the Go binary runs in your own tab via `wasm_exec.js`.

The three checks (`main.go`) are a small, self-contained version of the same
style of rolling/explainable rules described for the Netflow IoT metering
project elsewhere in this portfolio: a hard voltage-range check, a rolling
z-score on flow rate (catches a spike/drop relative to *this* device's own
recent behavior), and a sustained-spike window (requires 3 consecutive high
samples, not just one noisy reading, before flagging it).

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Rebuild the WASM binary after editing main.go

```sh
GOOS=js GOARCH=wasm go build -o main.wasm main.go
```

`wasm_exec.js` is Go's own JS glue script, copied from
`$(go env GOROOT)/lib/wasm/wasm_exec.js` (older Go versions: `misc/wasm/`).

## Deploy on Vercel

This is a static site — no build step, no framework. In the Vercel dashboard:
set **Root Directory** to `demos/go-wasm-demo`, leave Build Command / Output
Directory blank (or Output Directory `.`), and deploy.
