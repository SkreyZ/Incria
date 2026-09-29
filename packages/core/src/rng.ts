/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 * Même graine => même suite de nombres, côté client comme côté serveur.
 * Tout l'aléatoire de packages/core doit passer par ici (jamais Math.random).
 */

export interface Rng {
  /** Flottant dans [0, 1). */
  next(): number;
  /** Entier dans [min, max] (bornes incluses). */
  int(min: number, max: number): number;
  /** Vrai avec une probabilité p. */
  chance(p: number): boolean;
  /** Élément au hasard d'un tableau non vide. */
  pick<T>(items: readonly T[]): T;
  /** Copie mélangée (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[];
  /** Générateur indépendant dérivé (ex. un par sous-système). */
  fork(label: string): Rng;
}

/** Hash 32 bits (FNV-1a) d'une chaîne. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createRng(seed: string | number): Rng {
  const seedStr = String(seed);
  let state = hashString(seedStr);

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`Bornes invalides : [${min}, ${max}]`);
    }
    return min + Math.floor(next() * (max - min + 1));
  };

  return {
    next,
    int,
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new RangeError("pick() sur un tableau vide");
      return items[int(0, items.length - 1)]!;
    },
    shuffle: (items) => {
      const a = items.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = int(0, i);
        [a[i], a[j]] = [a[j]!, a[i]!];
      }
      return a;
    },
    fork: (label) => createRng(`${seedStr}/${label}`),
  };
}
