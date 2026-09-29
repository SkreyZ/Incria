import Fastify, { type FastifyInstance } from "fastify";
import { currentSeasonStart, nextReset } from "@game/core";

/** Construit l'app HTTP sans écouter : testable via `app.inject`. */
export function buildApp(now: () => Date = () => new Date()): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" && !process.env.VITEST });

  app.get("/health", async () => {
    const t = now();
    return {
      ok: true,
      now: t.toISOString(),
      seasonStart: currentSeasonStart(t).toISOString(),
      nextReset: nextReset(t).toISOString(),
    };
  });

  return app;
}
