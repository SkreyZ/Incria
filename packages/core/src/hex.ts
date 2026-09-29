/**
 * Grille hexagonale "pointe en haut", coordonnées axiales (q, r).
 * Référence : https://www.redblobgames.com/grids/hexagons/
 */

export interface Hex {
  readonly q: number;
  readonly r: number;
}

/** Évite les -0 (qui cassent les comparaisons et les clés). */
const z = (n: number): number => (n === 0 ? 0 : n);

export function hex(q: number, r: number): Hex {
  return { q: z(q), r: z(r) };
}

export const ORIGIN: Hex = hex(0, 0);

/** Les 6 directions, dans le sens anti-horaire en partant de l'est. */
export const DIRECTIONS: readonly Hex[] = [
  hex(1, 0),
  hex(1, -1),
  hex(0, -1),
  hex(-1, 0),
  hex(-1, 1),
  hex(0, 1),
];

/** Clé texte stable, utilisable dans une Map ou en base. */
export function hexKey(h: Hex): string {
  return `${z(h.q)},${z(h.r)}`;
}

export function parseHexKey(key: string): Hex {
  const m = /^(-?\d+),(-?\d+)$/.exec(key);
  if (!m) throw new SyntaxError(`Clé hex invalide : "${key}"`);
  return hex(Number(m[1]), Number(m[2]));
}

export function hexEquals(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

export function hexAdd(a: Hex, b: Hex): Hex {
  return hex(a.q + b.q, a.r + b.r);
}

export function hexScale(a: Hex, k: number): Hex {
  return hex(a.q * k, a.r * k);
}

export function neighbors(h: Hex): Hex[] {
  return DIRECTIONS.map((d) => hexAdd(h, d));
}

export function distance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** Hexagones exactement à `radius` de `center` (6 × radius, ou le centre si radius = 0). */
export function ring(center: Hex, radius: number): Hex[] {
  assertRadius(radius);
  if (radius === 0) return [center];
  const out: Hex[] = [];
  // départ : direction 4 (sud-ouest) × radius, puis on fait le tour
  let cur = hexAdd(center, hexScale(DIRECTIONS[4]!, radius));
  for (const dir of DIRECTIONS) {
    for (let i = 0; i < radius; i++) {
      out.push(cur);
      cur = hexAdd(cur, dir);
    }
  }
  return out;
}

/** Tous les hexagones à distance <= radius, du centre vers l'extérieur (1 + 3r(r+1) hex). */
export function spiral(center: Hex, radius: number): Hex[] {
  assertRadius(radius);
  const out: Hex[] = [];
  for (let k = 0; k <= radius; k++) out.push(...ring(center, k));
  return out;
}

/** Nombre d'hexagones dans une spirale de rayon r. */
export function spiralSize(radius: number): number {
  assertRadius(radius);
  return 1 + 3 * radius * (radius + 1);
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Centre de l'hexagone en pixels (size = rayon du cercle circonscrit). */
export function hexToPixel(h: Hex, size: number): Point {
  return {
    x: size * Math.sqrt(3) * (h.q + h.r / 2),
    y: size * 1.5 * h.r,
  };
}

/** Hexagone contenant le point (x, y). */
export function pixelToHex(p: Point, size: number): Hex {
  const q = ((Math.sqrt(3) / 3) * p.x - (1 / 3) * p.y) / size;
  const r = ((2 / 3) * p.y) / size;
  return hexRound(q, r);
}

/** Arrondit des coordonnées axiales fractionnaires vers l'hexagone le plus proche. */
export function hexRound(fq: number, fr: number): Hex {
  const fs = -fq - fr;
  let q = Math.round(fq);
  let r = Math.round(fr);
  const s = Math.round(fs);
  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return hex(q, r);
}

function assertRadius(radius: number): void {
  if (!Number.isInteger(radius) || radius < 0) {
    throw new RangeError("Le rayon doit être un entier >= 0");
  }
}
