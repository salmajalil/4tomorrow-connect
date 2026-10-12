import { Icon, type IconName } from "@/components/icons";
import { useLanguage } from "@/components/language-provider";

// Weekly ecosystem leaderboard — example data by design (see product
// decision: "Affichage soigné avec données d'exemple"). Not computed from
// real match results yet; purely a polished preview of the feature for
// screenshots. Swap `BOOSTER_DATA` for a real weekly query when this
// becomes a live ranking.
type BoosterEntry = { org: string; score: number; deltaPct: number };
type BoosterKey = "tech" | "ai" | "esg" | "strategy";

const BOOSTER_ICONS: Record<BoosterKey, IconName> = {
  tech: "bolt",
  ai: "chip",
  esg: "leaf",
  strategy: "target",
};

const BOOSTER_DATA: Record<BoosterKey, BoosterEntry[]> = {
  tech: [
    { org: "Atlas Forge Industries", score: 94, deltaPct: 12 },
    { org: "NordSteel Group", score: 88, deltaPct: 6 },
    { org: "Meridian Composites", score: 81, deltaPct: 3 },
  ],
  ai: [
    { org: "Solvex Precision", score: 91, deltaPct: 18 },
    { org: "Atlas Forge Industries", score: 85, deltaPct: 9 },
    { org: "Verdant Automation", score: 79, deltaPct: 4 },
  ],
  esg: [
    { org: "Verdant Automation", score: 96, deltaPct: 15 },
    { org: "Meridian Composites", score: 89, deltaPct: 7 },
    { org: "NordSteel Group", score: 83, deltaPct: 2 },
  ],
  strategy: [
    { org: "NordSteel Group", score: 92, deltaPct: 10 },
    { org: "Solvex Precision", score: 87, deltaPct: 8 },
    { org: "Atlas Forge Industries", score: 80, deltaPct: 5 },
  ],
};

const BOOSTER_ORDER: BoosterKey[] = ["tech", "ai", "esg", "strategy"];

export function EcosystemBoosters() {
  const { t } = useLanguage();
  const b = t.connect.boosters;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent-strong">{b.eyebrow}</p>
          <h2 className="mt-1 font-display text-xl text-ink">{b.title}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">{b.subtitle}</p>
        </div>
        <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
          {b.updatedLabel}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {BOOSTER_ORDER.map((key) => (
          <div key={key} className="rounded-lg border border-border bg-surface-2 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Icon name={BOOSTER_ICONS[key]} className="h-4 w-4 text-accent" />
              {b.categories[key]}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">{b.categoryHints[key]}</p>
            <ol className="mt-3 space-y-2">
              {BOOSTER_DATA[key].map((entry, i) => (
                <li key={entry.org} className={i > 0 ? "border-t border-border/60 pt-2" : undefined}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 truncate text-muted">
                      <span aria-hidden className="w-4 shrink-0 text-center font-mono text-[10px] text-accent">{i + 1}</span>
                      <span className="truncate text-ink">{entry.org}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 font-semibold text-accent-strong">
                      {entry.score}
                      <span className="text-[10px] font-medium text-success">+{entry.deltaPct}%</span>
                    </span>
                  </div>
                  {i === 0 && (
                    <p className="mt-1 pl-5 text-[11px] text-muted">
                      <span className="font-medium text-ink/80">{b.why}:</span> {b.topReasons[key]}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] italic text-muted">{b.exampleDataNote}</p>
    </div>
  );
}
