import { describe, expect, it } from "vitest";
import { createRng, hashString } from "./rng.js";

describe("createRng", () => {
  it("est reproductible pour une même graine", () => {
    const a = createRng("semaine-40");
    const b = createRng("semaine-40");
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("diffère pour deux graines différentes", () => {
    const a = createRng("a");
    const b = createRng("b");
    const same = Array.from({ length: 20 }, () => a.next() === b.next()).filter(Boolean).length;
    expect(same < 20).toBe(true);
  });

  it("next() reste dans [0, 1)", () => {
    const r = createRng(42);
    for (let i = 0; i < 10_000; i++) {
      const x = r.next();
      expect(x >= 0 && x < 1).toBe(true);
    }
  });

  it("int() respecte les bornes et les atteint", () => {
    const r = createRng("int");
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i++) {
      const x = r.int(-2, 3);
      expect(x >= -2 && x <= 3 && Number.isInteger(x)).toBe(true);
      seen.add(x);
    }
    expect(seen.size).toBe(6);
  });

  it("int() refuse des bornes invalides", () => {
    expect(() => createRng(1).int(5, 1)).toThrow(RangeError);
  });

  it("distribution grossièrement uniforme", () => {
    const r = createRng("uniforme");
    const buckets = new Array<number>(10).fill(0);
    const n = 50_000;
    for (let i = 0; i < n; i++) buckets[Math.floor(r.next() * 10)]!++;
    for (const b of buckets) expect(Math.abs(b - n / 10) < n / 100).toBe(true);
  });

  it("shuffle() conserve les éléments et ne modifie pas l'entrée", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = createRng("s").shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((x, y) => x - y)).toEqual(input);
  });

  it("pick() refuse un tableau vide", () => {
    expect(() => createRng(1).pick([])).toThrow(RangeError);
  });

  it("fork() est déterministe et indépendant du parent", () => {
    const a = createRng("p").fork("terrain");
    const b = createRng("p").fork("terrain");
    expect(a.next()).toBe(b.next());
    expect(createRng("p").fork("spawns").next() === createRng("p").fork("terrain").next()).toBe(false);
  });
});

describe("hashString", () => {
  it("renvoie un entier 32 bits non signé stable", () => {
    expect(hashString("")).toBe(0x811c9dc5);
    expect(hashString("mycelium")).toBe(hashString("mycelium"));
    expect(hashString("mycelium") >>> 0).toBe(hashString("mycelium"));
  });
});
