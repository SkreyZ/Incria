/**
 * Géométrie pure de la carte : centres des tuiles, culling, filaments du réseau.
 */
import { DIRECTIONS, type GameMap, hashString, hexAdd, hexKey, hexToPixel, parseHexKey, type Point, type TileType } from "@game/core";

/** Rayon d'un hex en unités monde (zoom 1 = 1 px). */
export const HEX_SIZE = 24;

export interface TileLayout {
  readonly key: string;
  readonly type: TileType;
  readonly x: number;
  readonly y: number;
}

/** Centres pixel de toutes les tuiles, calculés une fois par carte. */
export function layoutTiles(map: GameMap, size = HEX_SIZE): TileLayout[] {
  return [...map.tiles].map(([key, type]) => ({ key, type, ...hexToPixel(parseHexKey(key), size) }));
}

export interface Bounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** Tuiles dont le centre tombe dans `b` (élargir `b` de HEX_SIZE pour ne pas couper les bords). */
export function cullTiles<T extends Point>(tiles: readonly T[], b: Bounds): T[] {
  // ponytail: scan linéaire, suffisant pour ~1 500 hex ; grille spatiale si la carte grossit beaucoup.
  return tiles.filter((t) => t.x >= b.minX && t.x <= b.maxX && t.y >= b.minY && t.y <= b.maxY);
}

/** Sommet i (0..5) d'un hex pointe en haut, relatif à son centre. */
export const HEX_CORNERS: readonly Point[] = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i - 30);
  return { x: Math.cos(a), y: Math.sin(a) };
});

/** Filament courbe entre deux centres : quadratique, courbure déterministe par arête. */
export interface Filament {
  readonly from: Point;
  readonly ctrl: Point;
  readonly to: Point;
}

/** Arêtes entre tuiles possédées voisines, chacune une seule fois (3 directions sur 6). */
export function networkFilaments(owned: ReadonlySet<string> | ReadonlyMap<string, unknown>, size = HEX_SIZE): Filament[] {
  const out: Filament[] = [];
  for (const key of owned.keys()) {
    const h = parseHexKey(key);
    for (const d of DIRECTIONS.slice(0, 3)) {
      const nk = hexKey(hexAdd(h, d));
      if (owned.has(nk)) out.push(filament(hexToPixel(h, size), hexToPixel(parseHexKey(nk), size), `${key}|${nk}`));
    }
  }
  return out;
}

export function filament(from: Point, to: Point, seed: string): Filament {
  // décalage perpendiculaire de ±25 % de la longueur, stable pour une même arête
  const bend = ((hashString(seed) % 1000) / 1000 - 0.5) * 0.5;
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  return { from, to, ctrl: { x: mx - (to.y - from.y) * bend, y: my + (to.x - from.x) * bend } };
}
