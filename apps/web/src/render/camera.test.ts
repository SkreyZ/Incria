import { describe, expect, it } from "vitest";
import { type Camera, MAX_ZOOM, MIN_ZOOM, pan, pinch, screenToWorld, visibleBounds, worldToScreen, zoomAt } from "./camera.js";

const vp = { width: 800, height: 600 };
const cam: Camera = { x: 100, y: -50, zoom: 2 };

describe("camera", () => {
  it("worldToScreen et screenToWorld sont inverses ; le centre caméra est au centre écran", () => {
    expect(worldToScreen(cam, vp, { x: 100, y: -50 })).toEqual({ x: 400, y: 300 });
    const s = { x: 123, y: 456 };
    const back = worldToScreen(cam, vp, screenToWorld(cam, vp, s));
    expect(back.x).toBeCloseTo(s.x);
    expect(back.y).toBeCloseTo(s.y);
  });

  it("pan : le point du monde suit le pointeur", () => {
    const w = screenToWorld(cam, vp, { x: 10, y: 10 });
    const moved = worldToScreen(pan(cam, 30, -20), vp, w);
    expect(moved.x).toBeCloseTo(40);
    expect(moved.y).toBeCloseTo(-10);
  });

  it("zoomAt garde fixe le point sous l'ancre et borne le zoom", () => {
    const anchor = { x: 700, y: 100 };
    const w = screenToWorld(cam, vp, anchor);
    const z = zoomAt(cam, vp, anchor, 1.5);
    expect(z.zoom).toBe(3);
    const s = worldToScreen(z, vp, w);
    expect(s.x).toBeCloseTo(anchor.x);
    expect(s.y).toBeCloseTo(anchor.y);
    expect(zoomAt(cam, vp, anchor, 1000).zoom).toBe(MAX_ZOOM);
    expect(zoomAt(cam, vp, anchor, 0.0001).zoom).toBe(MIN_ZOOM);
  });

  it("pinch : écarter les doigts zoome, les points du monde restent sous les doigts", () => {
    const a0 = { x: 300, y: 300 };
    const b0 = { x: 500, y: 300 };
    const wa = screenToWorld(cam, vp, a0);
    const a1 = { x: 250, y: 320 };
    const b1 = { x: 550, y: 320 };
    const p = pinch(cam, vp, a0, b0, a1, b1);
    expect(p.zoom).toBeCloseTo(3);
    const s = worldToScreen(p, vp, wa);
    expect(s.x).toBeCloseTo(a1.x);
    expect(s.y).toBeCloseTo(a1.y);
  });

  it("visibleBounds couvre exactement l'écran (plus la marge)", () => {
    expect(visibleBounds(cam, vp, 10)).toEqual({ minX: -110, maxX: 310, minY: -210, maxY: 110 });
  });
});
