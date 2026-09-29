import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { migrate } from "./migrate.js";

// Test d'intégration : nécessite une vraie base (DATABASE_URL), sauté sinon.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("migrate (PostgreSQL)", () => {
  const pool = new pg.Pool({ connectionString: url });
  afterAll(() => pool.end());

  it("applique les migrations puis est idempotent", async () => {
    await migrate(pool);
    expect(await migrate(pool)).toEqual([]);
    const { rows } = await pool.query<{ name: string }>("SELECT name FROM schema_migrations");
    expect(rows.map((r) => r.name)).toContain("001_init.sql");
    await pool.query("SELECT id, name, created_at FROM players LIMIT 0");
  });
});
