import { describe, expect, it } from "vitest";
import { currentSeasonStart, isInResetFreeze, nextReset, permanentMultiplier } from "./season.js";

describe("nextReset", () => {
  it("renvoie le lundi suivant 00:00 UTC", () => {
    // mardi 29 septembre 2026
    expect(nextReset(new Date("2026-09-29T10:00:00Z")).toISOString()).toBe(
      "2026-10-05T00:00:00.000Z",
    );
  });

  it("pile au moment du reset, renvoie le reset de la semaine suivante", () => {
    expect(nextReset(new Date("2026-10-05T00:00:00Z")).toISOString()).toBe(
      "2026-10-12T00:00:00.000Z",
    );
  });

  it("dimanche soir renvoie le lendemain", () => {
    expect(nextReset(new Date("2026-10-04T23:59:00Z")).toISOString()).toBe(
      "2026-10-05T00:00:00.000Z",
    );
  });
});

describe("currentSeasonStart", () => {
  it("renvoie le lundi précédent", () => {
    expect(currentSeasonStart(new Date("2026-09-29T10:00:00Z")).toISOString()).toBe(
      "2026-09-28T00:00:00.000Z",
    );
  });
});

describe("isInResetFreeze", () => {
  it("gèle juste avant et juste après le reset", () => {
    expect(isInResetFreeze(new Date("2026-10-04T23:30:00Z"))).toBe(true);
    expect(isInResetFreeze(new Date("2026-10-05T00:30:00Z"))).toBe(true);
  });
  it("ne gèle pas en milieu de semaine", () => {
    expect(isInResetFreeze(new Date("2026-09-30T12:00:00Z"))).toBe(false);
  });
});

describe("permanentMultiplier", () => {
  it("augmente de 10 % par niveau", () => {
    expect(permanentMultiplier(0)).toBe(1);
    expect(permanentMultiplier(5)).toBeCloseTo(1.5);
  });
  it("refuse les niveaux invalides", () => {
    expect(() => permanentMultiplier(-1)).toThrow(RangeError);
  });
});
