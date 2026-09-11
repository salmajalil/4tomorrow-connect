"use client";

import { useEffect, useState } from "react";

const LOADING_MESSAGES = [
  "Lecture du répertoire de l'écosystème...",
  "Recherche de technologies pertinentes...",
  "Analyse des startups du secteur...",
  "Identification d'experts et de partenaires...",
  "Recherche de pistes de financement...",
  "Rédaction du brief stratégique...",
];

export function MatchingLoadingState() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-surface-2 border-t-accent" />
      <div>
        <p className="font-display text-xl tracking-wide text-ink">{LOADING_MESSAGES[messageIndex]}</p>
        <p className="mt-2 max-w-xs text-sm text-muted">
          On explore le répertoire et le web pour trouver des partenaires réels. Ça peut prendre
          1 à 2 minutes selon la complexité du projet — merci de patienter.
        </p>
      </div>
    </div>
  );
}

export function MatchingErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-danger/40 bg-danger/10 px-6 py-12 text-center">
      <div>
        <p className="font-display text-xl tracking-wide text-danger">Le matching a échoué</p>
        <p className="mt-1 max-w-sm text-sm text-ink">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
      >
        Réessayer
      </button>
    </div>
  );
}
