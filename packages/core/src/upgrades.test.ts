import { describe, expect, it } from "vitest";
import { NO_UPGRADES, UPGRADE_IDS, bulkCost, maxAffordable, multipliers, upgradeCost } from "./upgrades.js";

describe("upgradeCost", () => {
  it("suit C0 * g^n", () => {
    expect(upgradeCost("absorption", 0)).toBe(50);
    expect(upgradeCost("absorption", 1)).toBeCloseTo(57.5);
    expect(upgradeCost("absorption", 10)).toBeCloseTo(50 * 1.15 ** 10);
  });
  it("refuse un niveau invalide", () => {
    expect(() => upgradeCost("hyphae", -1)).toThrow(RangeError);
    expect(() => upgradeCost("hyphae", 1.5)).toThrow(RangeError);
  });
});

describe("bulkCost", () => {
  it("égale la somme des coûts unitaires", () => {
    for (const id of UPGRADE_IDS) {
      for (const level of [0, 3, 17]) {
        let sum = 0;
        for (let i = 0; i < 12; i++) sum += upgradeCost(id, level + i);
        expect(Math.abs(bulkCost(id, level, 12) - sum) / sum < 1e-9).toBe(true);
      }
    }
  });
  it("vaut 0 pour 0 niveau", () => {
    expect(bulkCost("osmosis", 5, 0)).toBe(0);
  });
});

describe("maxAffordable", () => {
  it("renvoie le plus grand nombre de niveaux payables", () => {
    for (const id of UPGRADE_IDS) {
      for (const budget of [0, 49, 50, 107.5, 1_000, 123_456]) {
        for (const level of [0, 4]) {
          const n = maxAffordable(id, level, budget);
          expect(bulkCost(id, level, n) <= budget).toBe(true);
          expect(bulkCost(id, level, n + 1) > budget).toBe(true);
        }
      }
    }
  });
  it("tombe juste à la frontière", () => {
    expect(maxAffordable("absorption", 0, 50)).toBe(1);
    expect(maxAffordable("absorption", 0, 49.99)).toBe(0);
    expect(maxAffordable("absorption", 0, bulkCost("absorption", 0, 7))).toBe(7);
  });
});

describe("multipliers", () => {
  it("sans amélioration, tout vaut 1", () => {
    expect(multipliers(NO_UPGRADES)).toEqual({ production: 1, growthSpeed: 1, biomass: 1 });
  });
  it("applique les effets par niveau", () => {
    const m = multipliers({ absorption: 2, hyphae: 1, osmosis: 3 });
    expect(m.production).toBeCloseTo(1.3);
    expect(m.growthSpeed).toBeCloseTo(1 / 0.92);
    expect(m.biomass).toBeCloseTo(1.6);
  });
});
