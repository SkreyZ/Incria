/**
 * Améliorations de la semaine, achetées avec les nutriments.
 * Remises à zéro au reset du lundi (contrairement aux mutations).
 * Valeurs provisoires : à équilibrer au prototype.
 */

export type UpgradeId = "absorption" | "hyphae" | "osmosis";

export interface UpgradeDef {
  readonly id: UpgradeId;
  readonly name: string;
  readonly description: string;
  /** Coût du niveau 0 → 1, en nutriments. */
  readonly baseCost: number;
  /** Facteur de croissance du coût par niveau. */
  readonly growth: number;
}

export const UPGRADES: Readonly<Record<UpgradeId, UpgradeDef>> = {
  absorption: {
    id: "absorption",
    name: "Absorption",
    description: "+15 % de nutriments et d'eau par niveau",
    baseCost: 50,
    growth: 1.15,
  },
  hyphae: {
    id: "hyphae",
    name: "Hyphes rapides",
    description: "Les filaments poussent 8 % plus vite par niveau (effet multiplicatif)",
    baseCost: 80,
    growth: 1.18,
  },
  osmosis: {
    id: "osmosis",
    name: "Osmose",
    description: "+20 % de biomasse produite par niveau",
    baseCost: 120,
    growth: 1.2,
  },
};

export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];

export type UpgradeLevels = Readonly<Record<UpgradeId, number>>;

export const NO_UPGRADES: UpgradeLevels = { absorption: 0, hyphae: 0, osmosis: 0 };

function assertLevel(n: number, what: string): void {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`${what} doit être un entier >= 0`);
}

/** Coût pour passer du niveau `level` à `level + 1`. */
export function upgradeCost(id: UpgradeId, level: number): number {
  assertLevel(level, "level");
  const u = UPGRADES[id];
  return u.baseCost * u.growth ** level;
}

/** Coût de `count` niveaux achetés d'un coup à partir de `level` (formule fermée, série géométrique). */
export function bulkCost(id: UpgradeId, level: number, count: number): number {
  assertLevel(level, "level");
  assertLevel(count, "count");
  const u = UPGRADES[id];
  return (u.baseCost * u.growth ** level * (u.growth ** count - 1)) / (u.growth - 1);
}

/** Nombre maximal de niveaux achetables avec `budget` nutriments. */
export function maxAffordable(id: UpgradeId, level: number, budget: number): number {
  assertLevel(level, "level");
  if (!(budget > 0)) return 0;
  const u = UPGRADES[id];
  const first = u.baseCost * u.growth ** level;
  let n = Math.floor(Math.log((budget * (u.growth - 1)) / first + 1) / Math.log(u.growth));
  // corrige les erreurs d'arrondi flottant aux frontières
  while (n > 0 && bulkCost(id, level, n) > budget) n--;
  while (bulkCost(id, level, n + 1) <= budget) n++;
  return n;
}

/** Multiplicateurs appliqués par l'économie et la croissance. */
export interface Multipliers {
  /** Nutriments et eau. */
  readonly production: number;
  /** Divise le temps de pousse d'une tuile. */
  readonly growthSpeed: number;
  /** Biomasse. */
  readonly biomass: number;
}

export function multipliers(levels: UpgradeLevels): Multipliers {
  return {
    production: 1 + 0.15 * levels.absorption,
    growthSpeed: 1 / 0.92 ** levels.hyphae,
    biomass: 1 + 0.2 * levels.osmosis,
  };
}
