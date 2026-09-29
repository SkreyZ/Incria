import { describe, expect, it } from "vitest";
import { addVisible, VISION_RADIUS, visibleFrom } from "./fog.js";
import { distance, hex, hexKey, parseHexKey, spiralSize } from "./hex.js";

const everywhere = (): boolean => true;

describe("visibleFrom", () => {
  it("voit un disque de rayon VISION_RADIUS autour d'une tuile", () => {
    const v = visibleFrom([hexKey(hex(0, 0))], everywhere);
    expect(v.size).toBe(spiralSize(VISION_RADIUS));
    for (const k of v) expect(distance(parseHexKey(k), hex(0, 0)) <= VISION_RADIUS).toBe(true);
  });

  it("fait l'union des disques sans doublon", () => {
    const v = visibleFrom([hexKey(hex(0, 0)), hexKey(hex(1, 0))], everywhere, 1);
    expect(v.size).toBe(10); // deux disques de 7 qui partagent 4 hex
  });

  it("ignore les hex hors carte", () => {
    const inMap = (k: string): boolean => distance(parseHexKey(k), hex(0, 0)) <= 1;
    const v = visibleFrom([hexKey(hex(1, 0))], inMap, 2);
    for (const k of v) expect(inMap(k)).toBe(true);
    expect(v.size).toBe(7);
  });

  it("ne voit rien sans tuile possédée", () => {
    expect(visibleFrom([], everywhere).size).toBe(0);
  });
});

describe("addVisible", () => {
  it("complète un ensemble existant", () => {
    const s = new Set<string>(["99,99"]);
    addVisible(s, hex(0, 0), everywhere, 1);
    expect(s.size).toBe(8);
    expect(s.has("99,99")).toBe(true);
  });
});
