import { baseZone, generateMap, hex, hexKey } from "@game/core";
import { describe, expect, it } from "vitest";
import { cullTiles, filament, layoutTiles, networkFilaments } from "./layout.js";

describe("layout", () => {
  const map = generateMap({ seed: "render", players: 30 });

  it("place toutes les tuiles de la carte (~1 500 hex pour 30 joueurs)", () => {
    const tiles = layoutTiles(map, 10);
    expect(tiles.length).toBe(map.tiles.size);
    expect(tiles.length).toBeGreaterThanOrEqual(1500);
    expect(tiles.find((t) => t.key === "0,0")).toMatchObject({ x: 0, y: 0 });
  });

  it("cullTiles ne garde que les tuiles dans le rectangle", () => {
    const tiles = layoutTiles(map, 10);
    const b = { minX: -50, maxX: 50, minY: -40, maxY: 40 };
    const kept = cullTiles(tiles, b);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(tiles.length);
    for (const t of kept) expect(t.x >= b.minX && t.x <= b.maxX && t.y >= b.minY && t.y <= b.maxY).toBe(true);
    expect(kept.length).toBe(tiles.filter((t) => Math.abs(t.x) <= 50 && Math.abs(t.y) <= 40).length);
  });

  it("networkFilaments relie chaque paire de voisins possédés une seule fois", () => {
    // zone de base : 19 tuiles, somme des degrés 6 + 6·6 + 6·3 + 6·4 = 84, donc 42 arêtes
    const owned = new Set(baseZone(hex(0, 0)).map(hexKey));
    expect(networkFilaments(owned).length).toBe(42);
    expect(networkFilaments(new Set(["0,0"])).length).toBe(0);
    expect(networkFilaments(new Set(["0,0", "1,0"])).length).toBe(1);
  });

  it("filament : courbe déterministe, extrémités fixes, contrôle hors de la ligne droite en général", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    const f = filament(a, b, "x");
    expect(f).toEqual(filament(a, b, "x"));
    expect(f.from).toBe(a);
    expect(f.to).toBe(b);
    expect(f.ctrl.x).toBe(5);
    expect(Math.abs(f.ctrl.y)).toBeLessThanOrEqual(2.5);
  });
});
