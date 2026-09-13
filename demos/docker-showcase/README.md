# Docker — Multi-Service Architecture Showcase

Docker is a packaging/orchestration tool — there's no "live in the
browser" form of it, and Vercel doesn't host containers at all. This page
presents a real six-service `docker-compose.yml` (`stack/`) for an IoT
telemetry platform, shaped the same way as the Netflow project's own
deployment (MQTT broker, Redis-backed job queue, nginx in front of the
API): nginx &rarr; api &rarr; (postgres + redis) &larr; worker (2 replicas) &larr; mosquitto &larr; meters.

## Validate the compose file

```sh
cd stack
docker compose config   # resolves and validates the file, prints nothing on success
```

(Already validated during development with a plain YAML parse — see the
showcase page's intro for what that confirmed.)

## Actually run it

Requires Docker Desktop:

```sh
cd stack
docker compose up --build
```

nginx listens on `localhost:8080` (`/health`, `/api/*`); mosquitto on
`localhost:1883`. There's no telemetry publisher included — point any MQTT
client at `meters/<id>/telemetry` with a `{"voltage":..,"flow":..}` payload
to see it flow through.

## Run the showcase page locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Static page (`index.html`/`style.css`/`script.js`) — the topology diagram
is Mermaid (loaded from CDN), and the source viewer fetches the real files
under `stack/` and syntax-highlights them with highlight.js.

## Deploy on Vercel

Static site. Set **Root Directory** to `demos/docker-showcase`, leave Build
Command / Output Directory blank, and deploy. The `stack/` folder is just
static files served alongside the page — nothing runs.
