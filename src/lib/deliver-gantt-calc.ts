// Feuille de route (Gantt) — calculs de dates déterministes. Fonctions
// pures : jamais d'IA, jamais de réseau. L'IA propose la nature et la durée
// relative des phases ; toutes les dates affichées (début/fin de phase,
// fenêtre disponible, ajustement à une date cible, position sur l'axe) sont
// calculées ici.

const DAY_MS = 86_400_000;

function parseIsoDay(iso: string | null | undefined): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso.slice(0, 10))) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const back = new Date(ms);
  // Rejette les dates impossibles (2026-02-30 → 2026-03-02 en JS).
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  return ms;
}

function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Vrai si la chaîne est une date calendaire réelle au format AAAA-MM-JJ. */
export function isIsoDate(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length === 10 && parseIsoDay(value) !== null;
}

/** Semaines entières disponibles entre deux dates (arrondi inférieur) ; null si invalide ou fin ≤ début. */
export function weeksBetween(startDate: string, endDate: string): number | null {
  const a = parseIsoDay(startDate);
  const b = parseIsoDay(endDate);
  if (a === null || b === null || b <= a) return null;
  return Math.floor((b - a) / DAY_MS / 7);
}

/**
 * Ajuste proportionnellement des durées (semaines) pour que leur somme vaille
 * exactement `totalWeeks` — méthode du plus fort reste, chaque phase garde au
 * moins 1 semaine, l'ordre des phases est conservé. null si impossible
 * (aucune phase, ou moins de semaines disponibles que de phases).
 */
export function fitDurationsToWindow(durations: number[], totalWeeks: number): number[] | null {
  if (durations.length === 0 || !Number.isInteger(totalWeeks) || totalWeeks < durations.length) return null;
  if (durations.some((d) => !Number.isFinite(d) || d <= 0)) return null;
  const sum = durations.reduce((s, d) => s + d, 0);
  // Une semaine minimum par phase, le reste réparti au prorata.
  const spare = totalWeeks - durations.length;
  const raw = durations.map((d) => (d / sum) * spare);
  const floors = raw.map(Math.floor);
  let remaining = spare - floors.reduce((s, f) => s + f, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remaining <= 0) break;
    floors[i] += 1;
    remaining -= 1;
  }
  return floors.map((f) => f + 1);
}

/** Dates séquentielles des phases : la phase N+1 démarre le jour où la phase N se termine. */
export function computePhaseDates(startDate: string, durationsWeeks: number[]): { start: string; end: string }[] {
  const start = parseIsoDay(startDate);
  if (start === null) throw new Error("Date de démarrage invalide.");
  let cursor = start;
  return durationsWeeks.map((weeks) => {
    const s = cursor;
    const e = cursor + weeks * 7 * DAY_MS;
    cursor = e;
    return { start: toIso(s), end: toIso(e) };
  });
}

export type Milestone = { name: string; date: string | null };

/**
 * Jalons saisis en texte libre, un par ligne : "Nom — 2026-03-15" ou
 * "Nom : 15/03/2026" (date facultative). Une date absente ou impossible
 * reste null — jamais devinée.
 */
export function parseMilestones(text: string | null | undefined): Milestone[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-•*]\s*/, ""))
    .filter((line) => line.length > 0)
    .map((line) => {
      let date: string | null = null;
      let rest = line;
      const iso = line.match(/(\d{4})-(\d{2})-(\d{2})/);
      const fr = line.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (iso) {
        const candidate = `${iso[1]}-${iso[2]}-${iso[3]}`;
        if (isIsoDate(candidate)) date = candidate;
        rest = line.replace(iso[0], "");
      } else if (fr) {
        const candidate = `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
        if (isIsoDate(candidate)) date = candidate;
        rest = line.replace(fr[0], "");
      }
      const name = rest.replace(/[\s—–\-:,;()]+$/u, "").replace(/^[\s—–\-:,;()]+/u, "").trim();
      return { name: name || line, date };
    });
}

/** Position (0-100 %) d'une date sur l'axe [rangeStart, rangeEnd] ; null si hors de l'axe ou invalide. */
export function ganttOffsetPercent(rangeStart: string, rangeEnd: string, date: string): number | null {
  const a = parseIsoDay(rangeStart);
  const b = parseIsoDay(rangeEnd);
  const d = parseIsoDay(date);
  if (a === null || b === null || d === null || b <= a || d < a || d > b) return null;
  return ((d - a) / (b - a)) * 100;
}

/** Premiers jours de mois strictement compris dans l'axe, pour les graduations. */
export function monthTicks(rangeStart: string, rangeEnd: string): string[] {
  const a = parseIsoDay(rangeStart);
  const b = parseIsoDay(rangeEnd);
  if (a === null || b === null || b <= a) return [];
  const first = new Date(a);
  let y = first.getUTCFullYear();
  let m = first.getUTCMonth() + 1;
  const ticks: string[] = [];
  for (;;) {
    if (m > 11) {
      m = 0;
      y += 1;
    }
    const ms = Date.UTC(y, m, 1);
    if (ms >= b) break;
    if (ms > a) ticks.push(toIso(ms));
    m += 1;
  }
  return ticks;
}

/** Bornes de l'axe : de la première date de début à la plus tardive de toutes les dates fournies (fins, jalons, cible). */
export function ganttRange(starts: string[], otherDates: (string | null | undefined)[]): { start: string; end: string } | null {
  const s = starts.map(parseIsoDay).filter((n): n is number => n !== null);
  const all = [...s, ...otherDates.map(parseIsoDay).filter((n): n is number => n !== null)];
  if (s.length === 0) return null;
  const min = Math.min(...s, ...all);
  const max = Math.max(...all);
  return max > min ? { start: toIso(min), end: toIso(max) } : null;
}
