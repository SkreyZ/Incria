import { ORIGIN, spiral } from "@game/core";

/** Texte de la page de base : prouve que `@game/core` est importable depuis le client. */
export function baseZoneLabel(): string {
  // Zone de base : spore + 2 anneaux = 19 tuiles.
  return `Mycelium — zone de base : ${spiral(ORIGIN, 2).length} tuiles`;
}
