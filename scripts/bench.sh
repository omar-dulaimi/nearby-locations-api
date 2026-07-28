#!/usr/bin/env bash
#
# End-to-end benchmark: memory backend vs postgres backend.
#
# Brings up each stack in turn with `docker-compose.bench.yml` layered on top
# (in-app search cache and rate limits disabled so the numbers reflect the
# spatial path, not the LRU or the limiter), hammers GET /locations/search
# via autocannon, then prints a side-by-side comparison.
#
# Usage:   ./scripts/bench.sh                          # 30s @ 50 conns
#          DURATION=60 CONNECTIONS=100 ./scripts/bench.sh
#          QUERY='x=2500&y=2500' ./scripts/bench.sh

set -euo pipefail

cd "$(dirname "$0")/.."

BENCH_OVERLAY=docker-compose.bench.yml
DURATION=${DURATION:-30}
WARMUP=${WARMUP:-5}
CONNECTIONS=${CONNECTIONS:-50}
QUERY=${QUERY:-x=1000&y=1000}
ENDPOINT="http://localhost:3000/locations/search?${QUERY}"

MEM_JSON=$(mktemp)
PG_JSON=$(mktemp)
trap 'rm -f "$MEM_JSON" "$PG_JSON"' EXIT

# ── helpers ───────────────────────────────────────────────────────────────

compose_up() {
  local files=("$@")
  local flags=()
  for f in "${files[@]}"; do flags+=(-f "$f"); done
  docker compose "${flags[@]}" up -d --build >/dev/null
}

compose_down() {
  local files=("$@")
  local flags=()
  for f in "${files[@]}"; do flags+=(-f "$f"); done
  docker compose "${flags[@]}" down -v >/dev/null 2>&1 || true
}

wait_for_api() {
  for _ in $(seq 1 60); do
    if curl -fsS http://localhost:3000/health >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "ERROR: api did not come up in time" >&2
  docker compose ps >&2
  exit 1
}

fetch_token() {
  curl -s -X POST http://localhost:3000/auth/token \
    -H 'content-type: application/json' \
    -d '{"username":"reader","password":"reader-secret"}' \
    | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4
}

run_bench() {
  local token=$1
  local out_json=$2

  echo "  warming up ${WARMUP}s..."
  npx --yes autocannon@7.15.0 \
    -c "$CONNECTIONS" -d "$WARMUP" \
    -H "authorization: Bearer $token" \
    "$ENDPOINT" >/dev/null 2>&1

  echo "  measuring ${DURATION}s @ ${CONNECTIONS} connections..."
  npx --yes autocannon@7.15.0 \
    -c "$CONNECTIONS" -d "$DURATION" \
    -H "authorization: Bearer $token" \
    --json \
    "$ENDPOINT" > "$out_json" 2>/dev/null
}

# ── start clean ───────────────────────────────────────────────────────────

echo "Tearing down any prior stack..."
compose_down docker-compose.yml docker-compose.postgres.yml "$BENCH_OVERLAY"
compose_down docker-compose.yml "$BENCH_OVERLAY"

# ── memory backend ────────────────────────────────────────────────────────

echo
echo "════════════════════════════════════════════════════════════════════"
echo " MEMORY backend: bringing up..."
echo "════════════════════════════════════════════════════════════════════"
compose_up docker-compose.yml "$BENCH_OVERLAY"
wait_for_api
MEM_TOKEN=$(fetch_token)
[ -n "$MEM_TOKEN" ] || { echo "ERROR: failed to get token (memory)" >&2; exit 1; }
echo "  endpoint: $ENDPOINT"
run_bench "$MEM_TOKEN" "$MEM_JSON"
compose_down docker-compose.yml "$BENCH_OVERLAY"

# ── postgres backend ──────────────────────────────────────────────────────

echo
echo "════════════════════════════════════════════════════════════════════"
echo " POSTGRES backend: bringing up..."
echo "════════════════════════════════════════════════════════════════════"
compose_up docker-compose.yml docker-compose.postgres.yml "$BENCH_OVERLAY"
wait_for_api
# Postgres bootstrap (seed 10k rows) can take a couple seconds after /health
# first responds; give the seed a moment to settle before benching.
sleep 3
PG_TOKEN=$(fetch_token)
[ -n "$PG_TOKEN" ] || { echo "ERROR: failed to get token (postgres)" >&2; exit 1; }
echo "  endpoint: $ENDPOINT"
run_bench "$PG_TOKEN" "$PG_JSON"
compose_down docker-compose.yml docker-compose.postgres.yml "$BENCH_OVERLAY"

# ── summary ───────────────────────────────────────────────────────────────

echo
echo "════════════════════════════════════════════════════════════════════"
echo " SUMMARY  (${DURATION}s @ ${CONNECTIONS} conns)"
echo " endpoint: ${ENDPOINT}"
echo "════════════════════════════════════════════════════════════════════"

node - "$MEM_JSON" "$PG_JSON" <<'NODE'
const fs = require('fs');
const [, , memPath, pgPath] = process.argv;
const mem = JSON.parse(fs.readFileSync(memPath, 'utf8'));
const pg = JSON.parse(fs.readFileSync(pgPath, 'utf8'));

const fmtInt = (n) => n.toLocaleString('en-US');
const fmtFloat = (n, d = 2) => n.toFixed(d);
const mb = (bytes) => (bytes / 1_000_000).toFixed(2);

const rows = [
  ['Metric',         'Memory',                     'Postgres',                   'Ratio'],
  ['Total requests', fmtInt(mem.requests.total),   fmtInt(pg.requests.total),    fmtFloat(mem.requests.total / pg.requests.total) + 'x'],
  ['Avg req/sec',    fmtInt(Math.round(mem.requests.average)), fmtInt(Math.round(pg.requests.average)), fmtFloat(mem.requests.average / pg.requests.average) + 'x'],
  ['Avg latency',    fmtFloat(mem.latency.average) + ' ms', fmtFloat(pg.latency.average) + ' ms', fmtFloat(pg.latency.average / mem.latency.average) + 'x slower'],
  ['p50 latency',    mem.latency.p50 + ' ms',      pg.latency.p50 + ' ms',       'n/a'],
  ['p97.5 latency',  mem.latency.p97_5 + ' ms',    pg.latency.p97_5 + ' ms',     'n/a'],
  ['p99 latency',    mem.latency.p99 + ' ms',      pg.latency.p99 + ' ms',       'n/a'],
  ['Throughput',     mb(mem.throughput.average) + ' MB/s', mb(pg.throughput.average) + ' MB/s', fmtFloat(mem.throughput.average / pg.throughput.average) + 'x'],
];

const widths = rows[0].map((_, col) => Math.max(...rows.map((r) => String(r[col]).length)));
const fmtRow = (r) => '  ' + r.map((cell, i) => String(cell).padEnd(widths[i])).join('  ');

console.log();
console.log(fmtRow(rows[0]));
console.log('  ' + widths.map((w) => '─'.repeat(w)).join('  '));
for (let i = 1; i < rows.length; i++) console.log(fmtRow(rows[i]));
console.log();
NODE

echo "(both stacks have been torn down with -v)"
