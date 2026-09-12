"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";

export function MatchingLoadingState() {
  const { t } = useLanguage();
  const messages = t.connect.loading.messages;
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % messages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-surface-2 border-t-accent" />
      <div>
        <p className="font-display text-xl text-ink">{messages[messageIndex]}</p>
        <p className="mt-2 max-w-xs text-sm text-muted">{t.connect.loading.hint}</p>
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
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-danger/40 bg-danger/10 px-6 py-12 text-center">
      <div>
        <p className="font-display text-xl text-danger">{t.connect.error.title}</p>
        <p className="mt-1 max-w-sm text-sm text-ink">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
      >
        {t.common.retry}
      </button>
    </div>
  );
}
