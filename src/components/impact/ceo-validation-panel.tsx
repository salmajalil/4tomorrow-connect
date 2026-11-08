"use client";

import { useEffect, useState } from "react";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { useLanguage } from "@/components/language-provider";
import { validationHistoryStatus, type CurrentDecisionState, type ValidationHistoryStatus } from "@/lib/validation-token";

type HistoryEntry = {
  id: string;
  trajectory_id: string;
  decision_snapshot: string;
  expires_at: string;
  used_at: string | null;
  outcome: "validated" | "needs_more_info" | "rejected" | null;
  outcome_note: string | null;
  created_at: string;
};

const STATUS_CLASS: Record<ValidationHistoryStatus, string> = {
  validated: "bg-success text-bg",
  rejected: "bg-danger text-white",
  needs_more_info: "border border-accent text-accent-strong",
  pending: "border border-dashed border-muted text-muted",
  expired: "border border-muted text-muted line-through",
  outdated: "border border-danger/60 text-danger",
};

// L09 — déclenche l'émission d'un lien de validation CEO (jeton 72h) et
// affiche l'historique qui/quand/résultat déjà demandé par le brief. Vit
// dans Impact (la "vue bilan" existante), pas une nouvelle entrée de nav.
export function CeoValidationPanel({ transformationId }: { transformationId: string }) {
  const { t, language } = useLanguage();
  const v = t.impact.ceoValidation;
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [current, setCurrent] = useState<CurrentDecisionState | null>(null);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/decide/validation?transformationId=${transformationId}`)
      .then((res) => res.json())
      .then((data) => {
        setHistory(data.history ?? []);
        setCurrent(data.current ?? null);
      })
      .catch(() => {});
  }, [transformationId]);

  async function issueLink() {
    setLoading(true);
    setError("");
    setLink(null);
    try {
      const res = await fetch("/api/decide/validation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transformationId }),
      });
      const { data } = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) || v.errorGeneric);
      setLink(data.url as string);
      const refreshed = await fetch(`/api/decide/validation?transformationId=${transformationId}`).then((r) => r.json());
      setHistory(refreshed.history ?? []);
      setCurrent(refreshed.current ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : v.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — the link is still shown as selectable text below
    }
  }

  return (
    <section className="mt-4 border border-border bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-muted">{v.title}</h3>
        <button
          type="button"
          onClick={issueLink}
          disabled={loading}
          className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-ink disabled:opacity-50"
        >
          {loading ? "…" : v.send}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {link && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-ink">{link}</span>
          <button type="button" onClick={copyLink} className="shrink-0 text-xs font-semibold text-accent-strong underline">
            {copied ? v.copied : v.copy}
          </button>
        </div>
      )}

      {history.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {history.map((h) => {
            const status = validationHistoryStatus(
              {
                transformationId,
                trajectoryId: h.trajectory_id,
                decisionSnapshot: h.decision_snapshot,
                expiresAt: h.expires_at,
                usedAt: h.used_at,
                outcome: h.outcome,
              },
              current,
              new Date()
            );
            const label =
              status === "pending" ? v.pending : status === "expired" ? v.expired : status === "outdated" ? v.outdated : v.outcome[status];
            return (
              <li key={h.id} className="flex flex-col gap-1 border-t border-border py-2 text-sm first:border-t-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted">
                    {new Date(h.created_at).toLocaleString(language === "en" ? "en-US" : "fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  <span className={`px-2 py-0.5 font-mono text-xs uppercase tracking-[0.12em] ${STATUS_CLASS[status]}`}>{label}</span>
                </div>
                {h.outcome_note && (
                  <p className="text-sm text-ink">
                    <span className="text-muted">{v.ceoNote}</span> {h.outcome_note}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
