#!/usr/bin/env node
// Échoue (exit 1) si on est dans la fenêtre de gel autour du reset hebdo.
// Utilisé par deploy-prod.yml. Dupliqué volontairement (pas de build requis).
const RESET_WEEKDAY = 1; // lundi
const RESET_HOUR_UTC = 0;
const MARGIN_MIN = Number(process.env.RESET_FREEZE_MINUTES ?? 60);

const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), RESET_HOUR_UTC));
d.setUTCDate(d.getUTCDate() + ((RESET_WEEKDAY - d.getUTCDay() + 7) % 7));
if (d <= now) d.setUTCDate(d.getUTCDate() + 7);
const next = d.getTime();
const prev = next - 7 * 24 * 3600 * 1000;
const margin = MARGIN_MIN * 60 * 1000;
const t = now.getTime();

if (next - t <= margin || t - prev <= margin) {
  console.error(`⛔ Fenêtre de gel du reset hebdo (±${MARGIN_MIN} min). Déploiement prod refusé.`);
  process.exit(1);
}
console.log(`✅ Hors fenêtre de gel. Prochain reset : ${new Date(next).toISOString()}`);
