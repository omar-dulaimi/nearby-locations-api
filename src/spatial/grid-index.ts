import type { Location } from '../domain/location.js';
import type { Coordinates } from '../domain/coordinates.js';
import { euclideanDistance } from '../domain/coordinates.js';
import type { IndexHit, LocationIndex } from './location-index.js';

interface Placed {
  location: Location;
  cellKey: string;
}

/**
 * Uniform-grid spatial index.
 *
 * Invariant: `cellSize === max(radius over all indexed locations)` (>= 1).
 * Each location is bucketed into the cell of its centre. Because no location's
 * disk can reach further than `cellSize` from its centre, every location whose
 * disk contains a query point Q has its centre in Q's cell or one of the 8
 * neighbouring cells — so `search` only scans that 3x3 block. No false negatives.
 *
 * A `upsert` whose radius exceeds `cellSize` would break the invariant, so it
 * triggers a full rebuild with the larger cell size (rare: radii are small per
 * the brief, and writes are rate-limited; a rebuild of N entries is O(N)).
 */
export class GridIndex implements LocationIndex {
  readonly needsBootstrap = true;
  private cellSize = 1;
  private cells = new Map<string, Location[]>();
  private placed = new Map<string, Placed>();

  bulkLoad(locations: Location[]): void {
    this.cellSize = Math.max(1, ...locations.map((l) => l.radius));
    this.cells = new Map();
    this.placed = new Map();
    for (const l of locations) this.add(l);
  }

  upsert(location: Location): void {
    if (location.radius > this.cellSize) {
      const all = [...this.placed.values()]
        .map((p) => p.location)
        .filter((l) => l.id !== location.id);
      all.push(location);
      this.bulkLoad(all);
      return;
    }
    this.remove(location.id);
    this.add(location);
  }

  remove(id: string): void {
    const prev = this.placed.get(id);
    if (!prev) return;
    this.placed.delete(id);
    const bucket = this.cells.get(prev.cellKey);
    if (!bucket) return;
    const i = bucket.findIndex((l) => l.id === id);
    if (i >= 0) bucket.splice(i, 1);
    if (bucket.length === 0) this.cells.delete(prev.cellKey);
  }

  search(point: Coordinates): IndexHit[] {
    const cx = Math.floor(point.x / this.cellSize);
    const cy = Math.floor(point.y / this.cellSize);
    const hits: IndexHit[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = this.cells.get(`${cx + dx}:${cy + dy}`);
        if (!bucket) continue;
        for (const location of bucket) {
          const distance = euclideanDistance(point, location.coordinates);
          if (distance <= location.radius) hits.push({ location, distance });
        }
      }
    }
    return hits;
  }

  size(): number {
    return this.placed.size;
  }

  private add(location: Location): void {
    const cellKey = `${Math.floor(location.coordinates.x / this.cellSize)}:${Math.floor(location.coordinates.y / this.cellSize)}`;
    let bucket = this.cells.get(cellKey);
    if (!bucket) {
      bucket = [];
      this.cells.set(cellKey, bucket);
    }
    bucket.push(location);
    this.placed.set(location.id, { location, cellKey });
  }
}
