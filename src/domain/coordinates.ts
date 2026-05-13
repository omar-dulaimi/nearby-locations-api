export interface Coordinates {
  x: number;
  y: number;
}

export class InvalidCoordinatesError extends Error {
  constructor(value: string, reason: string) {
    super(
      `Invalid coordinates string: ${JSON.stringify(value)} — ${reason} ` +
        `(expected "x=<int>,y=<int>" with each value between 0 and ${Number.MAX_SAFE_INTEGER})`,
    );
    this.name = 'InvalidCoordinatesError';
  }
}

const COORDS_RE = /^x=(\d+),y=(\d+)$/;

export function parseCoordinates(value: string): Coordinates {
  const m = COORDS_RE.exec(value);
  // The regex (\d+) already rejects negatives, decimals, signs, and whitespace.
  if (!m) throw new InvalidCoordinatesError(value, 'wrong format');
  const x = Number(m[1]);
  const y = Number(m[2]);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
    throw new InvalidCoordinatesError(value, 'value out of safe integer range');
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
