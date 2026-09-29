import { hexKey, parseHexKey, stateFingerprint, upgradeCost } from "@game/core";
import { describe, expect, it } from "vitest";
import { createGame, seasonSeed } from "./game.js";
import { deserialize, SAVE_KEY, serialize } from "./save.js";

const T0 = Date.UTC(2026, 8, 29, 12); // mardi
const HOUR = 3600_000;

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

const throwingStorage = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("QuotaExceededError");
  },
} as unknown as Storage;

describe("save", () => {
  it("serialize/deserialize conserve l'état à l'identique", () => {
    const g = createGame(T0, memoryStorage());
    g.tick(T0 + 5 * HOUR);
    const back = deserialize(serialize(g.state, g.seed), g.seed);
    expect(back).not.toBeNull();
    expect(stateFingerprint(back!)).toBe(stateFingerprint(g.state));
    expect(back!.owned).toEqual(g.state.owned);
    expect(back!.discovered).toEqual(g.state.discovered);
  });

  it("rejette une sauvegarde corrompue ou d'une autre saison", () => {
    const g = createGame(T0, memoryStorage());
    expect(deserialize("{pas du json", g.seed)).toBeNull();
    expect(deserialize("null", g.seed)).toBeNull();
    expect(deserialize(serialize(g.state, g.seed), "autre")).toBeNull();
  });
});

describe("createGame", () => {
  it("tick fait tourner la simulation : ressources puis croissance", () => {
    const g = createGame(T0, memoryStorage());
    const start = g.state.owned.size;
    g.tick(T0 + 60_000);
    expect(g.state.resources.nutrients).toBeGreaterThan(0);
    expect(g.state.resources.biomass + (g.state.growing?.cost ?? 0)).toBeGreaterThan(0);
    g.tick(T0 + 6 * HOUR);
    expect(g.state.owned.size).toBeGreaterThan(start);
    g.tick(T0); // pas de retour dans le temps
    expect(g.state.time).toBe((T0 + 6 * HOUR) / 1000);
  });

  it("reprend la sauvegarde et rattrape le temps hors ligne", () => {
    const storage = memoryStorage();
    const a = createGame(T0, storage);
    a.tick(T0 + HOUR);
    a.save();
    const b = createGame(T0 + 2 * HOUR, storage);
    a.tick(T0 + 2 * HOUR);
    expect(stateFingerprint(b.state)).toBe(stateFingerprint(a.state));
  });

  it("repart de zéro à la saison suivante", () => {
    const storage = memoryStorage();
    const a = createGame(T0, storage);
    a.tick(T0 + HOUR);
    a.save();
    const nextWeek = T0 + 7 * 24 * HOUR;
    expect(seasonSeed(nextWeek)).not.toBe(a.seed);
    const b = createGame(nextWeek, storage);
    expect(b.state.time).toBe(nextWeek / 1000);
    expect(b.state.resources.nutrients).toBe(0);
  });

  it("démarre sans localStorage utilisable", () => {
    const g = createGame(T0, throwingStorage);
    g.tick(T0 + HOUR);
    expect(() => g.save()).not.toThrow();
    expect(g.state.resources.nutrients).toBeGreaterThan(0);
  });

  it("buy débite les nutriments et refuse sans le budget", () => {
    const g = createGame(T0, memoryStorage());
    expect(g.buy("absorption").ok).toBe(false);
    g.tick(T0 + 2 * HOUR);
    const before = g.state.resources.nutrients;
    expect(before).toBeGreaterThan(upgradeCost("absorption", 0));
    expect(g.buy("absorption").ok).toBe(true);
    expect(g.state.upgrades.absorption).toBe(1);
    expect(g.state.resources.nutrients).toBeCloseTo(before - upgradeCost("absorption", 0));
  });

  it("setGrowthTarget valide via @game/core et accepte null (idle)", () => {
    const storage = memoryStorage();
    const g = createGame(T0, storage);
    const free = [...g.state.discovered].find((k) => !g.state.owned.has(k) && g.map.tiles.get(k) !== "rock")!;
    expect(g.setGrowthTarget(parseHexKey(free)).ok).toBe(true);
    expect(g.state.target).toBe(free);
    expect(g.setGrowthTarget(g.state.spawn).ok).toBe(false); // déjà colonisée
    expect(g.setGrowthTarget(null).ok).toBe(true);
    expect(g.state.target).toBeNull();
    g.save();
    expect(storage.getItem(SAVE_KEY)).toContain(hexKey(g.state.spawn));
  });
});
