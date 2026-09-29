/**
 * Rendu Canvas 2D de la carte + déplacement / zoom (souris, molette, tactile).
 * Redessine uniquement quand quelque chose change (caméra, état joueur, taille).
 */
import { type GameMap, type Hex, hexToPixel, type Point, type TileType } from "@game/core";
import { type Camera, pan, pinch, visibleBounds, type Viewport, zoomAt } from "./camera.js";
import { cullTiles, type Filament, HEX_CORNERS, HEX_SIZE, layoutTiles, networkFilaments } from "./layout.js";

/** DA bioluminescente : sol sombre, terrain discret, réseau cyan lumineux. */
export const PALETTE = {
  background: "#0e0b0a",
  fog: "#15110f",
  tiles: { humus: "#2a1f19", deadwood: "#3b2a1c", moss: "#1d3326", rock: "#2b2b2e" } satisfies Record<TileType, string>,
  tileEdge: "rgba(255, 240, 220, 0.05)",
  network: "#5CF2E0",
  networkGlow: "rgba(92, 242, 224, 0.18)",
  ownedTint: "rgba(92, 242, 224, 0.07)",
} as const;

export interface PlayerView {
  readonly owned: ReadonlyMap<string, unknown>;
  readonly discovered: ReadonlySet<string>;
}

export interface MapView {
  setPlayer(p: PlayerView): void;
  centerOn(h: Hex): void;
  destroy(): void;
}

export function createMapView(canvas: HTMLCanvasElement, map: GameMap): MapView {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponible");
  const tiles = layoutTiles(map);
  let cam: Camera = { x: 0, y: 0, zoom: 1 };
  let vp: Viewport = { width: 1, height: 1 };
  let player: PlayerView | null = null;
  let filaments: Filament[] = [];
  let frame = 0;

  const invalidate = (): void => {
    if (!frame) frame = requestAnimationFrame(draw);
  };

  function draw(): void {
    frame = 0;
    const dpr = window.devicePixelRatio || 1;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.fillStyle = PALETTE.background;
    ctx!.fillRect(0, 0, vp.width, vp.height);
    const k = dpr * cam.zoom;
    ctx!.setTransform(k, 0, 0, k, dpr * (vp.width / 2 - cam.x * cam.zoom), dpr * (vp.height / 2 - cam.y * cam.zoom));

    // Un seul chemin par couleur : ~5 fill() par image quel que soit le nombre d'hex.
    const paths = new Map<string, Path2D>();
    const add = (color: string, x: number, y: number): void => {
      let p = paths.get(color);
      if (!p) paths.set(color, (p = new Path2D()));
      hexPath(p, x, y, HEX_SIZE * 0.96);
    };
    for (const t of cullTiles(tiles, visibleBounds(cam, vp, HEX_SIZE))) {
      const known = !player || player.discovered.has(t.key);
      add(known ? PALETTE.tiles[t.type] : PALETTE.fog, t.x, t.y);
      if (player?.owned.has(t.key)) add(PALETTE.ownedTint, t.x, t.y);
    }
    for (const [color, p] of paths) {
      ctx!.fillStyle = color;
      ctx!.fill(p);
    }
    if (cam.zoom > 0.5) {
      ctx!.strokeStyle = PALETTE.tileEdge;
      ctx!.lineWidth = 1 / cam.zoom;
      for (const p of paths.values()) ctx!.stroke(p);
    }

    if (filaments.length) {
      const net = new Path2D();
      for (const f of filaments) {
        net.moveTo(f.from.x, f.from.y);
        net.quadraticCurveTo(f.ctrl.x, f.ctrl.y, f.to.x, f.to.y);
      }
      ctx!.lineCap = "round";
      // halo large et transparent puis trait fin : moins coûteux que shadowBlur
      ctx!.strokeStyle = PALETTE.networkGlow;
      ctx!.lineWidth = HEX_SIZE * 0.45;
      ctx!.stroke(net);
      ctx!.strokeStyle = PALETTE.network;
      ctx!.lineWidth = Math.max(1.5, HEX_SIZE * 0.08);
      ctx!.stroke(net);
    }
  }

  const resize = (): void => {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    vp = { width: r.width, height: r.height };
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    invalidate();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // Entrées : pointer events unifient souris, stylet et doigts.
  canvas.style.touchAction = "none";
  const pointers = new Map<number, Point>();
  const local = (e: PointerEvent | WheelEvent): Point => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: PointerEvent): void => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
  };
  const onMove = (e: PointerEvent): void => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = local(e);
    if (pointers.size === 1) {
      cam = pan(cam, cur.x - prev.x, cur.y - prev.y);
    } else if (pointers.size === 2) {
      const other = [...pointers].find(([id]) => id !== e.pointerId)![1];
      cam = pinch(cam, vp, prev, other, cur, other);
    }
    pointers.set(e.pointerId, cur);
    invalidate();
  };
  const onUp = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
  };
  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    cam = zoomAt(cam, vp, local(e), Math.exp(-e.deltaY * 0.0015));
    invalidate();
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  return {
    setPlayer(p) {
      player = p;
      filaments = networkFilaments(p.owned);
      invalidate();
    },
    centerOn(h) {
      const world = hexToPixel(h, HEX_SIZE);
      cam = { ...cam, x: world.x, y: world.y };
      invalidate();
    },
    destroy() {
      ro.disconnect();
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
    },
  };
}

function hexPath(p: Path2D, x: number, y: number, r: number): void {
  p.moveTo(x + HEX_CORNERS[0]!.x * r, y + HEX_CORNERS[0]!.y * r);
  for (let i = 1; i < 6; i++) p.lineTo(x + HEX_CORNERS[i]!.x * r, y + HEX_CORNERS[i]!.y * r);
  p.closePath();
}
