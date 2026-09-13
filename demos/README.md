# Tech Demos

Small, standalone demo projects for technologies with real backing in
`dev/FACT.md` but no footprint on the portfolio site yet. Each subfolder
deploys as its own **separate Vercel project** — in the Vercel dashboard,
create a new project from this repo and set **Root Directory** to the
subfolder, leaving Build Command / Output Directory blank unless a
subfolder's own README says otherwise. No demo here needs a live backend
on Vercel; each is either fully static/client-side or (for the three
technologies that fundamentally can't run without one) an honest
source/architecture showcase instead of a live app.

| Folder | Technology | What it is | Live on Vercel? |
|---|---|---|---|
| [`yolo-cv-demo/`](yolo-cv-demo/) | Computer vision | Real-time object detection (TensorFlow.js, COCO-SSD) via webcam or image upload | Yes — fully static |
| [`go-wasm-demo/`](go-wasm-demo/) | Go | Rolling anomaly detector (rule-based, Netflow-style) compiled to WebAssembly | Yes — fully static |
| [`cpp-wasm-demo/`](cpp-wasm-demo/) | C/C++ | Stack-based infix expression evaluator (shunting-yard), compiled via Emscripten | Yes — fully static |
| [`firebase-demo/`](firebase-demo/) | Firebase | Realtime guestbook + visitor counter via Firestore, no custom backend | Yes, once you plug in your own Firebase project config (see its README) |
| [`java-showcase/`](java-showcase/) | Java / Spring Boot | A real, compiling (`mvn compile` verified) IT-asset-management REST API, shown as source + architecture | No — Vercel can't run a JVM; source/architecture page only |
| [`sqlserver-showcase/`](sqlserver-showcase/) | SQL Server | Real T-SQL DDL for the same asset-management schema, interactive ERD (Mermaid) + table browser | No — a database engine has no static form; schema/ERD page only |
| [`docker-showcase/`](docker-showcase/) | Docker | A real, YAML-valid 6-service `docker-compose.yml` (IoT telemetry platform), topology diagram + source browser | No — Docker doesn't run on Vercel; architecture page only |
| [`flutter-demo/`](flutter-demo/) | Flutter | A small standalone Flutter app, built for web | Yes — static Flutter web build |

## Why the split

Three of these technologies (Java/Spring Boot, SQL Server, Docker) have no
honest "live in the browser, no backend" form — a JVM service, a database
engine, and a container orchestration tool all fundamentally need
something running server-side. Rather than fake a live demo for those
three, each gets a real, verified (compiled / YAML-validated) artifact
presented as source and architecture instead — see each folder's own
README for exactly what was verified and how.

Everything else (Flutter, Go, C/C++, computer vision, Firebase) really can
run with zero backend, so each of those is a genuine, interactive, live
page.
