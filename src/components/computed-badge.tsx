"use client";

import { Icon } from "@/components/icons";
import { useLanguage } from "@/components/language-provider";

// Confiance v2 (benchmark ClearPoint) — marque un champ de RÉSULTAT : jamais
// saisi, toujours dérivé d'un calcul serveur (src/lib/*-calc.ts). Petit
// libellé mono, même style que les autres micro-libellés de l'app
// (font-mono text-[10px] uppercase tracking-wide text-muted), avec un
// cadenas pour le distinguer d'un champ de saisie d'un coup d'œil.
export function ComputedBadge({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <span
      title={t.trust.computedHint}
      className={`inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-muted ${className}`}
    >
      <Icon name="lock" className="h-3 w-3" />
      <span>{t.trust.computed}</span>
      <span className="sr-only"> — {t.trust.computedHint}</span>
    </span>
  );
}
