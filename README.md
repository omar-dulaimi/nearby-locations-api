# nearby-locations-api

A REST API that answers the question: _"which locations' service-radius disks contain this point?"_
Given a query point `(x, y)`, it returns every location whose circular service area (centre = the
location's coordinates, radius = its `radius` field) reaches that point, sorted by distance. The API
also exposes a detail view and an idempotent upsert for individual locations, with JWT-based
authentication, tiered rate limiting, HTTP caching, structured error responses, and a full OpenAPI
document.

Built with Fastify 5 and TypeScript; the core of the search is a uniform-grid spatial index that
reduces per-query work from O(n) to O(9 cells + small k) regardless of how sparse or large the
coordinate space is.

---

## Endpoints

| Method | Path                | Auth / role required         |
| ------ | ------------------- | ---------------------------- |
| POST   | `/auth/token`       | Public                       |
| GET    | `/locations/search` | Any valid bearer token       |
| GET    | `/locations/{id}`   | Any valid bearer token       |
| PUT    | `/locations/{id}`   | Bearer token + `writer` role |
| GET    | `/health`           | Public                       |
| GET    | `/openapi.json`     | Public                       |
| GET    | `/docs`             | Public                       |

Interactive documentation is available at [`http://localhost:3000/docs`](http://localhost:3000/docs)
when the server is running. The committed OpenAPI document lives at
[`docs/openapi.json`](docs/openapi.json).

---

## How to run

### Prerequisites

- **Node 22+** (`node --version` should print `v22.x.x` or higher)
- No native add-ons; `npm ci` is the only setup step

### Install

```bash
npm ci
```

### Development

```bash
npm run dev          # tsx watch — restarts on source changes
```

### Production-style

```bash
npm run build        # tsc → dist/
npm start            # node dist/server.js
```

### Configuration

Copy `.env.example` to `.env` and edit as needed. The server loads `.env` automatically via
`dotenv`.

| Variable                      | Default                 | Notes                                                                                      |
| ----------------------------- | ----------------------- | ------------------------------------------------------------------------------------------ |
| `PORT`                        | `3000`                  |                                                                                            |
| `HOST`                        | `0.0.0.0`               |                                                                                            |
| `NODE_ENV`                    | `development`           | Set to `production` in deployed environments                                               |
| `LOG_LEVEL`                   | `info`                  | `trace` / `debug` / `info` / `warn` / `error`                                              |
| `LOCATIONS_FILE`              | `./data/locations.json` | Path to the seed data file                                                                 |
| `LOCATIONS_BACKEND`           | `memory`                | `memory` or `postgres` (stretch)                                                           |
| `LOAD_INVALID_FRACTION_ABORT` | `0.5`                   | Abort startup if this fraction of records are invalid                                      |
| `JWT_SECRET`                  | _(dev fallback)_        | **Required in production** — server refuses to start without it when `NODE_ENV=production` |
| `JWT_EXPIRES_IN`              | `1h`                    | Any [ms](https://github.com/vercel/ms) string                                              |
| `AUTH_USERS`                  | _(demo users)_          | JSON array — see below                                                                     |
| `RATE_LIMIT_WRITE_MAX`        | `20`                    | Max write requests per window                                                              |
| `RATE_LIMIT_WRITE_WINDOW`     | `1 minute`              |                                                                                            |
| `RATE_LIMIT_READ_MAX`         | `120`                   | Max read requests per window                                                               |
| `RATE_LIMIT_READ_WINDOW`      | `1 minute`              |                                                                                            |
| `RATE_LIMIT_AUTH_MAX`         | `10`                    | Max `/auth/token` requests per window                                                      |
| `RATE_LIMIT_AUTH_WINDOW`      | `1 minute`              |                                                                                            |
| `RATE_LIMIT_GLOBAL_MAX`       | `200`                   | Global per-IP fallback                                                                     |
| `RATE_LIMIT_GLOBAL_WINDOW`    | `1 minute`              |                                                                                            |
| `SEARCH_CACHE_SIZE`           | `500`                   | In-process LRU entries for search results; `0` disables                                    |
| `DATABASE_URL`                | _(unset)_               | `postgres://…` — only used when `LOCATIONS_BACKEND=postgres`                               |

### Demo credentials

When `AUTH_USERS` is not set the server starts with two throwaway demo accounts:

| Username | Password        | Role     |
| -------- | --------------- | -------- |
| `reader` | `reader-secret` | `reader` |
| `writer` | `writer-secret` | `writer` |

To override them, set `AUTH_USERS` to a JSON array of user objects:

```json
[
  { "username": "alice", "role": "writer", "passwordHash": "salt:hash" },
  { "username": "bob", "role": "reader", "passwordHash": "salt:hash" }
]
```

Generate a `passwordHash` with:

```bash
npm run hash-password -- <plaintext>
```

### curl walkthrough

**1. Obtain a token**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/token \
  -H 'content-type: application/json' \
  -d '{"username":"writer","password":"writer-secret"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
echo $TOKEN
```

Example response:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**2. Search for locations near a point**

```bash
curl -s "http://localhost:3000/locations/search?x=3&y=2" \
  -H "authorization: Bearer $TOKEN"
```

```json
{
  "user-location": "x=3,y=2",
  "locations": [
    {
      "id": "19e1545c-8b65-4d83-82f9-7fcad4a23114",
      "name": "Mantra Restaurant",
      "coordinates": "x=2,y=2",
      "distance": 1
    }
  ]
}
```

**3. Get a location by id**

```bash
curl -s "http://localhost:3000/locations/19e1545c-8b65-4d83-82f9-7fcad4a23114" \
  -H "authorization: Bearer $TOKEN"
```

```json
{
  "name": "Mantra Restaurant",
  "type": "Restaurant",
  "id": "19e1545c-8b65-4d83-82f9-7fcad4a23114",
  "opening-hours": "10:00AM-10:00PM",
  "image": "https://tinyurl.com",
  "coordinates": "x=2,y=2",
  "radius": 2
}
```

**4. Create or replace a location (201 on create, 200 on replace)**

```bash
curl -s -X PUT "http://localhost:3000/locations/00000000-0000-0000-0000-000000000001" \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{
    "id": "00000000-0000-0000-0000-000000000001",
    "name": "New Cafe",
    "type": "Cafe",
    "opening-hours": "8:00AM-6:00PM",
    "image": "https://example.com/cafe.jpg",
    "coordinates": "x=10,y=10",
    "radius": 3
  }'
```

The response is the detail view. On create the server returns **HTTP 201** and a `Location` header
pointing to the new resource; a repeat request returns **200**.

**5. Error examples**

_No token (401):_

```bash
curl -s "http://localhost:3000/locations/search?x=1&y=1"
```

```json
{
  "type": "/problems/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "No Authorization was found in request.headers",
  "instance": "/locations/search?x=1&y=1"
}
```

_Reader token on a write endpoint (403):_

```bash
READER=$(curl -s -X POST http://localhost:3000/auth/token \
  -H 'content-type: application/json' \
  -d '{"username":"reader","password":"reader-secret"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

curl -s -X PUT "http://localhost:3000/locations/00000000-0000-0000-0000-000000000001" \
  -H "authorization: Bearer $READER" \
  -H 'content-type: application/json' \
  -d '{"id":"00000000-0000-0000-0000-000000000001","name":"X","type":"X","opening-hours":"X","image":"https://x.com/x","coordinates":"x=1,y=1","radius":1}'
```

```json
{
  "type": "/problems/forbidden",
  "title": "Forbidden",
  "status": 403,
  "instance": "/locations/00000000-0000-0000-0000-000000000001"
}
```

_Bad query parameters (400 with validation errors):_

```bash
curl -s "http://localhost:3000/locations/search?x=-1&y=abc" \
  -H "authorization: Bearer $TOKEN"
```

```json
{
  "type": "/problems/bad-request",
  "title": "Bad Request",
  "status": 400,
  "detail": "Request validation failed",
  "instance": "/locations/search?x=-1&y=abc",
  "errors": [
    { "field": "querystring/x", "message": "must be >= 0" },
    { "field": "querystring/y", "message": "must be integer" }
  ]
}
```

### Docker

```bash
JWT_SECRET=your-secret-here docker compose up --build
```

The service starts on port 3000. Verify with:

```bash
curl http://localhost:3000/health
```

```json
{ "status": "ok", "locationsLoaded": 10 }
```

To switch to PostgreSQL (stretch), uncomment the `postgres` service in `docker-compose.yml`, set
`LOCATIONS_BACKEND=postgres` and `DATABASE_URL`, then add `depends_on: [postgres]` under `api`.

### Tests and quality checks

```bash
npm test                  # vitest run (~90 tests)
npm run test:coverage     # with v8 coverage report
npm run lint              # eslint
npm run typecheck         # tsc --noEmit
npm run format:check      # prettier check (CI gate)
npm run format            # prettier fix
npm run openapi           # regenerate docs/openapi.json
npm run openapi:check     # assert committed snapshot is up to date (CI gate)
```

---

## API reference

Full interactive documentation is served at `/docs` (Swagger UI) when the server is running. The
committed snapshot is [`docs/openapi.json`](docs/openapi.json).

All error responses use **RFC 7807 / 9457 Problem Details** with content type
`application/problem+json`. The body always contains `type`, `title`, `status`, `detail` (when
applicable), and `instance` (the request URL). Validation errors include an `errors` extension
member — an array of `{ field, message }` objects. Rate-limit responses (429) include a
`Retry-After` header.

---

## Technical rationale

### Stack

**Fastify 5** was chosen for its first-class JSON Schema validation and serialisation pipeline (via
Ajv), a mature plugin ecosystem with official plugins for JWT, rate limiting, Swagger, and ETag, and
good throughput characteristics. It integrates naturally with TypeScript and fits cleanly in a
project that needs the full lifecycle — request validation, auth hooks, route-level config, response
serialisation, and OpenAPI generation — without reaching for an application framework.

**TypeBox** (@sinclair/typebox) gives one schema definition that serves three purposes at once: the
JSON Schema that Fastify/Ajv validates and serialises against, the TypeScript static type inferred
from that schema, and the OpenAPI component emitted by @fastify/swagger. Writing the schema once and
deriving everything from it removes the drift that commonly develops between runtime validation,
TypeScript types, and documentation when these are maintained separately.

**Vitest** is the test runner. It shares the TypeScript and ESM config already in the project,
supports the same import syntax as the source, and has a clean API. There are no native add-ons in
the entire dependency tree — including all dev dependencies — which means `npm ci` works anywhere
Node 22 is available without any build-environment dependencies. This makes the project straightforward
to clone and run in CI or Docker without toolchain surprises.

### Datasource and scalability

Location records live in an in-memory `Map`, hydrated from the JSON file once at startup. All query
paths read from this map; there is no per-request file I/O. The store is accessed through a
`LocationRepository` interface (`getById`, `upsert`, `all`, `count`) so swapping to a different
backend is a single class change with no impact on the service or HTTP layers.

The brief's "high data volume / high load" requirement is addressed by the combination of
**algorithm and architecture**, not by the choice of in-process data structure:

- **Load-once parsing.** The JSON file is read and validated once at boot. Every subsequent request
  reads from the already-hydrated index with no I/O at all.
- **Non-blocking event loop.** Fastify and Node's async I/O handle concurrent requests without
  thread contention. CPU-bound work per request is minimal (see the algorithm below).
- **Spatial index.** The grid index reduces per-query work to O(9 cells + small k) regardless of
  dataset size (see below).
- **Rate limiting.** Bounded request rates protect against runaway traffic; write endpoints have the
  tightest limit (20 req/min).
- **Search result cache.** An optional in-process LRU caches `search` results keyed by a
  data-version counter that increments on every write, so cached entries are automatically
  invalidated when the data changes.

**Memory ceiling.** Each location record is a small flat object (UUID string, two integers for
coordinates, an integer radius, a few short strings for name/type/hours/image). A rough estimate is
150–300 bytes of heap per record — so 1 million records occupy roughly 150–300 MB, well within a
standard Node heap. Beyond a few million records it would be appropriate to move to an external
datastore; the `LocationRepository` interface makes that a single-class change.

**Production path.** The natural next step (listed under "what I'd do with more time") is a
`PostgresLocationRepository` backed by PostgreSQL + PostGIS, using `ST_DWithin` with a GiST spatial
index for the per-location-radius containment query. That plugs directly into the existing interface
without touching the service or HTTP layers. A production deployment would add: read replicas for
horizontal read throughput; a Redis cache for shared search results and rate-limit counters across
instances; stateless application instances behind a load balancer; and, if the coordinate space ever
needed to be distributed across shards, a geohashing scheme such as H3 or S2 cells to partition
the spatial index horizontally. The `LOCATIONS_BACKEND`/`DATABASE_URL` configuration knobs and a
commented `postgres` service in `docker-compose.yml` are already in place as the seam for this
extension.

### Search algorithm

The query is: _"return every location whose service-radius disk contains the query point Q"_, i.e.
every location where `distance(Q, location.coordinates) ≤ location.radius`. This is a
**per-location-radius point-enclosure** query — it is _not_ a fixed-radius "find all points within R
of Q" query. Each location has its own radius, and the condition is the reverse: the location's disk
must reach Q, not Q's disk must reach the location.

The brief states that radii are intentionally small ("not too big — to avoid returning lots of
results at once") while coordinates can be large and sparse. That combination is ideal for a
**uniform grid index** (`src/spatial/grid-index.ts`).

**Structure.** The grid maintains the invariant `cellSize = max(radius over all indexed locations)`.
Each location is bucketed into the cell that contains its centre, identified by the integer cell
coordinates `(⌊x / cellSize⌋, ⌊y / cellSize⌋)`. The grid is stored as a sparse `Map<string, Location[]>`,
so the coordinate range has no cost — only occupied cells exist.

**Query.** To find all locations whose disk contains Q:

1. Compute Q's cell `(cx, cy)`.
2. Iterate over the 3×3 block of cells centred on `(cx, cy)` — nine cells.
3. For each location in those cells, compute the exact Euclidean distance and check
   `distance ≤ location.radius`.

**Correctness argument.** If a location's disk contains Q, then the distance from the location's
centre to Q is at most `location.radius`. Because `location.radius ≤ cellSize` (the invariant), the
distance from the centre to Q is at most `cellSize`. A centre that is at most `cellSize` away from Q
must lie in Q's cell or one of the 8 adjacent cells. Therefore, every qualifying location is
examined — there are no false negatives.

**Complexity.** Each query inspects at most 9 cells. If the data is roughly uniform, each cell holds
approximately `n / (total cells)` locations; in the common case the number of candidates `k` is
small and the overall cost is effectively O(1) per query. Insert and remove are O(1). The sparse map
means that an arbitrarily large coordinate range costs nothing in memory.

**Linear baseline.** `LinearScanIndex` (`src/spatial/linear-scan-index.ts`) implements the same
interface with a straightforward O(n) scan. It is kept as a correctness baseline: a randomised
property test (`test/unit/grid-vs-linear.test.ts`) generates random datasets and queries and
asserts that `GridIndex` and `LinearScanIndex` return the same results in all cases, including after
mixed upserts and removes that trigger a radius-growth rebuild. A formal benchmark against the
10 000-entry `data/locations_big.json` dataset is listed under "what I'd do with more time" (Task
15.3 of the implementation plan); the grid's advantage over the linear scan grows with dataset size
and is most pronounced when queries are concentrated in a small region of the coordinate space.

**Skew caveat.** If many locations cluster in the same cell, that cell's scan degrades toward O(its
population). Mitigations include adaptive or hierarchical cell sizing (quadtree / k-d tree) or
moving to a GiST-indexed PostGIS column for very large or skewed datasets.

### Radius-growth rebuild: design choice 2a vs 2c

When a `PUT` arrives whose `radius` exceeds the current `cellSize`, the 3×3-scan invariant would be
broken: the new location's disk could reach beyond the neighbouring cells, producing false negatives.

Two options were considered:

- **2a (implemented): rebuild the index with the new, larger cell size.** The `upsert` method
  detects `radius > cellSize`, collects all existing locations, adds the new one, and calls
  `bulkLoad` — an O(n) operation.
- **2c (rejected): maintain a separate overflow list** for locations whose radius exceeds `cellSize`,
  and scan the overflow list on every query.

**Why 2a.** The brief is explicit that radii are small ("won't be too big") so the rebuild fires
rarely or never in practice. Write endpoints are rate-limited to 20 requests per minute, capping
the worst-case rebuild frequency. A rebuild of even 1 million entries takes tens of milliseconds on
modern hardware — a one-off write-latency blip, not a steady-state throughput cost. The payoff is a
single data structure with one always-true invariant (`cellSize == max radius`), which makes
`search`, `insert`, and `remove` all special-case-free and trivially testable. Option 2c would keep
per-query cost lower on a pathological sequence of expanding-radius writes, but at the cost of
branching logic in every search and two code paths to maintain and test. If radii were genuinely
unbounded and the overflow list could grow large, that trade-off would be worth making — and at that
point the right tool would be an R-tree (`rbush`) or PostGIS `ST_DWithin`.

### Authentication

`POST /auth/token` accepts a JSON body `{ username, password }`, checks the credentials against the
configured user list (see `AUTH_USERS`), and returns a signed HS256 JWT containing `{ sub, role }`
claims with a configurable TTL (default `1h`). Every data endpoint (`/locations/*`) requires a
valid bearer token in the `Authorization` header; `PUT /locations/{id}` additionally requires the
token's `role` claim to equal `writer`. The public endpoints — `/auth/token`, `/health`,
`/openapi.json`, `/docs` — require no token.

`JWT_SECRET` is required when `NODE_ENV=production`; the server refuses to start without it.
Passwords are hashed with scrypt (`node:crypto`), so the credential check is deliberately slow (a
brute-force deterrent), which is why the `/auth/token` endpoint has its own strict rate limit.

**Deliberately out of scope.** Refresh tokens, token revocation / a denylist, a real user store or
external IdP, and key rotation are all omitted. For a production system the right choices would be
argon2id password hashing, a database-backed user store or an external identity provider (e.g.
Auth0, Cognito), and short-lived access tokens paired with refresh tokens. For a contained coding
exercise, a clean and correct minimal model is more valuable than a half-built auth subsystem with
seams for features that are not exercised by any test.

### Rate limiting

The brief required rate limiting on write endpoints. The implementation goes further with a tiered
strategy:

| Tier     | Endpoint              | Default   | Rationale                                                                                                    |
| -------- | --------------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| `write`  | `PUT /locations/{id}` | 20 / min  | Directly specified by the brief                                                                              |
| `read`   | `GET /locations/*`    | 120 / min | Unbounded read traffic that runs the grid query + sort + serialise is an obvious abuse vector                |
| `auth`   | `POST /auth/token`    | 10 / min  | Unauthenticated endpoint running a deliberately slow hash compare — a brute-force / CPU-amplification target |
| `global` | All other routes      | 200 / min | Per-IP fallback                                                                                              |

Authenticated routes are keyed by the token subject (`sub` claim); unauthenticated routes by client
IP. Rate-limit exceeded responses are returned as `application/problem+json` with status 429 and a
`Retry-After` header. All limits are env-configurable. In a multi-instance deployment the rate
limiter would be backed by Redis (via `@fastify/rate-limit`'s store option) so limits are enforced
globally across instances rather than per-process.

### Caching

**HTTP caching.** All GET endpoints include a weak `ETag` header (generated by `@fastify/etag`
from the response body). Authenticated endpoints (`GET /locations/search`, `GET /locations/{id}`)
use `Cache-Control: private, no-cache`:

- `private` — a shared cache (CDN, proxy) must not serve this response to a different user or to an
  unauthenticated request.
- `no-cache` — "store but always revalidate". Because the ETag changes whenever a `PUT` modifies the
  index, an unchanged record or search result is validated cheaply with a `304 Not Modified` rather
  than a full response body.

The genuinely public, stable endpoints (`/health`, `/openapi.json`) use `Cache-Control: public, max-age=…`
and can be placed behind a CDN. To cache authenticated responses at the edge you would terminate
auth at the gateway layer and then mark the downstream responses `public` with `s-maxage`.

**In-process cache.** `LocationService.search` uses an optional LRU (`SearchCache`) keyed by
`<dataVersion>:<x>:<y>`. The version counter increments on every `upsert`, so cached entries for
stale data are never served — no explicit invalidation is needed. `SEARCH_CACHE_SIZE` controls the
entry limit; set it to `0` to disable. In a multi-instance deployment this would be replaced by a
shared Redis cache. The spatial index itself also functions as a query-optimised projection of the
data — loading it once at boot means zero per-request I/O.

### Error handling

All error responses conform to **RFC 7807 / 9457 Problem Details**. Every error body contains:

- `type` — a stable relative URI identifying the problem type (e.g. `/problems/bad-request`)
- `title` — a human-readable summary
- `status` — the HTTP status code
- `detail` — a description of the specific occurrence (when applicable)
- `instance` — the request URL

Validation errors include an `errors` extension member — an array of `{ field, message }` objects —
so clients can map errors back to specific request fields without parsing the `detail` string.

The response content type is `application/problem+json` throughout, including rate-limit (429) and
server error (500) responses. Server errors log the full stack trace and request id but return only
a safe generic message to the caller.

### Observability

Requests are logged with [pino](https://github.com/pinojs/pino) at `info` level by default. Each
request receives a unique id that appears in all log lines for that request and in the `requestId`
field of 500 error responses, making incident correlation straightforward. In development, logs are
pretty-printed via `pino-pretty`; in production they are emitted as structured JSON for ingestion by
a log aggregator. In a full production deployment you would add Prometheus metrics (request rate,
latency percentiles, error rate) and OpenTelemetry distributed tracing — these are out of scope for
this exercise.

### Testing

The test suite uses Vitest and is split into unit and integration tests.

**Unit tests** cover: the `Coordinates` domain helpers (`parseCoordinates`, `formatCoordinates`,
`euclideanDistance`, `roundDistance`); the `Location` view functions (`toSearchView`,
`toDetailView`); `GridIndex` (correct results on a worked example, boundary equality, sparse
coordinates, upsert reindex, remove, and the radius-growth rebuild); `LinearScanIndex`; a
**randomised cross-check** (`test/unit/grid-vs-linear.test.ts`) that generates random datasets
and random queries and asserts `GridIndex` and `LinearScanIndex` always agree — including after a
mixed sequence of upserts and removes that triggers a rebuild; `LocationService` (search,
upsert, cache invalidation); `SearchCache` (LRU eviction, zero-capacity disabled mode);
`InMemoryLocationRepository`; the JSON loader (skip-invalid-warn, fail-fast threshold);
`RawLocationSchema` and `rawToLocation`; `loadConfig` (all env vars, production guard, bad
values); password hashing and verification; the `Problem` class and `problemFromError`; and the
user list helpers.

**Integration tests** exercise every endpoint via `fastify.inject` (no real network): happy-path
responses with correct shapes and status codes; 400 on invalid query params and malformed UUIDs;
401 on missing / invalid / expired tokens; 403 on insufficient role; 404 on unknown ids; 429 on
rate-limit breach; the auth token flow; `PUT` create-then-replace semantics (201 → `Location`
header → 200 on repeat); id-mismatch 400; search result sorting and tie-breaking; the OpenAPI
document structure; `ETag` and `Cache-Control` headers; rate-limiter configuration; and an
end-to-end smoke test that boots the server with the real seed file and calls all the happy paths
in sequence.

### What I'd do with more time

- **PostgreSQL + PostGIS repository.** A `PostgresLocationRepository` using `ST_DWithin` with a
  GiST spatial index, wired in via the existing `LOCATIONS_BACKEND=postgres` switch and
  `DATABASE_URL` config knob. A `postgres` service is already sketched (commented out) in
  `docker-compose.yml`. A second CI job would run the Postgres-gated integration tests.
- **Documented benchmark + perf-sanity CI test.** A `scripts/benchmark.ts` that loads
  `data/locations_big.json` (10 000 entries) into both a `GridIndex` and a `LinearScanIndex` and
  times N random queries against each, with numbers pasted into this README. A lightweight
  `test/integration/perf-sanity.test.ts` to catch regressions.
- **`/problems/*` documentation pages** for the Problem `type` URIs, so the links in error
  responses resolve to human-readable descriptions.
- **CI matrix for Node 20 + 22.**
- **Pagination on `search`** if the dataset could ever be large enough that a result set exceeds a
  reasonable page size.
- **Refresh tokens.**

---

## Project layout

```
src/
├── auth/           # Password hashing (scrypt) and user-record helpers
├── cache/          # SearchCache — LRU keyed by data-version
├── domain/         # Pure domain types and functions (coordinates, location views)
├── http/
│   ├── problems    # Problem class, factory helpers, error handler installation
│   ├── routes/     # Fastify route plugins: auth, health, locations
│   └── schemas/    # TypeBox HTTP-layer schemas (request/response shapes)
├── plugins/        # Fastify plugins: auth (JWT), rate-limit, http-cache, swagger
├── repository/     # LocationRepository interface + InMemoryLocationRepository + JSON loader
├── schemas/        # Shared raw-location schema (wire format) and AJV format registrations
├── service/        # LocationService — orchestrates repo, index, and cache
├── spatial/        # LocationIndex interface, GridIndex, LinearScanIndex
├── types/          # Fastify type augmentations
├── app.ts          # App factory (registers plugins and routes)
├── config.ts       # loadConfig — reads env vars, validates, returns a typed Config
├── logger.ts       # Pino logger factory
└── server.ts       # Entry point — loads config, builds app, starts listening
```

---

## License

[MIT](LICENSE)
