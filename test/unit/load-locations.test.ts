import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadLocationsFromFile } from '../../src/repository/load-locations.js';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

describe('loadLocationsFromFile', () => {
  it('loads a valid file', () => {
    const r = loadLocationsFromFile(fixture('locations.sample.json'), { abortInvalidFraction: 0.5 });
    expect(r.total).toBe(5);
    expect(r.skipped).toBe(0);
    expect(r.loaded).toHaveLength(5);
    expect(r.loaded.find((l) => l.id === '51e1545c-8b65-4d83-82f9-7fcad4a23111')).toMatchObject({
      coordinates: { x: 8, y: 8 }, radius: 8,
    });
  });

  it('skips individual invalid records (warnings) when below the abort threshold', () => {
    const warnings: unknown[] = [];
    const r = loadLocationsFromFile(fixture('locations.broken.json'), {
      abortInvalidFraction: 0.5,
      onWarn: (msg, detail) => warnings.push({ msg, detail }),
    });
    expect(r.total).toBe(4);
    expect(r.skipped).toBe(2);
    expect(r.loaded.map((l) => l.name).sort()).toEqual(['Good A', 'Good C']);
    expect(warnings).toHaveLength(2);
  });

  it('aborts when more than the threshold fraction of records are invalid', () => {
    expect(() => loadLocationsFromFile(fixture('locations.mostly-broken.json'), { abortInvalidFraction: 0.5 })).toThrow(
      /more than 50% .* invalid/i,
    );
  });

  it('throws on a missing file', () => {
    expect(() => loadLocationsFromFile(fixture('does-not-exist.json'), { abortInvalidFraction: 0.5 })).toThrow();
  });

  it('throws on invalid JSON', () => {
    expect(() => loadLocationsFromFile(fixture('not-json.txt'), { abortInvalidFraction: 0.5 })).toThrow(/valid JSON/i);
  });

  it('throws on the wrong top-level shape', () => {
    expect(() => loadLocationsFromFile(fixture('wrong-shape.json'), { abortInvalidFraction: 0.5 })).toThrow(/locations.*array/i);
  });
});
