"use client";

import { useState } from "react";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { useLanguage } from "@/components/language-provider";

type Outcome = "validated" | "needs_more_info" | "rejected";

// L09 — les 3 actions du CEO. Ouvrir la page ne valide rien : il faut
// cliquer explicitement l'un des 3 boutons, et pour "valider"/"refuser" une
// case de confirmation doit en plus être cochée (le clic seul ne suffit
// pas) — l'IA ou un simple GET ne peuvent jamais déclencher cette route.
export function ValidationActions({ token }: { token: string }) {
  const { t } = useLanguage();
  const v = t.impact.ceoValidation;
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState<Outcome | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Outcome | null>(null);

  async function act(outcome: Outcome) {
    setError("");
    if ((outcome === "validated" || outcome === "rejected") && !confirmed) {
      setError(v.confirmRequired);
      return;
    }
    setLoading(outcome);
    try {
      const res = await fetch(`/api/validate/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true, outcome, note }),
      });
      const { data } = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) || v.errorGeneric);
      setDone(outcome);
    } catch (err) {
      setError(err instanceof Error ? err.message : v.errorGeneric);
    } finally {
      setLoading(null);
    }
  }

  if (done) {
    const labels: Record<Outcome, string> = {
      validated: v.doneValidated,
      needs_more_info: v.doneNeedsMoreInfo,
      rejected: v.doneRejected,
    };
    return <p className="rounded-lg bg-success/10 px-4 py-3 text-sm text-success">{labels[done]}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-start gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-accent"
        />
        <span>{v.confirmLabel}</span>
      </label>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={v.notePlaceholder}
        aria-label={v.notePlaceholder}
        rows={3}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
      />

      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => act("validated")}
          disabled={loading !== null}
          className="flex-1 rounded-lg bg-accent py-3 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:opacity-50"
        >
          {loading === "validated" ? "…" : v.validate}
        </button>
        <button
          type="button"
          onClick={() => act("needs_more_info")}
          disabled={loading !== null}
          className="flex-1 rounded-lg border border-border bg-surface py-3 text-sm font-semibold text-ink transition hover:border-accent/50 disabled:opacity-50"
        >
          {loading === "needs_more_info" ? "…" : v.askMoreInfo}
        </button>
        <button
          type="button"
          onClick={() => act("rejected")}
          disabled={loading !== null}
          className="flex-1 rounded-lg border border-danger/40 py-3 text-sm font-semibold text-danger transition hover:bg-danger/5 disabled:opacity-50"
        >
          {loading === "rejected" ? "…" : v.reject}
        </button>
      </div>
    </div>
  );
}
