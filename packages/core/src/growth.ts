/**
 * Croissance des filaments : coût et durée de colonisation d'une tuile, choix de la prochaine tuile.
 * Valeurs provisoires : à équilibrer au prototype.
 */
import { type Hex, distance, hexKey, neighbors, parseHexKey } from "./hex.js";
import { isPassable, type TileType } from "./map.js";
import { TILE_YIELD } from "./economy.js";

/** Coût de base d'une tuile, en biomasse. */
export const TILE_BASE_COST = 5;
/** Durée de pousse d'une tuile sans eau ni amélioration, en secondes. */
export const BASE_GROW_SECONDS = 20 * 60;
/** Poids de l'eau dans la vitesse de pousse : vitesse × (1 + facteur × log2(1 + eau/s)), rendement décroissant. */
export const WATER_SPEED_FACTOR = 0.5;

/** Coût en biomasse de la tuile suivante quand on en possède déjà `owned` : B0 × (1 + 0,08 k)^1,5. */
export function tileCost(owned: number): number {
  if (!Number.isInteger(owned) || owned < 0) throw new RangeError("owned doit être un entier >= 0");
  return TILE_BASE_COST * (1 + 0.08 * owned) ** 1.5;
}

/** Durée de pousse d'une tuile selon l'eau produite par seconde et le multiplicateur de vitesse. */
export function growSeconds(waterPerSecond: number, speedMultiplier: number): number {
  const water = Math.max(0, waterPerSecond);
  return BASE_GROW_SECONDS / ((1 + WATER_SPEED_FACTOR * Math.log2(1 + water)) * speedMultiplier);
}

export interface FrontierContext {
  readonly tiles: ReadonlyMap<string, TileType>;
  readonly owned: ReadonlyMap<string, unknown>;
  /** Tuiles prises par d'autres joueurs (multijoueur). */
  readonly occupied?: ReadonlySet<string>;
}

/** Tuiles colonisables : praticables, libres, adjacentes au réseau. Triées par clé (déterminisme). */
export function frontier(ctx: FrontierContext): string[] {
  const out = new Set<string>();
  for (const key of ctx.owned.keys()) {
    for (const n of neighbors(parseHexKey(key))) {
      const k = hexKey(n);
      if (!ctx.owned.has(k) && !ctx.occupied?.has(k) && isPassable(ctx.tiles.get(k))) out.add(k);
    }
  }
  return [...out].sort();
}

/** Intérêt d'une tuile en mode idle : l'eau compte double (plus rare). */
export function tileValue(type: TileType): number {
  const y = TILE_YIELD[type];
  return y.nutrients + 2 * y.water;
}

/**
 * Prochaine tuile à coloniser :
 * - avec une cible : la tuile de la frontière la plus proche de la cible ;
 * - sans cible (idle) : la plus rentable, puis la plus proche de la spore.
 * Égalités départagées par la clé, pour rester déterministe.
 */
export function chooseNext(
  ctx: FrontierContext,
  spawn: Hex,
  target: string | null,
): string | null {
  const candidates = frontier(ctx);
  if (candidates.length === 0) return null;
  const targetHex = target ? parseHexKey(target) : null;
  let best: string | null = null;
  let bestScore: [number, number] = [Infinity, Infinity];
  for (const k of candidates) {
    const h = parseHexKey(k);
    const score: [number, number] = targetHex
      ? [distance(h, targetHex), distance(h, spawn)]
      : [-tileValue(ctx.tiles.get(k)!), distance(h, spawn)];
    if (score[0] < bestScore[0] || (score[0] === bestScore[0] && score[1] < bestScore[1])) {
      best = k;
      bestScore = score;
    }
  }
  return best;
}
