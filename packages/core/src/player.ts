/**
 * État d'un joueur pendant une saison et simulation dans le temps.
 *
 * `advance()` est une simulation par événements, exacte :
 * les débits sont constants entre deux événements (tuile gagnée, pousse lancée, bois mort épuisé),
 * donc avancer d'1 h d'un coup ou 60 fois d'1 min donne le même résultat (à l'arrondi flottant près).
 * C'est ce qui permet au serveur de rattraper le temps hors ligne et au client de simuler en local.
 */
import { addResources, EMPTY_RESOURCES, nextDepletion, type OwnedTile, productionRates, type Resources } from "./economy.js";
import { addVisible, visibleFrom } from "./fog.js";
import { chooseNext, growSeconds, tileCost } from "./growth.js";
import { type Hex, hexKey, parseHexKey } from "./hex.js";
import { baseZone, type GameMap, isPassable } from "./map.js";
import { hashString } from "./rng.js";
import { bulkCost, multipliers, NO_UPGRADES, type UpgradeId, type UpgradeLevels } from "./upgrades.js";

/** Rattrapage hors ligne maximal : au-delà, le temps est perdu (spec : 24 h). */
export const MAX_OFFLINE_SECONDS = 24 * 3600;

export interface GrowingTile {
  readonly key: string;
  /** Biomasse payée (remboursée si la tuile est prise entre-temps). */
  readonly cost: number;
  readonly finishAt: number;
}

export interface PlayerState {
  readonly spawn: Hex;
  /** Instant de l'état, en secondes. */
  readonly time: number;
  readonly resources: Resources;
  readonly owned: ReadonlyMap<string, OwnedTile>;
  /** Terrain déjà découvert (brouillard levé). */
  readonly discovered: ReadonlySet<string>;
  readonly upgrades: UpgradeLevels;
  /** Direction de croissance choisie par le joueur (clé d'hex), ou null = idle. */
  readonly target: string | null;
  readonly growing: GrowingTile | null;
}

export type Result = { ok: true; state: PlayerState } | { ok: false; error: string };

export interface AdvanceOptions {
  /** Tuiles possédées par les autres joueurs (multijoueur). */
  readonly occupied?: ReadonlySet<string>;
}

const inMapOf = (map: GameMap) => (key: string): boolean => map.tiles.has(key);

/** Nouveau joueur : la zone de base (19 tuiles) autour de sa spore. */
export function createPlayer(map: GameMap, spawnIndex: number, time: number): PlayerState {
  const spawn = map.spawns[spawnIndex];
  if (!spawn) throw new RangeError(`Pas de spore n°${spawnIndex} sur cette carte`);
  const owned = new Map<string, OwnedTile>();
  for (const h of baseZone(spawn)) {
    const k = hexKey(h);
    owned.set(k, { type: map.tiles.get(k)!, since: time });
  }
  return {
    spawn,
    time,
    resources: EMPTY_RESOURCES,
    owned,
    discovered: visibleFrom(owned.keys(), inMapOf(map)),
    upgrades: NO_UPGRADES,
    target: null,
    growing: null,
  };
}

/** Fait avancer l'état jusqu'à `toTime` (production + croissance). Pure : ne modifie pas `state`. */
export function advance(state: PlayerState, map: GameMap, toTime: number, opts: AdvanceOptions = {}): PlayerState {
  if (toTime < state.time) throw new RangeError("advance() ne remonte pas le temps");
  const occupied = opts.occupied ?? new Set<string>();
  const m = multipliers(state.upgrades);
  const inMap = inMapOf(map);
  const owned = new Map(state.owned);
  const discovered = new Set(state.discovered);
  let { resources, target, growing } = state;
  let t = state.time;

  for (let guard = 0; t < toTime; guard++) {
    if (guard > 1_000_000) throw new Error("advance() : trop d'événements");
    const rates = productionRates(owned.values(), t, m);
    const horizon = Math.min(toTime, nextDepletion(owned.values(), t));

    // 1. Une tuile est en train de pousser.
    if (growing) {
      const finish = Math.max(growing.finishAt, t);
      if (finish > horizon) {
        resources = addResources(resources, rates, horizon - t);
        t = horizon;
        continue;
      }
      resources = addResources(resources, rates, finish - t);
      t = finish;
      if (occupied.has(growing.key)) {
        resources = { ...resources, biomass: resources.biomass + growing.cost };
      } else {
        owned.set(growing.key, { type: map.tiles.get(growing.key)!, since: t });
        addVisible(discovered, parseHexKey(growing.key), inMap);
      }
      if (target && owned.has(target)) target = null;
      growing = null;
      continue;
    }

    // 2. Choisir la prochaine tuile.
    if (target && occupied.has(target)) target = null;
    const next = chooseNext({ tiles: map.tiles, owned, occupied }, state.spawn, target);
    const cost = tileCost(owned.size);
    if (next === null || (resources.biomass < cost && rates.biomass <= 0)) {
      resources = addResources(resources, rates, horizon - t);
      t = horizon;
      continue;
    }

    // 3. Assez de biomasse : on lance la pousse.
    if (resources.biomass >= cost) {
      resources = { ...resources, biomass: resources.biomass - cost };
      growing = { key: next, cost, finishAt: t + growSeconds(rates.water, m.growthSpeed) };
      continue;
    }

    // 4. Sinon on attend d'avoir assez de biomasse (ou le prochain événement).
    const ready = t + (cost - resources.biomass) / rates.biomass;
    if (ready <= horizon) {
      resources = addResources(resources, rates, ready - t);
      resources = { ...resources, biomass: Math.max(resources.biomass, cost) }; // arrondi flottant
      t = ready;
    } else {
      resources = addResources(resources, rates, horizon - t);
      t = horizon;
    }
  }

  return { ...state, time: toTime, resources, owned, discovered, target, growing };
}

/**
 * Rattrapage à la reconnexion : au plus MAX_OFFLINE_SECONDS sont simulées,
 * le reste est perdu (la pousse en cours est décalée d'autant).
 */
export function catchUp(state: PlayerState, map: GameMap, now: number, opts: AdvanceOptions = {}): PlayerState {
  const elapsed = now - state.time;
  if (elapsed <= MAX_OFFLINE_SECONDS) return advance(state, map, now, opts);
  const s = advance(state, map, state.time + MAX_OFFLINE_SECONDS, opts);
  const skipped = now - s.time;
  return {
    ...s,
    time: now,
    growing: s.growing ? { ...s.growing, finishAt: s.growing.finishAt + skipped } : null,
  };
}

/** Choisit (ou efface avec null) la direction de croissance. */
export function setTarget(state: PlayerState, map: GameMap, key: string | null): Result {
  if (key === null) return { ok: true, state: { ...state, target: null } };
  if (!map.tiles.has(key)) return { ok: false, error: "Tuile hors de la carte" };
  if (!state.discovered.has(key)) return { ok: false, error: "Tuile encore dans le brouillard" };
  if (!isPassable(map.tiles.get(key))) return { ok: false, error: "Tuile infranchissable" };
  if (state.owned.has(key)) return { ok: false, error: "Tuile déjà colonisée" };
  return { ok: true, state: { ...state, target: key } };
}

/** Achète `count` niveaux d'une amélioration avec les nutriments. */
export function buyUpgrade(state: PlayerState, id: UpgradeId, count = 1): Result {
  if (!Number.isInteger(count) || count < 1) return { ok: false, error: "Quantité invalide" };
  const cost = bulkCost(id, state.upgrades[id], count);
  if (state.resources.nutrients < cost) return { ok: false, error: "Pas assez de nutriments" };
  return {
    ok: true,
    state: {
      ...state,
      resources: { ...state.resources, nutrients: state.resources.nutrients - cost },
      upgrades: { ...state.upgrades, [id]: state.upgrades[id] + count },
    },
  };
}

/** Empreinte stable d'un état (tests de non-régression, comparaison client/serveur). */
export function stateFingerprint(s: PlayerState): string {
  const r = (x: number): string => x.toFixed(6);
  const owned = [...s.owned.keys()].sort().join(";");
  const parts = [
    s.time,
    r(s.resources.nutrients),
    r(s.resources.water),
    r(s.resources.biomass),
    s.owned.size,
    hashString(owned).toString(16),
    s.discovered.size,
    s.growing ? `${s.growing.key}@${r(s.growing.finishAt)}` : "-",
  ];
  return parts.join("|");
}
