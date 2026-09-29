import { describe, expect, it } from "vitest";
import { BASE_GROW_SECONDS, chooseNext, frontier, growSeconds, tileCost, TILE_BASE_COST } from "./growth.js";
import { hex, hexKey, spiral } from "./hex.js";
import type { TileType } from "./map.js";

/** Petite carte de test : disque de rayon 3 en humus, avec quelques tuiles spéciales. */
function testTiles(special: Record<string, TileType> = {}): Map<string, TileType> {
  const tiles = new Map<string, TileType>();
  for (const h of spiral(hex(0, 0), 3)) tiles.set(hexKey(h), "humus");
  for (const [k, t] of Object.entries(special)) tiles.set(k, t);
  return tiles;
}
const ownedAt = (...keys: string[]): Map<string, true> => new Map(keys.map((k) => [k, true]));

describe("tileCost", () => {
  it("suit B0 × (1 + 0,08 k)^1,5 et augmente avec k", () => {
    expect(tileCost(0)).toBe(TILE_BASE_COST);
    expect(tileCost(19)).toBeCloseTo(TILE_BASE_COST * 2.52 ** 1.5);
    expect(tileCost(100) > tileCost(50)).toBe(true);
  });
  it("refuse un nombre invalide", () => {
    expect(() => tileCost(-1)).toThrow(RangeError);
  });
});

describe("growSeconds", () => {
  it("sans eau ni amélioration = durée de base", () => {
    expect(growSeconds(0, 1)).toBe(BASE_GROW_SECONDS);
  });
  it("plus d'eau et d'amélioration = plus rapide, avec rendement décroissant", () => {
    expect(growSeconds(1, 1) < growSeconds(0, 1)).toBe(true);
    expect(growSeconds(1, 2)).toBeCloseTo(growSeconds(1, 1) / 2);
    const gain1 = growSeconds(0, 1) - growSeconds(10, 1);
    const gain2 = growSeconds(10, 1) - growSeconds(20, 1);
    expect(gain2 < gain1).toBe(true);
  });
});

describe("frontier", () => {
  it("liste les voisins libres et praticables, triés", () => {
    const tiles = testTiles({ "1,0": "rock" });
    const f = frontier({ tiles, owned: ownedAt("0,0") });
    expect(f.length).toBe(5); // 6 voisins moins le rocher
    expect(f.includes("1,0")).toBe(false);
    expect([...f].sort()).toEqual(f);
  });
  it("exclut les tuiles occupées par d'autres et hors carte", () => {
    const tiles = testTiles();
    const f = frontier({ tiles, owned: ownedAt("3,0"), occupied: new Set(["2,0"]) });
    expect(f.includes("2,0")).toBe(false);
    for (const k of f) expect(tiles.has(k)).toBe(true);
  });
});

describe("chooseNext", () => {
  it("en idle, préfère la tuile la plus rentable (eau comptée double)", () => {
    const tiles = testTiles({ "0,1": "deadwood", "-1,0": "moss" });
    expect(chooseNext({ tiles, owned: ownedAt("0,0") }, hex(0, 0), null)).toBe("-1,0");
  });
  it("avec une cible, se rapproche de la cible", () => {
    const tiles = testTiles({ "0,1": "moss" });
    expect(chooseNext({ tiles, owned: ownedAt("0,0") }, hex(0, 0), "3,0")).toBe("1,0");
  });
  it("renvoie null quand tout est bloqué", () => {
    const special: Record<string, TileType> = {};
    for (const h of spiral(hex(0, 0), 1)) if (hexKey(h) !== "0,0") special[hexKey(h)] = "rock";
    expect(chooseNext({ tiles: testTiles(special), owned: ownedAt("0,0") }, hex(0, 0), null)).toBe(null);
  });
  it("est déterministe en cas d'égalité", () => {
    const tiles = testTiles();
    const a = chooseNext({ tiles, owned: ownedAt("0,0") }, hex(0, 0), null);
    const b = chooseNext({ tiles, owned: ownedAt("0,0") }, hex(0, 0), null);
    expect(a).toBe(b);
  });
});
