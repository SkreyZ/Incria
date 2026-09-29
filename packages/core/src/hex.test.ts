import { describe, expect, it } from "vitest";
import {
  DIRECTIONS,
  ORIGIN,
  distance,
  hex,
  hexKey,
  hexRound,
  hexToPixel,
  neighbors,
  parseHexKey,
  pixelToHex,
  ring,
  spiral,
  spiralSize,
} from "./hex.js";

describe("hexKey / parseHexKey", () => {
  it("fait l'aller-retour", () => {
    for (const h of [hex(0, 0), hex(3, -7), hex(-12, 5)]) {
      expect(parseHexKey(hexKey(h))).toEqual(h);
    }
  });
  it("ne produit jamais de -0", () => {
    expect(hexKey(hex(-0, -0))).toBe("0,0");
    expect(Object.is(hex(-0, 1).q, 0)).toBe(true);
  });
  it("refuse une clé invalide", () => {
    expect(() => parseHexKey("a,b")).toThrow(SyntaxError);
  });
});

describe("voisins et distance", () => {
  it("a 6 voisins distincts, tous à distance 1", () => {
    const n = neighbors(hex(2, -1));
    expect(new Set(n.map(hexKey)).size).toBe(6);
    for (const h of n) expect(distance(h, hex(2, -1))).toBe(1);
  });
  it("calcule la distance axiale", () => {
    expect(distance(ORIGIN, hex(3, -1))).toBe(3);
    expect(distance(hex(-2, 4), hex(1, -3))).toBe(7);
    expect(distance(hex(5, 5), hex(5, 5))).toBe(0);
  });
  it("est symétrique", () => {
    expect(distance(hex(1, 2), hex(-4, 0))).toBe(distance(hex(-4, 0), hex(1, 2)));
  });
  it("les directions sont opposées deux à deux", () => {
    for (let i = 0; i < 3; i++) {
      const a = DIRECTIONS[i]!;
      const b = DIRECTIONS[i + 3]!;
      expect(a.q + b.q).toBe(0);
      expect(a.r + b.r).toBe(0);
    }
  });
});

describe("ring / spiral", () => {
  it("ring(0) est le centre", () => {
    expect(ring(hex(1, 1), 0)).toEqual([hex(1, 1)]);
  });
  it("ring(n) contient 6n hex distincts, tous à distance n", () => {
    for (const n of [1, 2, 5]) {
      const r = ring(ORIGIN, n);
      expect(r.length).toBe(6 * n);
      expect(new Set(r.map(hexKey)).size).toBe(6 * n);
      for (const h of r) expect(distance(h, ORIGIN)).toBe(n);
    }
  });
  it("une spirale de rayon 2 = zone de base de 19 tuiles", () => {
    expect(spiral(ORIGIN, 2).length).toBe(19);
    expect(spiralSize(2)).toBe(19);
  });
  it("spiral(n) contient exactement les hex à distance <= n", () => {
    const s = spiral(hex(4, -2), 4);
    expect(s.length).toBe(spiralSize(4));
    expect(new Set(s.map(hexKey)).size).toBe(s.length);
    for (const h of s) expect(distance(h, hex(4, -2)) <= 4).toBe(true);
  });
  it("refuse un rayon invalide", () => {
    expect(() => ring(ORIGIN, -1)).toThrow(RangeError);
    expect(() => spiral(ORIGIN, 1.5)).toThrow(RangeError);
  });
});

describe("conversions pixel", () => {
  it("pixelToHex(hexToPixel(h)) === h", () => {
    for (const h of spiral(ORIGIN, 6)) {
      expect(pixelToHex(hexToPixel(h, 24), 24)).toEqual(h);
    }
  });
  it("un point proche du centre reste dans l'hexagone", () => {
    const c = hexToPixel(hex(3, -2), 10);
    expect(pixelToHex({ x: c.x + 4, y: c.y - 4 }, 10)).toEqual(hex(3, -2));
  });
  it("hexRound arrondit vers l'hex le plus proche", () => {
    expect(hexRound(0.2, 0.1)).toEqual(hex(0, 0));
    expect(hexRound(0.9, -0.1)).toEqual(hex(1, 0));
  });
});
