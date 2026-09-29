import { describe, expect, it } from "vitest";
import { baseZoneLabel } from "./label.js";

describe("baseZoneLabel", () => {
  it("utilise @game/core : la zone de base compte 19 tuiles", () => {
    expect(baseZoneLabel()).toBe("Mycelium — zone de base : 19 tuiles");
  });
});
