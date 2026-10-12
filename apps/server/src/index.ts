import pg from "pg";
import { buildApp } from "./app.js";
import { migrate } from "./migrate.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL manquant (voir .env.example)");

const pool = new pg.Pool({ connectionString: databaseUrl });
await migrate(pool);

const app = buildApp();
app.addHook("onClose", () => pool.end());
await app.listen({ host: process.env.HOST ?? "0.0.0.0", port: Number(process.env.PORT ?? 3000) });
