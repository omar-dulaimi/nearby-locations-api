import { readFileSync } from 'node:fs';
import { Value } from '@sinclair/typebox/value';
import { RawLocationSchema, rawToLocation } from '../schemas/raw-location.js';
import type { Location } from '../domain/location.js';

export interface LoadOptions {
  abortInvalidFraction: number; // abort if invalidCount/total > this
  onWarn?: (message: string, detail?: unknown) => void;
}

export interface LoadResult {
  loaded: Location[];
  total: number;
  skipped: number;
}

export function loadLocationsFromFile(path: string, opts: LoadOptions): LoadResult {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read locations file at ${path}: ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Locations file at ${path} is not valid JSON`);
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as { locations?: unknown }).locations)
  ) {
    throw new Error(`Locations file at ${path} must be an object with a "locations" array`);
  }

  const rows = (parsed as { locations: unknown[] }).locations;
  const loaded: Location[] = [];
  let skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Value.Check(RawLocationSchema, row)) {
      skipped++;
      opts.onWarn?.(
        `Skipping invalid location at index ${i}`,
        [...Value.Errors(RawLocationSchema, row)].slice(0, 3),
      );
      continue;
    }
    try {
      loaded.push(rawToLocation(row));
    } catch (err) {
      skipped++;
      opts.onWarn?.(`Skipping unconvertible location at index ${i}`, (err as Error).message);
    }
  }

  if (rows.length > 0 && skipped / rows.length > opts.abortInvalidFraction) {
    throw new Error(
      `Refusing to start: more than ${Math.round(opts.abortInvalidFraction * 100)}% of records in ${path} are invalid (${skipped}/${rows.length})`,
    );
  }

  return { loaded, total: rows.length, skipped };
}
