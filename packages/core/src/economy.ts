/**
 * Économie : ce que rapportent les tuiles possédées.
 * Tous les débits sont constants entre deux « événements » (tuile gagnée, bois mort épuisé),
 * ce qui permet une intégration exacte, indépendante du découpage du temps.
 * Valeurs provisoires : à équilibrer au prototype.
 */
import type { TileType } from "./map.js";
import type { Multipliers } from "./upgrades.js";

export interface Resources {
  readonly nutrients: number;
  readonly water: number;
  readonly biomass: number;
}

export const EMPTY_RESOURCES: Resources = { nutrients: 0, water: 0, biomass: 0 };

/** Rendement par seconde de chaque type de tuile. */
export const TILE_YIELD: Readonly<Record<TileType, { nutrients: number; water: number }>> = {
  humus: { nutrients: 0.1, water: 0.02 },
  deadwood: { nutrients: 0.5, water: 0 },
  moss: { nutrients: 0.02, water: 0.25 },
  rock: { nutrients: 0, water: 0 },
};

/** Durée pendant laquelle un bois mort rapporte à plein (spec : ~2 jours), ensuite il rend comme de l'humus. */
export const DEADWOOD_LIFETIME = 48 * 3600;

/** Biomasse/s = BIOMASS_FACTOR × √(nutriments/s × eau/s) : il faut les deux. */
export const BIOMASS_FACTOR = 0.5;

export interface OwnedTile {
  readonly type: TileType;
  /** Instant (secondes) où la tuile a été colonisée. */
  readonly since: number;
}

export interface Rates {
  readonly nutrients: number;
  readonly water: number;
  readonly biomass: number;
}

/** Type effectif d'une tuile à l'instant t (le bois mort épuisé rend comme de l'humus). */
export function effectiveType(tile: OwnedTile, t: number): TileType {
  return tile.type === "deadwood" && t - tile.since >= DEADWOOD_LIFETIME ? "humus" : tile.type;
}

/** Débits de production à l'instant t. */
export function productionRates(owned: Iterable<OwnedTile>, t: number, m: Multipliers): Rates {
  let n = 0;
  let w = 0;
  for (const tile of owned) {
    const y = TILE_YIELD[effectiveType(tile, t)];
    n += y.nutrients;
    w += y.water;
  }
  n *= m.production;
  w *= m.production;
  return { nutrients: n, water: w, biomass: BIOMASS_FACTOR * Math.sqrt(n * w) * m.biomass };
}

/** Prochain instant > t où un débit change à cause de l'épuisement d'un bois mort (Infinity si aucun). */
export function nextDepletion(owned: Iterable<OwnedTile>, t: number): number {
  let next = Infinity;
  for (const tile of owned) {
    if (tile.type !== "deadwood") continue;
    const end = tile.since + DEADWOOD_LIFETIME;
    if (end > t && end < next) next = end;
  }
  return next;
}

export function addResources(r: Resources, rates: Rates, seconds: number): Resources {
  return {
    nutrients: r.nutrients + rates.nutrients * seconds,
    water: r.water + rates.water * seconds,
    biomass: r.biomass + rates.biomass * seconds,
  };
}
