import { describe, expect, it } from "vitest";
import {
  addResources,
  BIOMASS_FACTOR,
  DEADWOOD_LIFETIME,
  EMPTY_RESOURCES,
  effectiveType,
  nextDepletion,
  productionRates,
  TILE_YIELD,
} from "./economy.js";
import { multipliers, NO_UPGRADES } from "./upgrades.js";

const m1 = multipliers(NO_UPGRADES);

describe("productionRates", () => {
  it("additionne les rendements des tuiles", () => {
    const r = productionRates(
      [
        { type: "humus", since: 0 },
        { type: "moss", since: 0 },
      ],
      0,
      m1,
    );
    expect(r.nutrients).toBeCloseTo(TILE_YIELD.humus.nutrients + TILE_YIELD.moss.nutrients);
    expect(r.water).toBeCloseTo(TILE_YIELD.humus.water + TILE_YIELD.moss.water);
    expect(r.biomass).toBeCloseTo(BIOMASS_FACTOR * Math.sqrt(r.nutrients * r.water));
  });

  it("sans eau, pas de biomasse", () => {
    const r = productionRates([{ type: "deadwood", since: 0 }], 0, m1);
    expect(r.nutrients > 0).toBe(true);
    expect(r.biomass).toBe(0);
  });

  it("applique les multiplicateurs d'amélioration", () => {
    const tiles = [
      { type: "humus" as const, since: 0 },
      { type: "moss" as const, since: 0 },
    ];
    const base = productionRates(tiles, 0, m1);
    const up = productionRates(tiles, 0, multipliers({ absorption: 2, hyphae: 0, osmosis: 1 }));
    expect(up.nutrients).toBeCloseTo(base.nutrients * 1.3);
    expect(up.biomass).toBeCloseTo(base.biomass * 1.3 * 1.2);
  });

  it("un rocher ne rapporte rien", () => {
    expect(productionRates([{ type: "rock", since: 0 }], 0, m1)).toEqual({ nutrients: 0, water: 0, biomass: 0 });
  });
});

describe("épuisement du bois mort", () => {
  const dw = { type: "deadwood" as const, since: 1000 };
  it("rend à plein pendant DEADWOOD_LIFETIME, puis comme de l'humus", () => {
    expect(effectiveType(dw, 1000 + DEADWOOD_LIFETIME - 1)).toBe("deadwood");
    expect(effectiveType(dw, 1000 + DEADWOOD_LIFETIME)).toBe("humus");
  });
  it("nextDepletion donne le prochain épuisement futur", () => {
    const tiles = [dw, { type: "deadwood" as const, since: 5000 }, { type: "humus" as const, since: 0 }];
    expect(nextDepletion(tiles, 0)).toBe(1000 + DEADWOOD_LIFETIME);
    expect(nextDepletion(tiles, 1000 + DEADWOOD_LIFETIME)).toBe(5000 + DEADWOOD_LIFETIME);
    expect(nextDepletion(tiles, 10 * DEADWOOD_LIFETIME)).toBe(Infinity);
  });
});

describe("addResources", () => {
  it("intègre linéairement", () => {
    expect(addResources(EMPTY_RESOURCES, { nutrients: 1, water: 2, biomass: 0.5 }, 10)).toEqual({
      nutrients: 10,
      water: 20,
      biomass: 5,
    });
  });
});
