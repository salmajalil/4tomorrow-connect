"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/language-provider";

// Reached only via the "forgot password" email link: Supabase's recovery
// flow lands the user on /auth/callback with a code, which exchanges it
// for a real (short-lived) session before redirecting here — so by the
// time this page renders, supabase.auth.updateUser is already acting on
// the right account, no token handling needed on this page itself.
export default function ResetPasswordPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      setTimeout(() => {
        router.push("/connect");
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.resetPassword.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="font-display text-3xl text-ink">{t.resetPassword.title}</h1>
      <p className="mt-1 text-sm text-muted">{t.resetPassword.subtitle}</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">{t.resetPassword.newPasswordLabel}</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            placeholder="••••••••"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {done && (
          <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{t.resetPassword.success}</p>
        )}

        <button
          type="submit"
          disabled={loading || done}
          className="mt-1 rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:opacity-50"
        >
          {loading ? t.resetPassword.submitting : t.resetPassword.submit}
        </button>
      </form>
    </div>
  );
}
