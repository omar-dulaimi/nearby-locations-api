import { describe, it, expect } from 'vitest';
import { LinearScanIndex } from '../../src/spatial/linear-scan-index.js';
import type { Location } from '../../src/domain/location.js';

function loc(id: string, x: number, y: number, radius: number): Location {
  return { id, name: id, type: 'Restaurant', openingHours: '10:00AM-11:00PM', image: 'https://x', coordinates: { x, y }, radius };
}

const worked: Location[] = [
  loc('#1', 1, 1, 1),
  loc('#2', 2, 2, 2),
  loc('#3', 5, 5, 1),
  loc('#4', 2, 3, 5),
];

describe('LinearScanIndex', () => {
  it('returns locations whose disk contains the point (worked example)', () => {
    const idx = new LinearScanIndex();
    idx.bulkLoad(worked);
    const ids = idx.search({ x: 3, y: 2 }).map((h) => h.location.id).sort();
    expect(ids).toEqual(['#2', '#4']);
  });
  it('includes the boundary case distance == radius', () => {
    const idx = new LinearScanIndex();
    idx.bulkLoad([loc('a', 0, 0, 5)]);
    expect(idx.search({ x: 3, y: 4 }).map((h) => h.location.id)).toEqual(['a']);
  });
  it('returns exact distances', () => {
    const idx = new LinearScanIndex();
    idx.bulkLoad([loc('a', 2, 2, 2)]);
    expect(idx.search({ x: 3, y: 2 })[0]!.distance).toBe(1);
  });
  it('supports upsert, remove and size', () => {
    const idx = new LinearScanIndex();
    idx.bulkLoad([loc('a', 0, 0, 1)]);
    expect(idx.size()).toBe(1);
    idx.upsert(loc('a', 10, 10, 1));
    expect(idx.search({ x: 0, y: 0 })).toEqual([]);
    idx.upsert(loc('b', 0, 0, 2));
    expect(idx.search({ x: 0, y: 0 }).map((h) => h.location.id)).toEqual(['b']);
    expect(idx.size()).toBe(2);
    idx.remove('b');
    expect(idx.size()).toBe(1);
    idx.remove('nope');
    expect(idx.size()).toBe(1);
  });
});
