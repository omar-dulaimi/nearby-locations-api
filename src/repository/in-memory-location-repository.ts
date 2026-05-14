import type { Location } from '../domain/location.js';
import type { LocationRepository } from './location-repository.js';

export class InMemoryLocationRepository implements LocationRepository {
  private readonly byId = new Map<string, Location>();

  constructor(initial: Location[] = []) {
    for (const l of initial) this.byId.set(l.id, l);
  }

  async getById(id: string): Promise<Location | undefined> {
    return this.byId.get(id);
  }

  async upsert(location: Location): Promise<void> {
    this.byId.set(location.id, location);
  }

  async all(): Promise<Location[]> {
    return [...this.byId.values()];
  }

  async count(): Promise<number> {
    return this.byId.size;
  }
}
