/**
 * Boucle de jeu locale du prototype : toute la simulation vient de `@game/core`,
 * ce module ne fait que tenir l'état courant et le faire avancer.
 */
import {
  buyUpgrade,
  catchUp,
  createPlayer,
  currentSeasonStart,
  type GameMap,
  generateMap,
  type Hex,
  hexKey,
  type PlayerState,
  type Result,
  setTarget,
  type UpgradeId,
} from "@game/core";
import { readSave, writeSave } from "./save.js";

/** Graine de la carte solo : une par saison, donc changer de semaine repart d'une partie neuve. */
export function seasonSeed(nowMs: number): string {
  return `proto:${currentSeasonStart(new Date(nowMs)).toISOString()}`;
}

export interface Game {
  readonly seed: string;
  readonly map: GameMap;
  readonly state: PlayerState;
  /** Avance la simulation jusqu'à `nowMs` (hors ligne plafonné à 24 h par `catchUp`). */
  tick(nowMs: number): void;
  buy(id: UpgradeId): Result;
  /** Direction de croissance (glisser / toucher une tuile), null = mode idle. */
  setGrowthTarget(hex: Hex | null): Result;
  save(): void;
}

export function createGame(nowMs: number, storage?: Storage): Game {
  const seed = seasonSeed(nowMs);
  const map = generateMap({ seed, players: 1 });
  let state = readSave(seed, storage) ?? createPlayer(map, 0, nowMs / 1000);
  // ponytail: pas de reset en cours de session si la saison change, le rechargement de la page suffit au proto.

  const apply = (r: Result): Result => {
    if (r.ok) state = r.state;
    return r;
  };

  const game: Game = {
    seed,
    map,
    get state() {
      return state;
    },
    tick(nowMs) {
      const t = nowMs / 1000;
      if (t > state.time) state = catchUp(state, map, t);
    },
    buy: (id) => apply(buyUpgrade(state, id)),
    setGrowthTarget: (hex) => apply(setTarget(state, map, hex ? hexKey(hex) : null)),
    save: () => writeSave(state, seed, storage),
  };
  game.tick(nowMs); // rattrapage depuis la dernière sauvegarde
  return game;
}
