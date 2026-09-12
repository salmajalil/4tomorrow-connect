"use client";

import { useState } from "react";
import { parseJsonResponse } from "@/lib/parse-json-response";

type ExportKind = "decide" | "connect" | "learn" | "control-tower";

export function ExportPdfButton({
  kind,
  payload,
  filename,
  label = "Exporter en PDF",
}: {
  kind: ExportKind;
  payload: Record<string, unknown>;
  filename: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleExport() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, payload }),
      });
      if (!res.ok) {
        const { data } = await parseJsonResponse(res);
        throw new Error((data.error as string) || "Export impossible.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:border-accent/50 hover:text-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Export en cours..." : `⬇ ${label}`}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
