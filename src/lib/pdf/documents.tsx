import { Text, View, Link as PdfLink } from "@react-pdf/renderer";
import { pdfStyles, PDF_COLORS, ReportShell, SectionTitle, Paragraph, Card, NumberedItem, BadgeList } from "@/lib/pdf/shared";
import { DOMAIN_LABELS, type Domain } from "@/lib/decide";
import type { DiagnosticResult } from "@/components/decide/diagnostic-view";
import type { ScenarioWithId } from "@/components/decide/scenario-card";
import type { ModelOutput, MatchOutput } from "@/lib/matching";
import type { Training } from "@/types/database";
import type { ControlTowerProject } from "@/lib/control-tower";
import { isHttpUrl } from "@/lib/url-safety";
import type { Language, ModuleName, ModuleStatusValue } from "@/types/database";
import { getDictionary } from "@/lib/i18n/dictionary";

// Libellés propres aux exports PDF qui n'existent pas déjà dans le
// dictionnaire principal (src/lib/i18n/dictionary.ts) — tout ce qui y
// existe déjà (titres de diagnostic, catégories Connecter, onglets Learn,
// statuts Tour de contrôle...) est lu de là, jamais dupliqué ici.
const PDF_LABELS = {
  fr: {
    decideTitle: "Diagnostic & scénarios stratégiques",
    gapsIdentified: "Gaps identifiés",
    scenario: "Scénario",
    maturity: "Maturité :",
    benefit: "Bénéfice :",
    scenarioRisksOpportunities: "Risques & opportunités du scénario",
    risk: "Risque :",
    opportunity: "Opportunité :",
    connectTitle: "Rapport de matching écosystème",
    workshopTag: "LEARN · ATELIER",
    contextAndOutcome: "Contexte & résultat attendu",
    objectives: "Objectifs",
    audienceAndPrerequisites: "Public & prérequis",
    notSpecified: "Non précisé",
    none: "Aucun",
    executiveSummary: "Résumé exécutif",
    correctAnswer: "(bonne réponse)",
    visual: "Visuel :",
    methodAndEvaluation: "Méthode & évaluation",
    methodAi: "Génération IA",
    fromDocument: " à partir du document « {name} »",
    evaluation: ". Évaluation des acquis : quiz de {n} question(s) ci-dessus.",
    controlTowerTag: "TOUR DE CONTRÔLE",
    controlTowerTitle: "Vue d'ensemble — tous les projets",
    projectCount: "{n} projet(s)",
    completed: "% complété",
    moduleStatus: "Statut des modules",
    validatedKeyMetrics: "Indicateurs clés validés",
  },
  en: {
    decideTitle: "Diagnostic & strategic scenarios",
    gapsIdentified: "Identified gaps",
    scenario: "Scenario",
    maturity: "Maturity:",
    benefit: "Benefit:",
    scenarioRisksOpportunities: "Scenario risks & opportunities",
    risk: "Risk:",
    opportunity: "Opportunity:",
    connectTitle: "Ecosystem matching report",
    workshopTag: "LEARN · WORKSHOP",
    contextAndOutcome: "Context & expected outcome",
    objectives: "Objectives",
    audienceAndPrerequisites: "Audience & prerequisites",
    notSpecified: "Not specified",
    none: "None",
    executiveSummary: "Executive summary",
    correctAnswer: "(correct answer)",
    visual: "Visual:",
    methodAndEvaluation: "Method & assessment",
    methodAi: "AI generation",
    fromDocument: " from the document \"{name}\"",
    evaluation: ". Learning assessment: {n}-question quiz above.",
    controlTowerTag: "CONTROL TOWER",
    controlTowerTitle: "Overview — all projects",
    projectCount: "{n} project(s)",
    completed: "% complete",
    moduleStatus: "Module status",
    validatedKeyMetrics: "Validated key indicators",
  },
} satisfies Record<Language, Record<string, string>>;

function domainBadges(domains: string[]): string[] {
  return domains.map((d) => DOMAIN_LABELS[d as Domain] ?? d);
}

// ---------------------------------------------------------------------
// Decide
// ---------------------------------------------------------------------
export function DecideReportDocument({
  diagnostic,
  scenarios,
  language,
}: {
  diagnostic: DiagnosticResult;
  scenarios: ScenarioWithId[];
  language: Language;
}) {
  const L = PDF_LABELS[language];
  const t = getDictionary(language).decide;
  return (
    <ReportShell
      moduleTag="DECIDE"
      title={L.decideTitle}
      subtitle={domainBadges(diagnostic.domains).join(" · ")}
      language={language}
    >
      <SectionTitle>{t.diagnostic.title}</SectionTitle>
      {diagnostic.maturityHighlights.map((h, i) => (
        <NumberedItem key={i} index={i}>
          {h}
        </NumberedItem>
      ))}
      <Paragraph>{diagnostic.maturityReading}</Paragraph>

      <SectionTitle>{L.gapsIdentified}</SectionTitle>
      {diagnostic.gaps.map((g, i) => (
        <Card key={i}>
          <Text style={pdfStyles.h3}>{g.name}</Text>
          <Paragraph>{g.reason}</Paragraph>
        </Card>
      ))}

      <SectionTitle>{t.diagnostic.rootCauses}</SectionTitle>
      {diagnostic.rootCauses.map((c, i) => (
        <Card key={i}>
          <Text style={pdfStyles.h3}>{c.name}</Text>
          <Paragraph>{c.reason}</Paragraph>
        </Card>
      ))}

      <SectionTitle>{t.diagnostic.priorities}</SectionTitle>
      {diagnostic.priorities.map((p, i) => (
        <Card key={i}>
          <Text style={pdfStyles.h3}>
            {p.name} — {p.weight}%
          </Text>
          <Paragraph>{p.reason}</Paragraph>
        </Card>
      ))}

      <SectionTitle>{t.diagnostic.risks}</SectionTitle>
      {diagnostic.risks.map((r, i) => (
        <Card key={i}>
          <Text style={pdfStyles.h3}>{r.name}</Text>
          <Paragraph>{r.reason}</Paragraph>
        </Card>
      ))}

      <SectionTitle>{t.diagnostic.decisionCriteria}</SectionTitle>
      <BadgeList items={diagnostic.decisionCriteria} />

      <SectionTitle>{t.diagnostic.startingRecommendation}</SectionTitle>
      <Paragraph>{diagnostic.startingRecommendation}</Paragraph>

      {scenarios.map((s, i) => (
        <View key={s.trajectoryId} break={i > 0}>
          <SectionTitle>
            {L.scenario} {i + 1} — {s.name}
          </SectionTitle>
          <Text style={pdfStyles.muted}>{s.stance}</Text>
          <Paragraph>{s.description}</Paragraph>

          <Text style={pdfStyles.h3}>{t.scenarios.executiveBriefing}</Text>
          {s.briefingHighlights.map((h, i) => (
            <NumberedItem key={i} index={i}>
              {h}
            </NumberedItem>
          ))}
          <Paragraph>{s.executiveBriefing}</Paragraph>

          {s.techStack.length > 0 && (
            <>
              <Text style={pdfStyles.h3}>{t.scenarios.stackSolutions}</Text>
              {s.techStack.map((tech, ti) => (
                <Card key={ti}>
                  <Text style={pdfStyles.h3}>{tech.name}</Text>
                  <Text style={pdfStyles.muted}>
                    {L.maturity} {tech.maturity}
                    {tech.maturityScale ? ` (${tech.maturityScale})` : ""}
                  </Text>
                  <Paragraph>{tech.detail}</Paragraph>
                  <Text style={pdfStyles.muted}>
                    {L.benefit} {tech.benefit}
                  </Text>
                </Card>
              ))}
            </>
          )}

          {s.suppliers.length > 0 && (
            <>
              <Text style={pdfStyles.h3}>{t.scenarios.tabSuppliers}</Text>
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
              <Text style={pdfStyles.h3}>{t.scenarios.applicableRegulations}</Text>
              {s.regulations.map((r, ri) => (
                <Paragraph key={ri}>
                  {r.name} — {r.description}
                </Paragraph>
              ))}
            </>
          )}

          <Text style={pdfStyles.h3}>{L.scenarioRisksOpportunities}</Text>
          {s.risksSpecific.map((r, ri) => (
            <Text key={ri} style={{ ...pdfStyles.p, color: PDF_COLORS.danger }}>
              {L.risk} {r.name} — {r.reason}
            </Text>
          ))}
          {s.opportunitiesSpecific.map((o, oi) => (
            <Text key={oi} style={{ ...pdfStyles.p, color: PDF_COLORS.success }}>
              {L.opportunity} {o.name} — {o.reason}
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
function categoryLabels(language: Language): Record<MatchOutput["category"], string> {
  const r = getDictionary(language).connect.results;
  return {
    technology: r.categoryTechnology,
    startup: r.categoryStartup,
    expert: r.categoryExpert,
    partner: r.categoryPartner,
    funding: r.categoryFunding,
    supplier: r.categorySupplier,
    support: r.categorySupport,
  };
}
const CATEGORY_ORDER: MatchOutput["category"][] = ["partner", "technology", "startup", "supplier", "funding", "support", "expert"];

export function ConnectReportDocument({
  result,
  projectLabel,
  language,
}: {
  result: ModelOutput;
  projectLabel: string;
  language: Language;
}) {
  const L = PDF_LABELS[language];
  const tr = getDictionary(language).connect.results;
  const CATEGORY_LABELS = categoryLabels(language);
  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    matches: result.matches.filter((m) => m.category === category),
  })).filter((g) => g.matches.length > 0);

  return (
    <ReportShell moduleTag="CONNECT" title={L.connectTitle} subtitle={projectLabel} language={language}>
      <SectionTitle>{L.gapsIdentified}</SectionTitle>
      {result.gaps.map((g, i) => (
        <Card key={i}>
          <Text style={pdfStyles.h3}>{g.name}</Text>
          <Paragraph>{g.reason}</Paragraph>
        </Card>
      ))}

      <SectionTitle>{tr.strategicBrief}</SectionTitle>
      <Paragraph>{result.strategicBrief}</Paragraph>

      <SectionTitle>{tr.goodIdeas}</SectionTitle>
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
              <Text style={pdfStyles.muted}>
                {tr.gapAddressed} {m.gapAddressed}
              </Text>
              {/* Clickable only for an explicit http(s) URL — never javascript:, file:, etc. */}
              {m.website &&
                (isHttpUrl(m.website) ? (
                  <PdfLink src={m.website} style={{ ...pdfStyles.muted, color: PDF_COLORS.gold }}>
                    {m.website}
                  </PdfLink>
                ) : (
                  <Text style={pdfStyles.muted}>{m.website}</Text>
                ))}
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
export function LearnReportDocument({ training, language }: { training: Training; language: Language }) {
  const L = PDF_LABELS[language];
  const tl = getDictionary(language).learn;
  const tt = tl.training;
  const domains = domainBadges(training.domains);
  if (training.mode === "workshop") {
    return (
      <ReportShell
        moduleTag={L.workshopTag}
        title={training.topic}
        subtitle={[...domains, training.duration_minutes ? `${training.duration_minutes} min` : null]
          .filter(Boolean)
          .join(" · ")}
        language={language}
      >
        <SectionTitle>{L.contextAndOutcome}</SectionTitle>
        <Text style={pdfStyles.h3}>{tt.workshopContext}</Text>
        <Paragraph>{training.workshop_intro?.context ?? ""}</Paragraph>
        <Text style={pdfStyles.h3}>{tt.workshopExpectedOutcome}</Text>
        <Paragraph>{training.workshop_intro?.expectedOutcome ?? ""}</Paragraph>
        <Text style={pdfStyles.h3}>{L.objectives}</Text>
        {training.objectives.map((o, i) => (
          <NumberedItem key={i} index={i}>
            {o}
          </NumberedItem>
        ))}

        <SectionTitle>{tt.tabSupport}</SectionTitle>
        {(training.workshop_support ?? []).map((section, i) => (
          <Card key={i}>
            <Text style={pdfStyles.h3}>{section.title}</Text>
            <Paragraph>{section.content}</Paragraph>
          </Card>
        ))}

        <View break>
          <SectionTitle>{tt.tabSteps}</SectionTitle>
          {(training.workshop_steps ?? [])
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((step, i) => (
              <Card key={i}>
                <Text style={pdfStyles.h3}>
                  {step.order}. {step.title} ({step.durationMinutes} {tt.workshopStepDuration})
                </Text>
                <Paragraph>{step.description}</Paragraph>
                {step.materials.length > 0 && (
                  <Text style={pdfStyles.muted}>
                    {tt.workshopStepMaterials} {step.materials.join(", ")}
                  </Text>
                )}
              </Card>
            ))}

          <SectionTitle>{L.audienceAndPrerequisites}</SectionTitle>
          <Text style={pdfStyles.h3}>{tl.intake.audienceWorkshop}</Text>
          <Paragraph>{training.audience || L.notSpecified}</Paragraph>
          <Text style={pdfStyles.h3}>{tt.prerequisites}</Text>
          <Paragraph>{training.prerequisites || L.none}</Paragraph>
        </View>
      </ReportShell>
    );
  }
  return (
    <ReportShell
      moduleTag="LEARN"
      title={training.topic}
      subtitle={[...domains, training.duration_minutes ? `${training.duration_minutes} min` : null]
        .filter(Boolean)
        .join(" · ")}
      language={language}
    >
      <SectionTitle>{L.executiveSummary}</SectionTitle>
      <Text style={pdfStyles.h3}>{tt.addressedChallenge}</Text>
      <Paragraph>{training.executive_summary.addressedChallenge}</Paragraph>
      <Text style={pdfStyles.h3}>{tt.summary}</Text>
      <Paragraph>{training.executive_summary.summary}</Paragraph>
      <Text style={pdfStyles.h3}>{tt.actionPlan}</Text>
      {training.executive_summary.actionPlan.map((step, i) => (
        <NumberedItem key={i} index={i}>
          {step}
        </NumberedItem>
      ))}

      <SectionTitle>{tt.tabKeyPoints}</SectionTitle>
      {training.key_insights.map((insight, i) => (
        <Card key={i}>
          <Paragraph>{insight.text}</Paragraph>
          {insight.source && (
            <Text style={pdfStyles.muted}>
              {tt.source} {insight.source}
            </Text>
          )}
        </Card>
      ))}

      <SectionTitle>{tt.businessImplications}</SectionTitle>
      {training.business_implications.map((b, i) => (
        <Paragraph key={i}>• {b.text}</Paragraph>
      ))}

      <SectionTitle>{tt.interactiveCards}</SectionTitle>
      {training.flashcards.map((f, i) => (
        <Card key={i}>
          <Text style={pdfStyles.h3}>
            {i + 1}. {f.question}
          </Text>
          <Paragraph>{f.answer}</Paragraph>
        </Card>
      ))}

      <SectionTitle>{tt.validationQuiz}</SectionTitle>
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
                  {isCorrect ? `  ${L.correctAnswer}` : ""}
                </Text>
              );
            })}
            <Text style={pdfStyles.muted}>{q.explanation}</Text>
          </Card>
        );
      })}

      <View break>
        <SectionTitle>
          {tt.videoScript} — {training.video_script.title}
        </SectionTitle>
        {training.video_script.scenes.map((scene) => (
          <Card key={scene.sceneNumber}>
            <Text style={pdfStyles.h3}>
              {tt.scene} {scene.sceneNumber} ({scene.durationSeconds}s)
            </Text>
            <Paragraph>{scene.narration}</Paragraph>
            <Text style={pdfStyles.muted}>
              {L.visual} {scene.visualSuggestion}
            </Text>
          </Card>
        ))}

        <SectionTitle>{tt.tabQualiopi}</SectionTitle>
        <Text style={pdfStyles.muted}>{tt.qualiopiIntro}</Text>
        <Text style={pdfStyles.h3}>{tt.targetAudience}</Text>
        <Paragraph>{training.audience || L.notSpecified}</Paragraph>
        <Text style={pdfStyles.h3}>{tt.prerequisites}</Text>
        <Paragraph>{training.prerequisites || L.none}</Paragraph>
        <Text style={pdfStyles.h3}>{tt.pedagogicalObjectives}</Text>
        {training.objectives.map((o, i) => (
          <Text key={i} style={pdfStyles.p}>
            • {o}
          </Text>
        ))}
        <Text style={pdfStyles.h3}>{L.methodAndEvaluation}</Text>
        <Paragraph>
          {L.methodAi}
          {training.source_doc_name ? L.fromDocument.replace("{name}", training.source_doc_name) : ""}
          {training.mode === "diagnostic" ? tt.fromDiagnostic : ""}
          {L.evaluation.replace("{n}", String(training.comprehension_check.length))}
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

function statusLabel(status: ModuleStatusValue, language: Language): string {
  const ct = getDictionary(language).controlTower;
  if (status === "done") return ct.statusDone;
  if (status === "in_progress") return ct.statusInProgress;
  return ct.statusNotStarted;
}

export function ControlTowerReportDocument({ projects, language }: { projects: ControlTowerProject[]; language: Language }) {
  const L = PDF_LABELS[language];
  const dict = getDictionary(language);
  const ct = dict.controlTower;
  return (
    <ReportShell
      moduleTag={L.controlTowerTag}
      title={L.controlTowerTitle}
      subtitle={L.projectCount.replace("{n}", String(projects.length))}
      language={language}
    >
      {projects.map((p, i) => (
        <View key={p.transformationId} break={i > 0}>
          <SectionTitle>{p.title}</SectionTitle>
          <Text style={pdfStyles.muted}>
            {p.organizationName} · {p.progressPercent}
            {L.completed} · {ct.target}{" "}
            {p.targetDate
              ? new Date(`${p.targetDate}T00:00:00Z`).toLocaleDateString(language === "en" ? "en-US" : "fr-FR")
              : ct.toBeDefined}
          </Text>
          <BadgeList items={domainBadges(p.domains)} />

          <Text style={pdfStyles.h3}>{L.moduleStatus}</Text>
          {(Object.keys(p.moduleStatus) as ModuleName[]).map((m) => (
            <Text key={m} style={pdfStyles.p}>
              {MODULE_LABELS[m]} — {statusLabel(p.moduleStatus[m], language)}
            </Text>
          ))}

          {p.keyMetrics.length > 0 && (
            <>
              <Text style={pdfStyles.h3}>{L.validatedKeyMetrics}</Text>
              {p.keyMetrics.map((m, mi) => (
                <Text key={mi} style={pdfStyles.p}>
                  {m.key} : {String(m.value)}
                </Text>
              ))}
            </>
          )}

          {p.risks.length > 0 && (
            <>
              <Text style={pdfStyles.h3}>{ct.hotPoints}</Text>
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
              <Text style={pdfStyles.h3}>{dict.impact.opportunitiesTitle}</Text>
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
