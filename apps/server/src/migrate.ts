import { readdir, readFile } from "node:fs/promises";
import type pg from "pg";

const MIGRATIONS_DIR = new URL("../migrations/", import.meta.url);

/**
 * Applique dans l'ordre alphabétique les fichiers `migrations/*.sql` non encore appliqués.
 * Idempotent : chaque fichier est enregistré dans `schema_migrations` dans sa propre transaction.
 * Un verrou consultatif empêche deux instances de migrer en parallèle.
 * Renvoie les migrations appliquées par cet appel.
 */
export async function migrate(pool: pg.Pool, dir: URL = MIGRATIONS_DIR): Promise<string[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('schema_migrations'))");
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const { rows } = await client.query<{ name: string }>("SELECT name FROM schema_migrations");
    const done = new Set(rows.map((r) => r.name));
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(new URL(file, dir), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} échouée`, { cause: err });
      }
      applied.push(file);
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('schema_migrations'))").catch(() => {});
    client.release();
  }
  return applied;
}
