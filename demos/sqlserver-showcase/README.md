# SQL Server — Schema & ERD Showcase

SQL Server is a database engine — there's no "live in the browser" form of
it to deploy on Vercel. Instead of faking a query console with no real
database behind it, this page presents the real T-SQL DDL (`schema.sql`)
for an IT asset management database as an interactive ER diagram (rendered
client-side with Mermaid) and a per-table DDL browser, plus a set of
illustrative (non-executable) sample queries.

Same domain as the Java Spring Boot showcase elsewhere in this portfolio:
assets, an append-only movement/handover audit trail, and a separate
logging database for `AuditLog` — matching the two-database split
described in the PT Toyota Astra Motor "WMS" internship report.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

`script.js` fetches `schema.sql` directly and parses out each
`CREATE TABLE` block client-side — no build step, no server.

## Deploy on Vercel

Static site. Set **Root Directory** to `demos/sqlserver-showcase`, leave
Build Command / Output Directory blank, and deploy.
