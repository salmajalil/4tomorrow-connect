import { Text, View, Link as PdfLink } from "@react-pdf/renderer";
import { pdfStyles, PDF_COLORS, ReportShell, SectionTitle, Paragraph, Card, NumberedItem, BadgeList } from "@/lib/pdf/shared";
import { DOMAIN_LABELS, type Domain } from "@/lib/decide";
import type { DiagnosticResult } from "@/components/decide/diagnostic-view";
import type { ScenarioWithId } from "@/components/decide/scenario-card";
import type { ModelOutput, MatchOutput } from "@/lib/matching";
import type { Training } from "@/types/database";
import type { ControlTowerProject } from "@/lib/control-tower";
import type { ModuleName, ModuleStatusValue } from "@/types/database";

function domainBadges(domains: string[]): string[] {
  return domains.map((d) => DOMAIN_LABELS[d as Domain] ?? d);
}

// ---------------------------------------------------------------------
// Decide
// ---------------------------------------------------------------------
export function DecideReportDocument({
  diagnostic,
  scenarios,
}: {
  diagnostic: DiagnosticResult;
  scenarios: ScenarioWithId[];
}) {
  return (
    <ReportShell
      moduleTag="DECIDE"
      title="Diagnostic & scénarios stratégiques"
      subtitle={domainBadges(diagnostic.domains).join(" · ")}
    >
      <SectionTitle>Lecture de la situation</SectionTitle>
      <Paragraph>{diagnostic.maturityReading}</Paragraph>

      <SectionTitle>Gaps identifiés</SectionTitle>
      {diagnostic.gaps.map((g, i) => (
        <Card key={i}>
          <Text style={pdfStyles.h3}>{g.name}</Text>
          <Paragraph>{g.reason}</Paragraph>
        </Card>
      ))}

      <SectionTitle>Causes racines</SectionTitle>
      {diagnostic.rootCauses.map((c, i) => (
        <Card key={i}>
          <Text style={pdfStyles.h3}>{c.name}</Text>
          <Paragraph>{c.reason}</Paragraph>
        </Card>
      ))}

      <SectionTitle>Priorités</SectionTitle>
      {diagnostic.priorities.map((p, i) => (
        <Card key={i}>
          <Text style={pdfStyles.h3}>
            {p.name} — {p.weight}%
          </Text>
          <Paragraph>{p.reason}</Paragraph>
        </Card>
      ))}

      <SectionTitle>Risques</SectionTitle>
      {diagnostic.risks.map((r, i) => (
        <Card key={i}>
          <Text style={pdfStyles.h3}>{r.name}</Text>
          <Paragraph>{r.reason}</Paragraph>
        </Card>
      ))}

      <SectionTitle>Critères de décision retenus</SectionTitle>
      <BadgeList items={diagnostic.decisionCriteria} />

      <SectionTitle>Recommandation de démarrage</SectionTitle>
      <Paragraph>{diagnostic.startingRecommendation}</Paragraph>

      {scenarios.map((s, i) => (
        <View key={s.trajectoryId} break={i > 0}>
          <SectionTitle>
            Scénario {i + 1} — {s.name}
          </SectionTitle>
          <Text style={pdfStyles.muted}>{s.stance}</Text>
          <Paragraph>{s.description}</Paragraph>

          <Text style={pdfStyles.h3}>Briefing exécutif</Text>
          <Paragraph>{s.executiveBriefing}</Paragraph>

          {s.techStack.length > 0 && (
            <>
              <Text style={pdfStyles.h3}>Stack / solutions</Text>
              {s.techStack.map((t, ti) => (
                <Card key={ti}>
                  <Text style={pdfStyles.h3}>{t.name}</Text>
                  <Text style={pdfStyles.muted}>
                    Maturité : {t.maturity}
                    {t.maturityScale ? ` (${t.maturityScale})` : ""}
                  </Text>
                  <Paragraph>{t.detail}</Paragraph>
                  <Text style={pdfStyles.muted}>Bénéfice : {t.benefit}</Text>
                </Card>
              ))}
            </>
          )}

          {s.suppliers.length > 0 && (
            <>
              <Text style={pdfStyles.h3}>Fournisseurs & partenaires</Text>
              {s.suppliers.map((sup, si) => (
                <Card key={si}>
                  <Text style={pdfStyles.h3}>{sup.name}</Text>
                  <Paragraph>{sup.reason}</Paragraph>
                  {sup.website && <Text style={pdfStyles.muted}>{sup.website}</Text>}
                </Card>
              ))}
            </>
          )}

          {s.regulations.length > 0 && (
            <>
              <Text style={pdfStyles.h3}>Régulations / standards</Text>
              {s.regulations.map((r, ri) => (
                <Paragraph key={ri}>
                  {r.name} — {r.description}
                </Paragraph>
              ))}
            </>
          )}

          <Text style={pdfStyles.h3}>Risques & opportunités du scénario</Text>
          {s.risksSpecific.map((r, ri) => (
            <Text key={ri} style={{ ...pdfStyles.p, color: PDF_COLORS.danger }}>
              Risque : {r.name} — {r.reason}
            </Text>
          ))}
          {s.opportunitiesSpecific.map((o, oi) => (
            <Text key={oi} style={{ ...pdfStyles.p, color: PDF_COLORS.success }}>
              Opportunité : {o.name} — {o.reason}
            </Text>
          ))}
        </View>
      ))}
    </ReportShell>
  );
}

// ---------------------------------------------------------------------
// Connect
// ---------------------------------------------------------------------
const CATEGORY_LABELS: Record<MatchOutput["category"], string> = {
  technology: "Technologies",
  startup: "Startups",
  expert: "Experts & consultants",
  partner: "Partenaires",
  funding: "Financement & subventions",
};
const CATEGORY_ORDER: MatchOutput["category"][] = ["technology", "startup", "expert", "partner", "funding"];

export function ConnectReportDocument({ result, projectLabel }: { result: ModelOutput; projectLabel: string }) {
  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    matches: result.matches.filter((m) => m.category === category),
  })).filter((g) => g.matches.length > 0);

  return (
    <ReportShell moduleTag="CONNECT" title="Rapport de matching écosystème" subtitle={projectLabel}>
      <SectionTitle>Gaps identifiés</SectionTitle>
      {result.gaps.map((g, i) => (
        <Card key={i}>
          <Text style={pdfStyles.h3}>{g.name}</Text>
          <Paragraph>{g.reason}</Paragraph>
        </Card>
      ))}

      <SectionTitle>Strategic brief</SectionTitle>
      <Paragraph>{result.strategicBrief}</Paragraph>

      <SectionTitle>Bonnes idées</SectionTitle>
      {result.goodIdeas.map((idea, i) => (
        <NumberedItem key={i} index={i}>
          {idea}
        </NumberedItem>
      ))}

      {byCategory.map(({ category, matches }) => (
        <View key={category}>
          <SectionTitle>{CATEGORY_LABELS[category]}</SectionTitle>
          {matches.map((m, i) => (
            <Card key={i}>
              <Text style={pdfStyles.h3}>{m.name}</Text>
              <Paragraph>{m.reason}</Paragraph>
              <Text style={pdfStyles.muted}>Gap adressé : {m.gapAddressed}</Text>
              {m.website && (
                <PdfLink src={m.website} style={{ ...pdfStyles.muted, color: PDF_COLORS.gold }}>
                  {m.website}
                </PdfLink>
              )}
            </Card>
          ))}
        </View>
      ))}
    </ReportShell>
  );
}

// ---------------------------------------------------------------------
// Learn
// ---------------------------------------------------------------------
export function LearnReportDocument({ training }: { training: Training }) {
  const domains = domainBadges(training.domains);
  return (
    <ReportShell
      moduleTag="LEARN"
      title={training.topic}
      subtitle={[...domains, training.duration_minutes ? `${training.duration_minutes} min` : null]
        .filter(Boolean)
        .join(" · ")}
    >
      <SectionTitle>Résumé exécutif</SectionTitle>
      <Text style={pdfStyles.h3}>Défi adressé</Text>
      <Paragraph>{training.executive_summary.addressedChallenge}</Paragraph>
      <Text style={pdfStyles.h3}>Résumé</Text>
      <Paragraph>{training.executive_summary.summary}</Paragraph>
      <Text style={pdfStyles.h3}>Plan d&apos;action</Text>
      {training.executive_summary.actionPlan.map((step, i) => (
        <NumberedItem key={i} index={i}>
          {step}
        </NumberedItem>
      ))}

      <SectionTitle>Points clés</SectionTitle>
      {training.key_insights.map((insight, i) => (
        <Card key={i}>
          <Paragraph>{insight.text}</Paragraph>
          {insight.source && <Text style={pdfStyles.muted}>Source : {insight.source}</Text>}
        </Card>
      ))}

      <SectionTitle>Implications business</SectionTitle>
      {training.business_implications.map((b, i) => (
        <Paragraph key={i}>• {b.text}</Paragraph>
      ))}

      <SectionTitle>Cartes interactives (flashcards)</SectionTitle>
      {training.flashcards.map((f, i) => (
        <Card key={i}>
          <Text style={pdfStyles.h3}>
            {i + 1}. {f.question}
          </Text>
          <Paragraph>{f.answer}</Paragraph>
        </Card>
      ))}

      <SectionTitle>Quiz de validation</SectionTitle>
      {training.comprehension_check.map((q, i) => {
        const letters = ["A", "B", "C", "D"];
        return (
          <Card key={i}>
            <Text style={pdfStyles.h3}>
              {i + 1}. {q.question}
            </Text>
            {q.options.map((o, oi) => {
              const isCorrect = o.id === q.correctOptionId;
              return (
                <Text
                  key={oi}
                  style={isCorrect ? { ...pdfStyles.p, fontFamily: "Helvetica-Bold", color: PDF_COLORS.success } : pdfStyles.p}
                >
                  {letters[oi] ?? oi + 1}. {o.text}
                  {isCorrect ? "  (bonne réponse)" : ""}
                </Text>
              );
            })}
            <Text style={pdfStyles.muted}>{q.explanation}</Text>
          </Card>
        );
      })}

      <View break>
        <SectionTitle>Script vidéo — {training.video_script.title}</SectionTitle>
        {training.video_script.scenes.map((scene) => (
          <Card key={scene.sceneNumber}>
            <Text style={pdfStyles.h3}>
              Scène {scene.sceneNumber} ({scene.durationSeconds}s)
            </Text>
            <Paragraph>{scene.narration}</Paragraph>
            <Text style={pdfStyles.muted}>Visuel : {scene.visualSuggestion}</Text>
          </Card>
        ))}

        <SectionTitle>Fiche Qualiopi</SectionTitle>
        <Text style={pdfStyles.muted}>
          Généré automatiquement — sert de preuve pour les critères Qualiopi C1 à C4 et C7.
        </Text>
        <Text style={pdfStyles.h3}>Public visé</Text>
        <Paragraph>{training.audience || "Non précisé"}</Paragraph>
        <Text style={pdfStyles.h3}>Prérequis</Text>
        <Paragraph>{training.prerequisites || "Aucun"}</Paragraph>
        <Text style={pdfStyles.h3}>Objectifs pédagogiques</Text>
        {training.objectives.map((o, i) => (
          <Text key={i} style={pdfStyles.p}>
            • {o}
          </Text>
        ))}
        <Text style={pdfStyles.h3}>Méthode & évaluation</Text>
        <Paragraph>
          Génération IA{training.source_doc_name ? ` à partir du document « ${training.source_doc_name} »` : ""}
          {training.mode === "diagnostic" ? ", à partir d'un diagnostic Decide existant" : ""}. Évaluation des acquis
          : quiz de {training.comprehension_check.length} question(s) ci-dessus.
        </Paragraph>
      </View>
    </ReportShell>
  );
}

// ---------------------------------------------------------------------
// Control Tower (consolidated, all modules / all projects)
// ---------------------------------------------------------------------
const MODULE_LABELS: Record<ModuleName, string> = {
  decide: "Decide",
  connect: "Connect",
  learn: "Learn",
  deliver: "Deliver",
};

function statusLabel(status: ModuleStatusValue): string {
  if (status === "done") return "Terminé";
  if (status === "in_progress") return "En cours";
  return "Non démarré";
}

export function ControlTowerReportDocument({ projects }: { projects: ControlTowerProject[] }) {
  return (
    <ReportShell
      moduleTag="TOUR DE CONTRÔLE"
      title="Vue d'ensemble — tous les projets"
      subtitle={`${projects.length} projet${projects.length > 1 ? "s" : ""}`}
    >
      {projects.map((p, i) => (
        <View key={p.transformationId} break={i > 0}>
          <SectionTitle>{p.title}</SectionTitle>
          <Text style={pdfStyles.muted}>
            {p.organizationName} · {p.progressPercent}% complété · Cible :{" "}
            {p.targetDate ? new Date(`${p.targetDate}T00:00:00Z`).toLocaleDateString("fr-FR") : "à définir"}
          </Text>
          <BadgeList items={domainBadges(p.domains)} />

          <Text style={pdfStyles.h3}>Statut des modules</Text>
          {(Object.keys(p.moduleStatus) as ModuleName[]).map((m) => (
            <Text key={m} style={pdfStyles.p}>
              {MODULE_LABELS[m]} — {statusLabel(p.moduleStatus[m])}
            </Text>
          ))}

          {p.keyMetrics.length > 0 && (
            <>
              <Text style={pdfStyles.h3}>Indicateurs clés validés</Text>
              {p.keyMetrics.map((m, mi) => (
                <Text key={mi} style={pdfStyles.p}>
                  {m.key} : {String(m.value)}
                </Text>
              ))}
            </>
          )}

          {p.risks.length > 0 && (
            <>
              <Text style={pdfStyles.h3}>Points chauds</Text>
              {p.risks.map((r) => (
                <Text key={r.id} style={{ ...pdfStyles.p, color: PDF_COLORS.danger }}>
                  {r.name}
                  {r.reason ? ` — ${r.reason}` : ""}
                </Text>
              ))}
            </>
          )}

          {p.opportunities.length > 0 && (
            <>
              <Text style={pdfStyles.h3}>Opportunités</Text>
              {p.opportunities.map((o) => (
                <Text key={o.id} style={{ ...pdfStyles.p, color: PDF_COLORS.success }}>
                  {o.name}
                  {o.reason ? ` — ${o.reason}` : ""}
                </Text>
              ))}
            </>
          )}
        </View>
      ))}
    </ReportShell>
  );
}
