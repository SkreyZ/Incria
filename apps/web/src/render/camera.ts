/**
 * Caméra 2D pure : (x, y) = point du monde affiché au centre de l'écran, zoom = pixels écran par pixel monde.
 * Aucune dépendance au DOM : testable sous vitest.
 */
import type { Point } from "@game/core";

export interface Camera {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 4;

const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function worldToScreen(cam: Camera, vp: Viewport, p: Point): Point {
  return { x: (p.x - cam.x) * cam.zoom + vp.width / 2, y: (p.y - cam.y) * cam.zoom + vp.height / 2 };
}

export function screenToWorld(cam: Camera, vp: Viewport, s: Point): Point {
  return { x: (s.x - vp.width / 2) / cam.zoom + cam.x, y: (s.y - vp.height / 2) / cam.zoom + cam.y };
}

/** Déplace la caméra d'un delta en pixels écran (glisser = le monde suit le pointeur). */
export function pan(cam: Camera, dx: number, dy: number): Camera {
  return { ...cam, x: cam.x - dx / cam.zoom, y: cam.y - dy / cam.zoom };
}

/** Zoom de `factor` en gardant fixe le point du monde sous `anchor` (coordonnées écran). */
export function zoomAt(cam: Camera, vp: Viewport, anchor: Point, factor: number): Camera {
  const zoom = clampZoom(cam.zoom * factor);
  const w = screenToWorld(cam, vp, anchor);
  return { zoom, x: w.x - (anchor.x - vp.width / 2) / zoom, y: w.y - (anchor.y - vp.height / 2) / zoom };
}

/** Pincement à deux doigts : zoom selon l'écart, déplacement selon le milieu. */
export function pinch(cam: Camera, vp: Viewport, a0: Point, b0: Point, a1: Point, b1: Point): Camera {
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y);
  const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
  const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
  const m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
  const zoomed = d0 > 0 ? zoomAt(cam, vp, m0, d1 / d0) : cam;
  return pan(zoomed, m1.x - m0.x, m1.y - m0.y);
}

/** Rectangle du monde visible, élargi de `margin` (unités monde). */
export function visibleBounds(cam: Camera, vp: Viewport, margin = 0) {
  const hw = vp.width / 2 / cam.zoom + margin;
  const hh = vp.height / 2 / cam.zoom + margin;
  return { minX: cam.x - hw, maxX: cam.x + hw, minY: cam.y - hh, maxY: cam.y + hh };
}
