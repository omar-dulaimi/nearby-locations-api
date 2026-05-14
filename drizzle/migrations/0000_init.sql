CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS "locations" (
  "id"            uuid    PRIMARY KEY,
  "name"          text    NOT NULL,
  "type"          text    NOT NULL,
  "opening_hours" text    NOT NULL,
  "image"         text    NOT NULL,
  "x"             integer NOT NULL CHECK ("x" >= 0),
  "y"             integer NOT NULL CHECK ("y" >= 0),
  "radius"        integer NOT NULL CHECK ("radius" >= 1),
  "geom"          geometry(Point) GENERATED ALWAYS AS (ST_MakePoint("x", "y")) STORED
);

CREATE INDEX IF NOT EXISTS "locations_geom_gix" ON "locations" USING GIST ("geom");
