import { createServiceClient } from "@/lib/supabase/service";
import { evaluateConsumption, type ValidationTokenRecord, type CurrentDecisionState } from "@/lib/validation-token";
import { fetchProjectImpact } from "@/lib/project-impact";
import { ValidationActions } from "@/components/validate/validation-actions";

// L09 — page mobile pour le CEO, atteinte uniquement par lien (jamais dans
// la nav — voir src/app/auth/reset-password/page.tsx pour le même principe
// de page "lien seul"). Aucune authentification : l'accès tient entièrement
// au jeton opaque dans l'URL, vérifié côté serveur via le client service
// role (src/lib/supabase/service.ts), jamais exposé au client.
export default async function ValidatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: tokenRow } = await supabase
    .from("ceo_validation_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow) {
    return <StatusPage title="Lien introuvable" message="Ce lien de validation n'existe pas." />;
  }

  const { data: tx } = await supabase
    .from("transformations")
    .select("id, selected_trajectory_id, decision_updated_at")
    .eq("id", tokenRow.transformation_id)
    .maybeSingle();

  if (!tx) {
    return <StatusPage title="Projet introuvable" message="Le projet associé à ce lien n'existe plus." />;
  }

  const record: ValidationTokenRecord = {
    transformationId: tokenRow.transformation_id,
    trajectoryId: tokenRow.trajectory_id,
    decisionSnapshot: tokenRow.decision_snapshot,
    expiresAt: tokenRow.expires_at,
    usedAt: tokenRow.used_at,
  };
  const current: CurrentDecisionState = {
    transformationId: tx.id,
    trajectoryId: tx.selected_trajectory_id,
    decisionUpdatedAt: tx.decision_updated_at,
  };

  if (tokenRow.used_at !== null) {
    const labels: Record<string, string> = {
      validated: "Cette décision a déjà été validée.",
      needs_more_info: "Un complément a déjà été demandé sur cette décision.",
      rejected: "Cette décision a déjà été refusée.",
    };
    return (
      <StatusPage
        title="Déjà traité"
        message={labels[tokenRow.outcome ?? ""] ?? "Ce lien a déjà été utilisé."}
      />
    );
  }

  const usable = evaluateConsumption(record, current, new Date(), true);
  if (!usable.ok) {
    return <StatusPage title="Lien invalide" message={usable.reason ?? "Ce lien n'est plus valide."} />;
  }

  const project = await fetchProjectImpact(supabase, tx.id);
  const keyFigures = (project?.keyIndicators ?? project?.indicators ?? []).slice(0, 3);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-md flex-col gap-6 px-4 py-10">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Validation · 4 Tomorrow</p>
        <h1 className="mt-2 font-display text-3xl text-ink">{project?.trajectory?.name ?? "Décision à valider"}</h1>
        {project?.trajectory?.stance && <p className="mt-1 text-sm text-muted">{project.trajectory.stance}</p>}
      </div>

      {project?.trajectory?.executiveBriefing && (
        <p className="text-sm leading-relaxed text-ink">{project.trajectory.executiveBriefing}</p>
      )}

      {keyFigures.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {keyFigures.map((indicator) => (
            <div key={indicator.label} className="rounded-lg border border-border bg-surface p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{indicator.label}</p>
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
        Voir les preuves détaillées →
      </a>

      <ValidationActions token={token} />

      <p className="text-center text-xs text-muted">
        Ce lien est à usage unique et expire le{" "}
        {new Date(tokenRow.expires_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}.
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
