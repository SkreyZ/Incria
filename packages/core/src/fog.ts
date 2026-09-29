/**
 * Brouillard : on ne voit que les tuiles proches de son réseau.
 * Le terrain déjà découvert reste connu ; ce qui s'y passe (voisins) seulement s'il est visible.
 */
import { type Hex, hexKey, parseHexKey, spiral } from "./hex.js";

/** Distance de vue autour de chaque tuile possédée. */
export const VISION_RADIUS = 3;

/**
 * Tuiles visibles depuis un ensemble de tuiles possédées.
 * `inMap` filtre les hex hors carte.
 */
export function visibleFrom(
  owned: Iterable<string>,
  inMap: (key: string) => boolean,
  radius: number = VISION_RADIUS,
): Set<string> {
  const out = new Set<string>();
  for (const key of owned) addVisible(out, parseHexKey(key), inMap, radius);
  return out;
}

/** Ajoute à `into` les tuiles visibles autour d'un hex (utile quand on gagne une tuile). */
export function addVisible(
  into: Set<string>,
  center: Hex,
  inMap: (key: string) => boolean,
  radius: number = VISION_RADIUS,
): void {
  for (const h of spiral(center, radius)) {
    const k = hexKey(h);
    if (inMap(k)) into.add(k);
  }
}
