"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/lib/i18n/dictionary";

export function DeleteAccountButton({ t }: { t: Dictionary }) {
  const router = useRouter();
  const a = t.account;
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || a.deleteAccountError);
        return;
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch {
      setError(a.deleteAccountError);
    } finally {
      setSubmitting(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-danger px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10"
      >
        {a.deleteAccountButton}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-danger bg-danger/5 p-4">
      <p className="text-sm font-semibold text-ink">{a.deleteAccountConfirmTitle}</p>
      <p className="text-sm text-body">{a.deleteAccountConfirmBody}</p>
      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={a.deleteAccountConfirmPlaceholder}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-danger focus:outline-none"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={submitting || typed !== a.deleteAccountConfirmWord}
          onClick={() => void confirmDelete()}
          className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? a.deleteAccountSubmitting : a.deleteAccountSubmit}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setTyped("");
            setError(null);
          }}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/50"
        >
          {a.deleteAccountCancel}
        </button>
      </div>
    </div>
  );
}
