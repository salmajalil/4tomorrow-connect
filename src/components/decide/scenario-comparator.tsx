// Replaces the radar: one row per criterion, one bar per scenario, scores
// out of 10. Bars read correctly on a phone, labels are never clipped, and
// the recommended scenario is drawn in the module accent while the two
// alternatives stay neutral — the eye goes where the recommendation is.
export function ScenarioComparator({
  axes,
  axisLabel,
  scenarios,
  recommendedIndex,
  title,
  hint,
}: {
  axes: string[];
  axisLabel: (axis: string) => string;
  scenarios: { label: string; scores: Record<string, number | undefined> }[];
  recommendedIndex: number;
  title: string;
  hint: string;
}) {
  if (axes.length === 0 || scenarios.length === 0) return null;
  let alternative = 0;
  const tones = scenarios.map((_, i) =>
    i === recommendedIndex ? "var(--accent)" : alternative++ === 0 ? "var(--muted)" : "var(--border-strong)"
  );

  return (
    <section className="border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl text-ink">{title}</h2>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2" aria-hidden>
        {scenarios.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-xs text-body">
            <span className="h-2.5 w-2.5 shrink-0" style={{ background: tones[i] }} />
            {s.label}
          </li>
        ))}
      </ul>
      <dl className="mt-5 flex flex-col gap-4">
        {axes.map((axis) => (
          <div key={axis} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-4">
            <dt className="text-sm text-body">{axisLabel(axis)}</dt>
            <dd className="flex flex-col gap-1">
              {scenarios.map((s, i) => {
                const v = Math.max(0, Math.min(10, s.scores[axis] ?? 0));
                return (
                  <div key={s.label} className="flex items-center gap-2" title={`${s.label} : ${v}/10`}>
                    <div className="h-2 flex-1 bg-surface-2">
                      <div className="h-full" style={{ width: `${v * 10}%`, background: tones[i] }} />
                    </div>
                    <span className={`w-6 text-right font-mono text-[11px] tabular-nums ${i === recommendedIndex ? "text-accent-strong" : "text-muted"}`}>
                      {v}
                    </span>
                  </div>
                );
              })}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
