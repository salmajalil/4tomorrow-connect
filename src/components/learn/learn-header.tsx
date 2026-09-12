// Recurring identity block from the reference product: a glowing icon
// tile + "Learn" + an "IA" pill + a small tracked-out tagline. Shown at
// the top of every Learn screen (intake, loading, result) so the module
// reads as its own place rather than a generic form embedded in the site.
export function LearnHeader() {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/50 text-xl"
        style={{
          background: "radial-gradient(circle at 35% 30%, rgba(63,214,122,0.35), rgba(4,20,10,0.9))",
          boxShadow: "0 0 18px -4px var(--accent)",
        }}
      >
        ⚛️
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-display text-lg text-ink">Learn</span>
          <span className="rounded-full border border-accent/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-strong">
            IA
          </span>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          Formez-vous plus vite · 4 Tomorrow
        </p>
      </div>
    </div>
  );
}
