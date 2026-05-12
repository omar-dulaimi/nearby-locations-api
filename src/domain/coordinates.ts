export interface Coordinates {
  x: number;
  y: number;
}

export class InvalidCoordinatesError extends Error {
  constructor(value: string) {
    super(
      `Invalid coordinates string: ${JSON.stringify(value)} (expected "x=<non-negative-int>,y=<non-negative-int>")`,
    );
    this.name = 'InvalidCoordinatesError';
  }
}

const COORDS_RE = /^x=(\d+),y=(\d+)$/;

export function parseCoordinates(value: string): Coordinates {
  const m = COORDS_RE.exec(value);
  if (!m) throw new InvalidCoordinatesError(value);
  const x = Number(m[1]);
  const y = Number(m[2]);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0) {
    throw new InvalidCoordinatesError(value);
  }
  return { x, y };
}

export function formatCoordinates(c: Coordinates): string {
  return `x=${c.x},y=${c.y}`;
}

export function euclideanDistance(a: Coordinates, b: Coordinates): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function roundDistance(d: number): number {
  return Math.round(d * 1e5) / 1e5;
}
