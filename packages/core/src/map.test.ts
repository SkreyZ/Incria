import { describe, expect, it } from "vitest";
import { distance, hexKey, neighbors, parseHexKey, ring } from "./hex.js";
import {
  BASE_RADIUS,
  MIN_SPAWN_DISTANCE,
  baseZone,
  countTiles,
  generateMap,
  isPassable,
  mapFingerprint,
  mapRadiusFor,
  type GameMap,
} from "./map.js";

const SEEDS = Array.from({ length: 40 }, (_, i) => `test-${i}`);

function passableComponents(map: GameMap): number {
  const seen = new Set<string>();
  let components = 0;
  for (const [key, type] of map.tiles) {
    if (!isPassable(type) || seen.has(key)) continue;
    components++;
    const stack = [parseHexKey(key)];
    seen.add(key);
    while (stack.length) {
      for (const n of neighbors(stack.pop()!)) {
        const k = hexKey(n);
        if (!seen.has(k) && isPassable(map.tiles.get(k))) {
          seen.add(k);
          stack.push(n);
        }
      }
    }
  }
  return components;
}

describe("mapRadiusFor", () => {
  it("donne ~1 500 hex pour 30 joueurs", () => {
    expect(mapRadiusFor(30)).toBe(22); // 1 519 hex
  });
});

describe("generateMap", () => {
  it("est déterministe", () => {
    const a = generateMap({ seed: "semaine-40", players: 30 });
    const b = generateMap({ seed: "semaine-40", players: 30 });
    expect(mapFingerprint(a)).toBe(mapFingerprint(b));
  });

  it("change avec la graine", () => {
    expect(mapFingerprint(generateMap({ seed: "a", players: 30 }))).not.toBe(
      mapFingerprint(generateMap({ seed: "b", players: 30 })),
    );
  });

  it("refuse un nombre de joueurs invalide", () => {
    expect(() => generateMap({ seed: "x", players: 0 })).toThrow(RangeError);
    expect(() => generateMap({ seed: "x", players: 2.5 })).toThrow(RangeError);
    expect(() => generateMap({ seed: "x", players: 61 })).toThrow(RangeError);
  });

  it.each([1, 2, 10, 30, 60])("place %i spores, chacune sur la carte", (players) => {
    const map = generateMap({ seed: "spawns", players });
    expect(map.spawns.length).toBe(players);
    for (const s of map.spawns) expect(distance(s, { q: 0, r: 0 }) <= map.radius - BASE_RADIUS).toBe(true);
  });

  for (const seed of SEEDS) {
    it(`carte équitable et praticable (${seed})`, () => {
      const map = generateMap({ seed, players: 30 });

      // zones de base disjointes
      for (let i = 0; i < map.spawns.length; i++) {
        for (let j = i + 1; j < map.spawns.length; j++) {
          expect(distance(map.spawns[i]!, map.spawns[j]!) >= MIN_SPAWN_DISTANCE).toBe(true);
        }
      }

      // zone de base identique pour tous : 17 humus, 1 bois mort, 1 mousse, 0 rocher
      for (const s of map.spawns) {
        const zone = baseZone(s).map((h) => map.tiles.get(hexKey(h)));
        expect(zone.length).toBe(19);
        expect(zone.filter((t) => t === "humus").length).toBe(17);
        expect(zone.filter((t) => t === "deadwood").length).toBe(1);
        expect(zone.filter((t) => t === "moss").length).toBe(1);
        expect(map.tiles.get(hexKey(ring(s, BASE_RADIUS)[0]!))).toBe("deadwood");
      }

      // toutes les tuiles praticables sont reliées
      expect(passableComponents(map)).toBe(1);

      // proportions de terrain raisonnables
      const c = countTiles(map);
      const n = map.tiles.size;
      expect(c.humus / n > 0.6).toBe(true);
      expect(c.rock / n > 0.02 && c.rock / n < 0.15).toBe(true);
      expect(c.deadwood / n > 0.03 && c.deadwood / n < 0.15).toBe(true);
      expect(c.moss / n > 0.04 && c.moss / n < 0.16).toBe(true);
    });
  }

  it("le bois mort est plus dense au centre qu'au bord", () => {
    let center = 0;
    let edge = 0;
    for (const seed of SEEDS) {
      const map = generateMap({ seed, players: 30 });
      const baseKeys = new Set(map.spawns.flatMap((s) => baseZone(s).map(hexKey)));
      for (const [key, type] of map.tiles) {
        if (type !== "deadwood" || baseKeys.has(key)) continue;
        const d = distance(parseHexKey(key), { q: 0, r: 0 });
        if (d <= map.radius / 2) center++;
        else edge++;
      }
    }
    // la moitié intérieure ne représente qu'~1/4 de la surface
    expect(center / (center + edge) > 0.3).toBe(true);
  });
});

describe("non-régression", () => {
  // ⚠️ Si ce test casse, la génération de carte a changé : les cartes de toutes les
  // ligues en cours seraient différentes côté client et serveur. Ne mettre à jour
  // l'empreinte que pour un changement VOULU, en le signalant dans la PR.
  it("empreinte fixe pour la graine de référence", () => {
    expect(mapFingerprint(generateMap({ seed: "golden", players: 30 }))).toBe("22-98f75518-7819ade1");
  });
});
