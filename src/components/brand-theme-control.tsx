"use client";

import { useRef, useState } from "react";
import { useBrandTheme } from "@/components/brand-theme-context";
import { extractFileText } from "@/lib/extract-file-text";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { useLanguage } from "@/components/language-provider";
import type { BrandTheme } from "@/types/database";

export function BrandThemeControl() {
  const { t } = useLanguage();
  const bt = t.brandTheme;
  const { theme, enabled, setEnabled, applyTheme, clearTheme } = useBrandTheme();
  const [open, setOpen] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function analyze(body: { siteUrl?: string; docText?: string; docName?: string }) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/brand/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const { data } = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) || bt.error);
      applyTheme(data.theme as BrandTheme);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : bt.error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(file: File) {
    setError("");
    try {
      const text = await extractFileText(file);
      await analyze({ docText: text, docName: file.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : bt.error);
    }
  }

  async function handleReset() {
    setLoading(true);
    try {
      await fetch("/api/brand/analyze", { method: "DELETE" });
    } finally {
      clearTheme();
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-pressed={enabled}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
          enabled ? "border-accent bg-accent/15 text-accent-strong" : "border-border bg-surface text-muted hover:text-ink"
        }`}
      >
        <span
          aria-hidden
          className="h-2 w-2 rounded-full"
          style={{ background: enabled && theme ? theme.accent : "var(--accent)" }}
        />
        {bt.toggleLabel}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-border bg-surface p-4 shadow-2xl">
          <p className="text-sm font-semibold text-ink">{bt.panelTitle}</p>
          <p className="mt-1 text-xs text-muted">{bt.panelSubtitle}</p>

          {theme && (
            <label className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
              <span className="text-ink">
                {bt.currentTheme} {theme.sourceLabel ? `— ${theme.sourceLabel}` : ""}
              </span>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            </label>
          )}

          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder={bt.siteUrlPlaceholder}
              className="flex-1 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              disabled={loading || !siteUrl.trim()}
              onClick={() => analyze({ siteUrl: siteUrl.trim() })}
              className="shrink-0 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-ink transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? bt.analyzing : bt.analyzeButton}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink transition hover:border-accent/50 disabled:opacity-40"
          >
            {bt.uploadDoc}
          </button>

          {error && <p className="mt-2 text-xs text-danger">{error}</p>}

          {theme && (
            <button
              type="button"
              disabled={loading}
              onClick={handleReset}
              className="mt-3 text-xs text-muted underline underline-offset-2 hover:text-accent"
            >
              {bt.reset}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
