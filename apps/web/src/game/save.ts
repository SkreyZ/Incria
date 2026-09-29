/**
 * Sauvegarde navigateur du prototype solo (le serveur autoritaire la remplacera).
 * PlayerState contient des Map/Set : on les aplatit en tableaux pour JSON.
 */
import type { OwnedTile, PlayerState } from "@game/core";

export const SAVE_KEY = "mycelium.save";
const VERSION = 1;

interface SaveV1 {
  v: typeof VERSION;
  seed: string;
  state: Omit<PlayerState, "owned" | "discovered"> & {
    owned: [string, OwnedTile][];
    discovered: string[];
  };
}

export function serialize(state: PlayerState, seed: string): string {
  const save: SaveV1 = {
    v: VERSION,
    seed,
    state: { ...state, owned: [...state.owned], discovered: [...state.discovered] },
  };
  return JSON.stringify(save);
}

/** null si la sauvegarde est absente, corrompue, d'une autre version ou d'une autre carte (saison). */
export function deserialize(json: string | null, seed: string): PlayerState | null {
  if (!json) return null;
  try {
    const save = JSON.parse(json) as SaveV1;
    if (save?.v !== VERSION || save.seed !== seed) return null;
    const s = save.state;
    if (!Array.isArray(s.owned) || !Array.isArray(s.discovered) || typeof s.time !== "number") return null;
    return { ...s, owned: new Map(s.owned), discovered: new Set(s.discovered) };
  } catch {
    return null;
  }
}

/** localStorage (par défaut) peut être absent ou lever, même à l'accès (navigation privée, quota) : le jeu tourne sans. */
export function readSave(seed: string, storage?: Storage): PlayerState | null {
  try {
    return deserialize((storage ?? globalThis.localStorage)?.getItem(SAVE_KEY) ?? null, seed);
  } catch {
    return null;
  }
}

export function writeSave(state: PlayerState, seed: string, storage?: Storage): void {
  try {
    (storage ?? globalThis.localStorage)?.setItem(SAVE_KEY, serialize(state, seed));
  } catch {
    // sauvegarde perdue, pas le jeu
  }
}
