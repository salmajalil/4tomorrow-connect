"use client";

import { useEffect, useState } from "react";
import { parseJsonResponse } from "@/lib/parse-json-response";

type HistoryEntry = {
  id: string;
  expires_at: string;
  used_at: string | null;
  outcome: "validated" | "needs_more_info" | "rejected" | null;
  outcome_note: string | null;
  created_at: string;
};

const OUTCOME_LABEL: Record<string, string> = {
  validated: "Validé",
  needs_more_info: "Complément demandé",
  rejected: "Refusé",
};

// L09 — déclenche l'émission d'un lien de validation CEO (jeton 72h) et
// affiche l'historique qui/quand/résultat déjà demandé par le brief. Vit
// dans Impact (la "vue bilan" existante), pas une nouvelle entrée de nav.
export function CeoValidationPanel({ transformationId }: { transformationId: string }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/decide/validation?transformationId=${transformationId}`)
      .then((res) => res.json())
      .then((data) => setHistory(data.history ?? []))
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
      if (!res.ok) throw new Error((data.error as string) || "Une erreur est survenue.");
      setLink(data.url as string);
      const refreshed = await fetch(`/api/decide/validation?transformationId=${transformationId}`).then((r) => r.json());
      setHistory(refreshed.history ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
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
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Validation CEO</h3>
        <button
          type="button"
          onClick={issueLink}
          disabled={loading}
          className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-ink disabled:opacity-50"
        >
          {loading ? "…" : "Envoyer au CEO pour validation"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {link && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-ink">{link}</span>
          <button type="button" onClick={copyLink} className="shrink-0 text-xs font-semibold text-accent-strong underline">
            {copied ? "Copié" : "Copier"}
          </button>
        </div>
      )}

      {history.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {history.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 text-sm first:border-t-0">
              <span className="text-muted">
                {new Date(h.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
              </span>
              <span
                className={`px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
                  h.outcome === "validated"
                    ? "bg-success text-bg"
                    : h.outcome === "rejected"
                      ? "bg-danger text-white"
                      : h.outcome === "needs_more_info"
                        ? "border border-accent text-accent-strong"
                        : "border border-dashed border-muted text-muted"
                }`}
              >
                {h.outcome ? OUTCOME_LABEL[h.outcome] : "En attente"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
