import type { Location } from '../domain/location.js';
import type { Coordinates } from '../domain/coordinates.js';
import { euclideanDistance } from '../domain/coordinates.js';
import type { IndexHit, LocationIndex } from './location-index.js';

export class LinearScanIndex implements LocationIndex {
  readonly needsBootstrap = true;
  private readonly byId = new Map<string, Location>();

  bulkLoad(locations: Location[]): void {
    this.byId.clear();
    for (const l of locations) this.byId.set(l.id, l);
  }

  upsert(location: Location): void {
    this.byId.set(location.id, location);
  }

  remove(id: string): void {
    this.byId.delete(id);
  }

  search(point: Coordinates): IndexHit[] {
    const hits: IndexHit[] = [];
    for (const location of this.byId.values()) {
      const distance = euclideanDistance(point, location.coordinates);
      if (distance <= location.radius) hits.push({ location, distance });
    }
    return hits;
  }

  size(): number {
    return this.byId.size;
  }
}
