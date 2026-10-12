import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

describe("GET /health", () => {
  it("renvoie la saison courante calculée par @game/core (UTC)", async () => {
    // Mercredi 2026-09-30 12:00 UTC → saison ouverte lundi 28/09, reset lundi 05/10.
    const app = buildApp(() => new Date("2026-09-30T12:00:00Z"));
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      now: "2026-09-30T12:00:00.000Z",
      seasonStart: "2026-09-28T00:00:00.000Z",
      nextReset: "2026-10-05T00:00:00.000Z",
    });
    await app.close();
  });
});
