"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "password" | "magic-link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/connect";

  const [mode, setMode] = useState<Mode>("password");
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (signUpError) throw signUpError;
        setMessage("Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.");
        setIsSignUp(false);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLinkSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (otpError) throw otpError;
      setMessage("Lien envoyé. Ouvre l'email reçu pour te connecter.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="font-display text-3xl tracking-wide text-ink">
        {isSignUp ? "Créer un compte" : "Se connecter"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        Accède à tes transformations et contribue à l&apos;écosystème 4 Tomorrow.
      </p>

      <div className="mt-6 flex gap-1 rounded-lg bg-surface-2 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`flex-1 rounded-md py-1.5 font-medium transition ${
            mode === "password" ? "bg-surface text-ink shadow-sm" : "text-muted"
          }`}
        >
          Mot de passe
        </button>
        <button
          type="button"
          onClick={() => setMode("magic-link")}
          className={`flex-1 rounded-md py-1.5 font-medium transition ${
            mode === "magic-link" ? "bg-surface text-ink shadow-sm" : "text-muted"
          }`}
        >
          Lien magique
        </button>
      </div>

      <form
        onSubmit={mode === "password" ? handlePasswordSubmit : handleMagicLinkSubmit}
        className="mt-6 flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            placeholder="toi@entreprise.com"
          />
        </label>

        {mode === "password" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Mot de passe</span>
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
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{message}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:opacity-50"
        >
          {loading
            ? "Un instant..."
            : mode === "magic-link"
              ? "Envoyer le lien"
              : isSignUp
                ? "Créer mon compte"
                : "Se connecter"}
        </button>
      </form>

      {mode === "password" && (
        <button
          type="button"
          onClick={() => {
            setIsSignUp((v) => !v);
            setError(null);
            setMessage(null);
          }}
          className="mt-4 text-sm text-muted underline underline-offset-2 hover:text-accent"
        >
          {isSignUp ? "Déjà un compte ? Se connecter" : "Pas encore de compte ? En créer un"}
        </button>
      )}
    </div>
  );
}
