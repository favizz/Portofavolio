# Java / Spring Boot — Architecture Showcase

Why a "showcase" page and not a live Vercel demo: Vercel's backend story is
short-lived serverless functions (Node, Python, Go, Ruby) — it does not run
long-lived JVM processes. Rather than fake a live Java backend, this is
a real, **compiling** Spring Boot module (`api-source/`, verified with
`mvn compile` — 10 source files, BUILD SUCCESS) presented as source +
architecture instead.

The module is a compact re-implementation of the IT asset management API
described in the PT Toyota Astra Motor "WMS" internship: asset
movement/handover tracking with an append-only audit trail, JWT-bearer
auth, and role-based (`@PreAuthorize`) access control at the controller
layer, not just hidden in a frontend.

## Run the real API yourself

```sh
cd api-source
mvn spring-boot:run
```

Starts on `localhost:8080` against an in-memory H2 database — no external
services required. Production config would point `spring.datasource.url`
at SQL Server instead (see `application.properties`).

## Run the showcase page locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

It's a static page (`index.html`/`style.css`/`script.js`) that fetches and
syntax-highlights (highlight.js via CDN) the real source files under
`api-source/`.

## Deploy on Vercel

Static site, no build step. Set **Root Directory** to `demos/java-showcase`,
leave Build Command / Output Directory blank, and deploy. The `api-source/`
folder is just static files served alongside the page — nothing runs.
