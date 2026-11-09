import { createServiceClient } from "@/lib/supabase/service";
import { evaluateConsumption, type ValidationTokenRecord, type CurrentDecisionState } from "@/lib/validation-token";
import { fetchProjectImpact } from "@/lib/project-impact";
import { fetchDecisionHash } from "@/lib/decision-hash";
import { ValidationActions } from "@/components/validate/validation-actions";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary } from "@/lib/i18n/dictionary";

// L09 — page mobile pour le CEO, atteinte uniquement par lien (jamais dans
// la nav — voir src/app/auth/reset-password/page.tsx pour le même principe
// de page "lien seul"). Aucune authentification : l'accès tient entièrement
// au jeton opaque dans l'URL, vérifié côté serveur via le client service
// role (src/lib/supabase/service.ts), jamais exposé au client.
export default async function ValidatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Pas de session ici (lien seul) : la langue vient du cookie, comme
  // src/app/connect/page.tsx.
  const language = await getLanguage();
  const v = getDictionary(language).impact.ceoValidation;
  const supabase = createServiceClient();

  const { data: tokenRow } = await supabase
    .from("ceo_validation_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow) {
    return <StatusPage title={v.notFoundTitle} message={v.notFoundMessage} />;
  }

  const { data: tx } = await supabase
    .from("transformations")
    .select("id, selected_trajectory_id, decision_updated_at")
    .eq("id", tokenRow.transformation_id)
    .maybeSingle();

  if (!tx) {
    return <StatusPage title={v.projectNotFoundTitle} message={v.projectNotFoundMessage} />;
  }

  const record: ValidationTokenRecord = {
    transformationId: tokenRow.transformation_id,
    trajectoryId: tokenRow.trajectory_id,
    decisionSnapshot: tokenRow.decision_snapshot,
    expiresAt: tokenRow.expires_at,
    usedAt: tokenRow.used_at,
    decisionHash: tokenRow.decision_hash ?? null,
  };
  const current: CurrentDecisionState = {
    transformationId: tx.id,
    trajectoryId: tx.selected_trajectory_id,
    decisionUpdatedAt: tx.decision_updated_at,
    // Empreinte recalculée sur l'état actuel : si elle diffère de celle
    // figée à l'émission, la page affiche « Décision modifiée depuis
    // l'envoi » au lieu des boutons de validation.
    decisionHash: await fetchDecisionHash(supabase, tx),
  };

  if (tokenRow.used_at !== null) {
    const labels: Record<string, string> = {
      validated: v.alreadyValidated,
      needs_more_info: v.alreadyNeedsMoreInfo,
      rejected: v.alreadyRejected,
    };
    return (
      <StatusPage
        title={v.alreadyHandledTitle}
        message={labels[tokenRow.outcome ?? ""] ?? v.alreadyUsed}
      />
    );
  }

  const usable = evaluateConsumption(record, current, new Date(), true);
  if (!usable.ok) {
    return <StatusPage title={v.invalidTitle} message={usable.code ? v.reasons[usable.code] : v.invalidMessage} />;
  }

  const project = await fetchProjectImpact(supabase, tx.id);
  const keyFigures = (project?.keyIndicators ?? project?.indicators ?? []).slice(0, 3);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-md flex-col gap-6 px-4 py-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">{v.pageTag}</p>
        <h1 className="mt-2 font-display text-3xl text-ink">{project?.trajectory?.name ?? v.decisionFallback}</h1>
        {project?.trajectory?.stance && <p className="mt-1 text-sm text-muted">{project.trajectory.stance}</p>}
      </div>

      {project?.trajectory?.executiveBriefing && (
        <p className="text-sm leading-relaxed text-ink">{project.trajectory.executiveBriefing}</p>
      )}

      {keyFigures.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {keyFigures.map((indicator) => (
            <div key={indicator.label} className="rounded-lg border border-border bg-surface p-4">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">{indicator.label}</p>
              <p className="mt-1 font-display text-2xl text-ink tabular-nums">{String(indicator.value ?? "—")}</p>
            </div>
          ))}
        </div>
      )}

      <a
        href={`/impact?transformationId=${tx.id}`}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-medium text-accent underline underline-offset-2"
      >
        {v.seeEvidence}
      </a>

      <ValidationActions token={token} />

      <p className="text-center text-xs text-muted">
        {v.expiresOn.replace(
          "{date}",
          new Date(tokenRow.expires_at).toLocaleString(language === "en" ? "en-US" : "fr-FR", { dateStyle: "medium", timeStyle: "short" })
        )}
      </p>
    </div>
  );
}

function StatusPage({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-sm flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="font-display text-2xl text-ink">{title}</h1>
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}
