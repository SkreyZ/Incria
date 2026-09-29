/**
 * Logique de saison hebdomadaire (reset de campagne).
 * Tout est en UTC pour que le reset soit identique pour tous les joueurs.
 */

/** Jour du reset : 1 = lundi (convention Date#getUTCDay). */
export const RESET_WEEKDAY = 1;
/** Heure UTC du reset. */
export const RESET_HOUR_UTC = 0;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Date du prochain reset strictement après `now`. */
export function nextReset(now: Date): Date {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), RESET_HOUR_UTC),
  );
  const daysAhead = (RESET_WEEKDAY - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + daysAhead);
  if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 7);
  return d;
}

/** Date du reset qui a ouvert la saison en cours. */
export function currentSeasonStart(now: Date): Date {
  return new Date(nextReset(now).getTime() - WEEK_MS);
}

/**
 * Vrai si `now` est dans la fenêtre de gel autour du reset
 * (pas de déploiement prod pendant cette fenêtre).
 */
export function isInResetFreeze(now: Date, marginMinutes = 60): boolean {
  const margin = marginMinutes * 60 * 1000;
  const next = nextReset(now).getTime();
  const prev = next - WEEK_MS;
  const t = now.getTime();
  return next - t <= margin || t - prev <= margin;
}

/** Bonus permanent (méta-progression) conservé d'une semaine à l'autre. */
export function permanentMultiplier(prestigeLevel: number): number {
  if (!Number.isInteger(prestigeLevel) || prestigeLevel < 0) {
    throw new RangeError("prestigeLevel doit être un entier >= 0");
  }
  return 1 + 0.1 * prestigeLevel;
}
