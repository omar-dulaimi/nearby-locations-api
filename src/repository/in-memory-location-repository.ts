import type { Location } from '../domain/location.js';
import type { LocationRepository } from './location-repository.js';

export class InMemoryLocationRepository implements LocationRepository {
  private readonly byId = new Map<string, Location>();

  constructor(initial: Location[] = []) {
    for (const l of initial) this.byId.set(l.id, l);
  }

  getById(id: string): Location | undefined {
    return this.byId.get(id);
  }

  upsert(location: Location): void {
    this.byId.set(location.id, location);
  }

  all(): Location[] {
    return [...this.byId.values()];
  }

  count(): number {
    return this.byId.size;
  }
}
