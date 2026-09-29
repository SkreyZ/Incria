/**
 * Génération de la forêt d'une ligue à partir d'une graine.
 * Déterministe : même graine + même nombre de joueurs => même carte, octet pour octet.
 */
import { type Hex, ORIGIN, distance, hexKey, hexToPixel, neighbors, ring, spiral, spiralSize } from "./hex.js";
import { createRng, hashString, type Rng } from "./rng.js";

export type TileType = "humus" | "deadwood" | "moss" | "rock";

export const TILE_TYPES: readonly TileType[] = ["humus", "deadwood", "moss", "rock"];

/** Hex par joueur visés (spec : ~1 500 hex pour 30 joueurs). */
export const TILES_PER_PLAYER = 50;
/** Rayon de la zone de base inattaquable (spore + 2 anneaux = 19 tuiles). */
export const BASE_RADIUS = 2;
/** Distance minimale entre deux spores pour que les zones de base ne se touchent pas. */
export const MIN_SPAWN_DISTANCE = 2 * BASE_RADIUS + 1;

export const MAX_PLAYERS = 60;

export interface GameMap {
  readonly seed: string;
  readonly players: number;
  /** Rayon de la carte (hexagone centré sur l'origine). */
  readonly radius: number;
  /** Type de chaque tuile, indexé par hexKey. */
  readonly tiles: ReadonlyMap<string, TileType>;
  /** Point de départ (spore) de chaque joueur, triés par angle. */
  readonly spawns: readonly Hex[];
}

export interface MapOptions {
  seed: string;
  players: number;
}

/** Plus petit rayon qui offre au moins TILES_PER_PLAYER hex par joueur. */
export function mapRadiusFor(players: number): number {
  let r = 1;
  while (spiralSize(r) < players * TILES_PER_PLAYER) r++;
  return r;
}

export function isPassable(type: TileType | undefined): boolean {
  return type !== undefined && type !== "rock";
}

export function generateMap({ seed, players }: MapOptions): GameMap {
  if (!Number.isInteger(players) || players < 1 || players > MAX_PLAYERS) {
    throw new RangeError(`players doit être un entier entre 1 et ${MAX_PLAYERS}`);
  }
  const radius = mapRadiusFor(players);
  const rng = createRng(`map:${seed}:${players}`);
  const all = spiral(ORIGIN, radius);
  const inMap = (h: Hex): boolean => distance(h, ORIGIN) <= radius;

  const tiles = new Map<string, TileType>();
  for (const h of all) tiles.set(hexKey(h), "humus");

  // 1. Terrain : plaques de mousse, bois mort (plutôt au centre), puis amas de rochers.
  const size = all.length;
  paintPatches(rng.fork("moss"), tiles, all, inMap, {
    type: "moss",
    count: Math.round((size * 0.12) / 6),
    maxRadius: 2,
    centerBias: 0,
    radius,
  });
  paintPatches(rng.fork("deadwood"), tiles, all, inMap, {
    type: "deadwood",
    count: Math.round((size * 0.1) / 3),
    maxRadius: 1,
    centerBias: 0.7,
    radius,
  });
  paintPatches(rng.fork("rock"), tiles, all, inMap, {
    type: "rock",
    count: Math.round((size * 0.08) / 3),
    maxRadius: 1,
    centerBias: 0,
    radius,
  });
  // 2. Connexité : on garde la plus grande zone praticable, les poches isolées deviennent des rochers.
  let main = new Set<string>();
  const visited = new Set<string>();
  for (const h of all) {
    const k = hexKey(h);
    if (visited.has(k) || !isPassable(tiles.get(k))) continue;
    const component = floodFill(tiles, h);
    for (const c of component) visited.add(c);
    if (component.size > main.size) main = component;
  }
  for (const [key, type] of tiles) {
    if (isPassable(type) && !main.has(key)) tiles.set(key, "rock");
  }

  // 3. Points de départ, puis zones de base identiques pour tous.
  const spawns = placeSpawns(rng.fork("spawns"), tiles, all, radius, players);
  for (const s of spawns) stampBase(tiles, s);

  return { seed, players, radius, tiles, spawns };
}

interface PatchOptions {
  type: TileType;
  count: number;
  maxRadius: number;
  /** 0 = uniforme, 1 = fortement concentré au centre. */
  centerBias: number;
  radius: number;
}

function paintPatches(
  rng: Rng,
  tiles: Map<string, TileType>,
  all: readonly Hex[],
  inMap: (h: Hex) => boolean,
  o: PatchOptions,
): void {
  for (let i = 0; i < o.count; i++) {
    let center = rng.pick(all);
    // biais vers le centre par rejet : plus on est loin, plus on retire
    for (let tries = 0; tries < 8 && !rng.chance(1 - o.centerBias * (distance(center, ORIGIN) / o.radius)); tries++) {
      center = rng.pick(all);
    }
    const r = rng.int(0, o.maxRadius);
    for (const h of spiral(center, r)) {
      if (inMap(h) && rng.chance(0.75)) tiles.set(hexKey(h), o.type);
    }
  }
}

function floodFill(tiles: ReadonlyMap<string, TileType>, start: Hex): Set<string> {
  const seen = new Set<string>();
  if (!isPassable(tiles.get(hexKey(start)))) return seen;
  const queue: Hex[] = [start];
  seen.add(hexKey(start));
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const n of neighbors(cur)) {
      const k = hexKey(n);
      if (!seen.has(k) && isPassable(tiles.get(k))) {
        seen.add(k);
        queue.push(n);
      }
    }
  }
  return seen;
}

function placeSpawns(
  rng: Rng,
  tiles: ReadonlyMap<string, TileType>,
  all: readonly Hex[],
  radius: number,
  players: number,
): Hex[] {
  // Anneau de départ : ni au centre (réservé aux ressources), ni collé au bord.
  const minRing = players === 1 ? 0 : Math.ceil(radius * 0.3);
  const maxRing = radius - BASE_RADIUS;
  const candidates = rng.shuffle(
    all.filter((h) => {
      const d = distance(h, ORIGIN);
      return d >= minRing && d <= maxRing && isPassable(tiles.get(hexKey(h)));
    }),
  );
  if (candidates.length === 0) throw new Error("Aucun emplacement de départ possible");

  // Échantillonnage du point le plus éloigné : chaque nouvelle spore est posée
  // le plus loin possible des spores déjà placées (égalités : ordre du mélange).
  const picked: Hex[] = [candidates[0]!];
  const nearest = candidates.map((c) => distance(c, picked[0]!));
  while (picked.length < players) {
    let best = -1;
    for (let i = 0; i < candidates.length; i++) {
      if (best < 0 || nearest[i]! > nearest[best]!) best = i;
    }
    if (nearest[best]! < MIN_SPAWN_DISTANCE) {
      throw new Error(`Impossible de placer ${players} spores sur une carte de rayon ${radius}`);
    }
    const chosen = candidates[best]!;
    picked.push(chosen);
    for (let i = 0; i < candidates.length; i++) {
      nearest[i] = Math.min(nearest[i]!, distance(candidates[i]!, chosen));
    }
  }
  return sortByAngle(picked);
}

function sortByAngle(hexes: Hex[]): Hex[] {
  const angle = (h: Hex): number => {
    const p = hexToPixel(h, 1);
    return Math.atan2(p.y, p.x);
  };
  return hexes.sort((a, b) => angle(a) - angle(b) || a.q - b.q || a.r - b.r);
}

/** Zone de base : humus partout, 1 bois mort et 1 mousse à des positions fixes. */
function stampBase(tiles: Map<string, TileType>, spawn: Hex): void {
  for (const h of spiral(spawn, BASE_RADIUS)) tiles.set(hexKey(h), "humus");
  const outer = ring(spawn, BASE_RADIUS);
  tiles.set(hexKey(outer[0]!), "deadwood");
  tiles.set(hexKey(outer[6]!), "moss");
}

/** Hex de la zone de base d'une spore. */
export function baseZone(spawn: Hex): Hex[] {
  return spiral(spawn, BASE_RADIUS);
}

/** Nombre de tuiles de chaque type. */
export function countTiles(map: GameMap): Record<TileType, number> {
  const counts: Record<TileType, number> = { humus: 0, deadwood: 0, moss: 0, rock: 0 };
  for (const t of map.tiles.values()) counts[t]++;
  return counts;
}

/** Empreinte stable d'une carte (tests de non-régression, vérif client/serveur). */
export function mapFingerprint(map: GameMap): string {
  const tiles = [...map.tiles.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, t]) => `${k}=${t[0]}`)
    .join(";");
  const spawns = map.spawns.map(hexKey).join(";");
  return `${map.radius}-${hashString(tiles).toString(16)}-${hashString(spawns).toString(16)}`;
}
