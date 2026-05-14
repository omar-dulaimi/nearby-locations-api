-- Functional GiST index on each row's reach bbox.
--
-- The plain GiST index on `geom` (in 0000_init.sql) cannot accelerate
-- `ST_DWithin(geom, $point, radius)` when the distance comes from a per-row
-- column: the planner has no way to pre-shrink the candidate set by `radius`.
-- Indexing `ST_Expand(geom, radius)` precomputes each row's reach bbox; the
-- search then uses the GiST-indexable `&&` operator for the bbox prefilter
-- and keeps `ST_DWithin` only as the exact recheck.
CREATE INDEX IF NOT EXISTS "locations_reach_gix"
  ON "locations" USING GIST (ST_Expand(geom, radius));
