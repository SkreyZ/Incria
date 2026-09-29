import { describe, expect, it } from "vitest";
import { DEADWOOD_LIFETIME, productionRates } from "./economy.js";
import { hexKey, neighbors, parseHexKey } from "./hex.js";
import { generateMap } from "./map.js";
import {
  advance,
  buyUpgrade,
  catchUp,
  createPlayer,
  MAX_OFFLINE_SECONDS,
  type PlayerState,
  setTarget,
  stateFingerprint,
} from "./player.js";
import { multipliers, upgradeCost } from "./upgrades.js";

const map = generateMap({ seed: "golden", players: 30 });
const HOUR = 3600;
const start = (): PlayerState => createPlayer(map, 0, 0);
const close = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

function isConnected(s: PlayerState): boolean {
  const keys = [...s.owned.keys()];
  const seen = new Set([keys[0]!]);
  const stack = [keys[0]!];
  while (stack.length) {
    for (const n of neighbors(parseHexKey(stack.pop()!))) {
      const k = hexKey(n);
      if (s.owned.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push(k);
      }
    }
  }
  return seen.size === s.owned.size;
}

describe("createPlayer", () => {
  it("démarre avec la zone de base (19 tuiles) et rien en stock", () => {
    const s = start();
    expect(s.owned.size).toBe(19);
    expect(s.resources).toEqual({ nutrients: 0, water: 0, biomass: 0 });
    expect(s.discovered.size > 19).toBe(true);
  });
  it("refuse une spore inexistante", () => {
    expect(() => createPlayer(map, 30, 0)).toThrow(RangeError);
  });
});

describe("advance", () => {
  it("ne modifie pas l'état d'origine", () => {
    const s = start();
    const fp = stateFingerprint(s);
    advance(s, map, 2 * HOUR);
    expect(stateFingerprint(s)).toBe(fp);
  });

  it("refuse de remonter le temps", () => {
    expect(() => advance(start(), map, -1)).toThrow(RangeError);
  });

  it("produit et fait grandir le réseau, qui reste d'un seul tenant", () => {
    const s = advance(start(), map, 6 * HOUR);
    expect(s.owned.size > 19).toBe(true);
    expect(s.resources.nutrients > 0).toBe(true);
    expect(isConnected(s)).toBe(true);
    for (const [k, tile] of s.owned) expect(map.tiles.get(k)).toBe(tile.type);
  });

  it("donne le même résultat quel que soit le découpage du temps", () => {
    const once = advance(start(), map, 3 * HOUR);
    let steps = start();
    for (let t = 60; t <= 3 * HOUR; t += 60) steps = advance(steps, map, t);
    let irregular = start();
    for (const t of [1, 7, 500, 501, 4000, 9999, 3 * HOUR]) irregular = advance(irregular, map, t);
    for (const other of [steps, irregular]) {
      expect([...other.owned.keys()].sort()).toEqual([...once.owned.keys()].sort());
      expect(close(other.resources.nutrients, once.resources.nutrients)).toBe(true);
      expect(close(other.resources.water, once.resources.water)).toBe(true);
      expect(close(other.resources.biomass, once.resources.biomass)).toBe(true);
    }
  });

  it("ne prend jamais une tuile occupée par un autre joueur", () => {
    const blocked = new Set<string>();
    for (const k of start().owned.keys()) {
      for (const n of neighbors(parseHexKey(k))) blocked.add(hexKey(n));
    }
    for (const k of start().owned.keys()) blocked.delete(k);
    const s = advance(start(), map, 12 * HOUR, { occupied: blocked });
    expect(s.owned.size).toBe(19);
  });

  it("le bois mort de la zone de base s'épuise après 48 h", () => {
    const m = multipliers(start().upgrades);
    const before = productionRates(start().owned.values(), DEADWOOD_LIFETIME - 1, m);
    const after = productionRates(start().owned.values(), DEADWOOD_LIFETIME, m);
    expect(after.nutrients < before.nutrients).toBe(true);
  });
});

describe("setTarget", () => {
  it("dirige la croissance vers la cible", () => {
    const s0 = start();
    const target = [...s0.discovered].find((k) => !s0.owned.has(k) && map.tiles.get(k) !== "rock")!;
    const r = setTarget(s0, map, target);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = advance(r.state, map, 6 * HOUR);
    expect(s.owned.has(target)).toBe(true);
    expect(s.target).toBe(null); // cible atteinte => retour en idle
  });

  it("refuse une tuile invalide", () => {
    const s = start();
    const owned = [...s.owned.keys()][0]!;
    const fogged = [...map.tiles.keys()].find((k) => !s.discovered.has(k))!;
    expect(setTarget(s, map, owned).ok).toBe(false);
    expect(setTarget(s, map, fogged).ok).toBe(false);
    expect(setTarget(s, map, "999,999").ok).toBe(false);
    expect(setTarget(s, map, null).ok).toBe(true);
  });
});

describe("buyUpgrade", () => {
  it("dépense les nutriments et monte le niveau", () => {
    const s = advance(start(), map, HOUR);
    const r = buyUpgrade(s, "absorption");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.upgrades.absorption).toBe(1);
    expect(r.state.resources.nutrients).toBeCloseTo(s.resources.nutrients - upgradeCost("absorption", 0));
  });
  it("refuse sans assez de nutriments", () => {
    const r = buyUpgrade(start(), "osmosis");
    expect(r.ok).toBe(false);
  });
  it("une amélioration accélère la suite", () => {
    const s = advance(start(), map, 2 * HOUR);
    const r = buyUpgrade(s, "absorption", 3);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const withUp = advance(r.state, map, 8 * HOUR);
    const without = advance({ ...s, resources: r.state.resources }, map, 8 * HOUR);
    expect(withUp.resources.nutrients > without.resources.nutrients).toBe(true);
  });
});

describe("catchUp", () => {
  it("se comporte comme advance sous 24 h", () => {
    const s = start();
    expect(stateFingerprint(catchUp(s, map, 5 * HOUR))).toBe(stateFingerprint(advance(s, map, 5 * HOUR)));
  });
  it("ne simule pas plus de 24 h", () => {
    const s = start();
    const late = catchUp(s, map, 3 * 24 * HOUR);
    const capped = advance(s, map, MAX_OFFLINE_SECONDS);
    expect(late.time).toBe(3 * 24 * HOUR);
    expect(late.owned.size).toBe(capped.owned.size);
    expect(late.resources).toEqual(capped.resources);
  });
});

describe("non-régression", () => {
  // ⚠️ Si ce test casse, l'économie ou la croissance a changé. Ne mettre à jour
  // l'empreinte que pour un changement VOULU (équilibrage), en le signalant dans la PR.
  it("empreinte fixe après 24 h en idle sur la carte de référence", () => {
    expect(stateFingerprint(advance(start(), map, 24 * HOUR))).toBe("86400|1081568.015035|214568.761415|224289.018163|152|936affbc|294|-12,1@86868.690231");
  });
});
