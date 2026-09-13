"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { useLanguage } from "@/components/language-provider";

export function ConnectToDecide({
  candidates,
  onCancel,
}: {
  candidates: { id: string; title: string }[];
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const empty = t.deliver.empty;
  const router = useRouter();

  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? "");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    if (!selectedId) return;
    setConnecting(true);
    setError("");
    try {
      const res = await fetch("/api/deliver/connect-decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transformationId: selectedId }),
      });
      const { data } = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) || t.common.anErrorOccurred);
      router.push(`/deliver?transformationId=${data.transformationId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.anErrorOccurred);
      setConnecting(false);
    }
  }

  return (
    <div className="mt-6 flex w-full flex-col gap-3 rounded-xl border border-accent/40 bg-accent/5 p-4 text-left">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">{empty.connectSelectLabel}</span>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink focus:border-accent focus:outline-none"
        >
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleConnect}
          disabled={connecting}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {connecting ? empty.connectConnecting : empty.connectButton}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={connecting}
          className="text-sm text-muted underline underline-offset-2 hover:text-ink"
        >
          {t.deliver.wizard.cancel}
        </button>
      </div>
    </div>
  );
}
