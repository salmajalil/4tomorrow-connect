import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ProjectImpact, ImpactIndicator } from "@/lib/project-impact";
import type { IndicatorConfidence, Language, ModuleName } from "@/types/database";

// Two reports built from the same ProjectImpact data:
//  - CeoReportDocument: one landscape page, dark brand ground, the verdict
//    and three figures — made to be projected or forwarded to a CEO.
//  - DetailedReportDocument: portrait, light paper, the full reasoning —
//    made to be printed and annotated.
// Built-in PDF fonts only (Times for display, Helvetica for text, Courier
// for labels): they need no font file at runtime, so nothing can fail to
// load on the server. Their character set is WinAnsi, so the fixed copy
// below avoids arrows and other symbols outside it.

const INK = "#0b0a08";
const PANEL = "#16130f";
const LINE = "#2a251f";
const CREAM = "#f3eee7";
const MUTED = "#a9a297";
const GOLD = "#c8955a";
const SAGE = "#9cc08a";
const PAPER = "#faf7f2";
const TEXT = "#1c1813";
const TEXT_MUTED = "#5e5850";
const RULE = "#d9d0c3";

const MODULE_COLOR: Record<ModuleName, string> = {
  decide: "#c8955a",
  connect: "#7fb8c4",
  learn: "#9cc08a",
  deliver: "#d9c3a5",
};

type Strings = {
  ceoTag: string;
  detailedTag: string;
  keyFigures: string;
  confidence: Record<IndicatorConfidence, string>;
  modules: Record<ModuleName, string>;
  moduleSub: Record<ModuleName, string>;
  status: Record<"not_started" | "in_progress" | "done", string>;
  decisions: string;
  noDecisions: string;
  hoursToRoadmap: string;
  hours: string;
  roadmapPending: string;
  footerNote: string;
  pendingHeadline: string;
  summary: string;
  need: string;
  challenges: string;
  objectives: string;
  constraints: string;
  scenarios: string;
  retained: string;
  indicators: string;
  indicator: string;
  value: string;
  confidenceCol: string;
  roadmap: string;
  phase: string;
  end: string;
  deliverables: string;
  partners: string;
  trainings: string;
  risks: string;
  opportunities: string;
  method: string;
  methodText: string;
  none: string;
  page: string;
};

const STRINGS: Record<Language, Strings> = {
  fr: {
    ceoTag: "SYNTHÈSE DIRIGEANT",
    detailedTag: "RAPPORT DÉTAILLÉ",
    keyFigures: "CHIFFRES CLÉS",
    confidence: { verified: "VÉRIFIÉ", estimate: "ESTIMATION", unknown: "À CONFIRMER" },
    modules: { decide: "Décider", connect: "Connecter", learn: "Former", deliver: "Livrer" },
    moduleSub: { decide: "TRAJECTOIRES", connect: "RÉSEAU", learn: "COMPÉTENCES", deliver: "EXÉCUTION" },
    status: { not_started: "À venir", in_progress: "En cours", done: "Fait" },
    decisions: "DÉCISIONS ET PROCHAINES ÉTAPES",
    noDecisions: "Aucune étape planifiée pour l'instant.",
    hoursToRoadmap: "DU BESOIN À LA FEUILLE DE ROUTE",
    hours: "h",
    roadmapPending: "Feuille de route à générer",
    footerNote: "CHAQUE CHIFFRE INDIQUE SON NIVEAU DE CONFIANCE",
    pendingHeadline: "L'impact chiffré arrive avec le diagnostic.",
    summary: "1. Synthèse",
    need: "2. Le besoin",
    challenges: "Enjeux",
    objectives: "Objectifs",
    constraints: "Contraintes",
    scenarios: "3. Scénarios comparés",
    retained: "retenu",
    indicators: "4. Indicateurs et niveau de confiance",
    indicator: "Indicateur",
    value: "Valeur",
    confidenceCol: "Confiance",
    roadmap: "5. Feuille de route",
    phase: "Phase",
    end: "Fin",
    deliverables: "Livrables",
    partners: "6. Partenaires proposés",
    trainings: "7. Formation des équipes",
    risks: "8. Points chauds",
    opportunities: "Opportunités",
    method: "Méthode",
    methodText:
      "Vérifié : chiffre confirmé par une source ou par vos données. Estimation : raisonnement professionnel sans source directe. À confirmer : donnée manquante, aucun chiffre n'est avancé.",
    none: "Aucun élément pour l'instant.",
    page: "Page",
  },
  en: {
    ceoTag: "EXECUTIVE SUMMARY",
    detailedTag: "DETAILED REPORT",
    keyFigures: "KEY FIGURES",
    confidence: { verified: "VERIFIED", estimate: "ESTIMATE", unknown: "TO CONFIRM" },
    modules: { decide: "Decide", connect: "Connect", learn: "Learn", deliver: "Deliver" },
    moduleSub: { decide: "TRAJECTORIES", connect: "NETWORK", learn: "SKILLS", deliver: "EXECUTION" },
    status: { not_started: "Upcoming", in_progress: "In progress", done: "Done" },
    decisions: "DECISIONS AND NEXT STEPS",
    noDecisions: "No step planned yet.",
    hoursToRoadmap: "FROM NEED TO ROADMAP",
    hours: "h",
    roadmapPending: "Roadmap not generated yet",
    footerNote: "EVERY FIGURE STATES ITS CONFIDENCE LEVEL",
    pendingHeadline: "The quantified impact arrives with the diagnostic.",
    summary: "1. Summary",
    need: "2. The need",
    challenges: "Challenges",
    objectives: "Objectives",
    constraints: "Constraints",
    scenarios: "3. Scenarios compared",
    retained: "chosen",
    indicators: "4. Indicators and confidence level",
    indicator: "Indicator",
    value: "Value",
    confidenceCol: "Confidence",
    roadmap: "5. Roadmap",
    phase: "Phase",
    end: "End",
    deliverables: "Deliverables",
    partners: "6. Partners suggested",
    trainings: "7. Team training",
    risks: "8. Hot spots",
    opportunities: "Opportunities",
    method: "Method",
    methodText:
      "Verified: figure confirmed by a source or your own data. Estimate: professional reasoning with no direct source. To confirm: missing data, no figure is put forward.",
    none: "Nothing yet.",
    page: "Page",
  },
};

const MODULES: ModuleName[] = ["decide", "connect", "learn", "deliver"];

function value(v: ImpactIndicator["value"]): string {
  return v === null || v === "" ? "—" : String(v);
}

function dateLabel(iso: string | null, language: Language, long = false): string {
  const d = iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : new Date();
  return d.toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
    day: long ? undefined : "numeric",
    month: long ? "long" : "short",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/* CEO one-pager                                                        */
/* ------------------------------------------------------------------ */

const ceo = StyleSheet.create({
  page: { backgroundColor: INK, color: CREAM, paddingTop: 36, paddingBottom: 30, paddingHorizontal: 44, fontFamily: "Helvetica" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontFamily: "Times-Roman", fontSize: 18, color: CREAM },
  tag: { fontFamily: "Courier", fontSize: 7.5, letterSpacing: 1.6, color: MUTED },
  eyebrow: { marginTop: 26, fontFamily: "Courier", fontSize: 7.5, letterSpacing: 1.8, color: MUTED },
  title: { marginTop: 8, fontFamily: "Times-Roman", fontSize: 36, lineHeight: 1.05, color: CREAM },
  titleAccent: { fontFamily: "Times-Italic", color: GOLD },
  figures: { marginTop: 22, flexDirection: "row", borderTopWidth: 1, borderTopColor: "#3a342c" },
  figure: { flex: 1, paddingTop: 14, paddingRight: 14 },
  figureLabel: { fontFamily: "Courier", fontSize: 7, letterSpacing: 1.2, color: MUTED },
  figureValue: { marginTop: 6, fontFamily: "Times-Roman", fontSize: 30, color: CREAM },
  badge: { marginTop: 6, alignSelf: "flex-start", fontFamily: "Courier", fontSize: 6.5, letterSpacing: 0.8, paddingHorizontal: 4, paddingVertical: 2 },
  bottom: { marginTop: 22, flexDirection: "row" },
  modulesCol: { flex: 1.25, paddingRight: 22 },
  label: { fontFamily: "Courier", fontSize: 7, letterSpacing: 1.4, color: MUTED },
  moduleRow: { marginTop: 10, flexDirection: "row" },
  module: { flex: 1, marginRight: 6 },
  moduleBar: { height: 3, backgroundColor: LINE },
  moduleName: { marginTop: 7, fontFamily: "Times-Roman", fontSize: 15, color: CREAM },
  moduleStatus: { marginTop: 2, fontSize: 8, color: MUTED },
  decisions: { flex: 1, backgroundColor: PANEL, borderWidth: 1, borderColor: LINE, padding: 14 },
  decisionRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE, paddingVertical: 6 },
  decisionNum: { width: 14, fontFamily: "Courier", fontSize: 9, color: GOLD },
  decisionText: { flex: 1, fontSize: 9, lineHeight: 1.35, color: CREAM },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 8,
    fontFamily: "Courier",
    fontSize: 6.5,
    letterSpacing: 1.2,
    color: "#8d867c",
  },
});

function CeoBadge({ confidence, s }: { confidence: IndicatorConfidence; s: Strings }) {
  const style =
    confidence === "verified"
      ? { backgroundColor: SAGE, color: INK }
      : confidence === "estimate"
        ? { borderWidth: 1, borderColor: GOLD, color: GOLD }
        : { borderWidth: 1, borderColor: MUTED, color: MUTED };
  return <Text style={{ ...ceo.badge, ...style }}>{s.confidence[confidence]}</Text>;
}

export function CeoReportDocument({ project, language }: { project: ProjectImpact; language: Language }) {
  const s = STRINGS[language];
  const figures = project.keyIndicators.slice(0, 2);
  const steps = project.phases.filter((p) => p.status !== "done").slice(0, 3);

  return (
    <Document title={`4 Tomorrow — ${s.ceoTag}`}>
      <Page size="A4" orientation="landscape" style={ceo.page}>
        <View style={ceo.topRow}>
          <Text style={ceo.brand}>4 Tomorrow</Text>
          <Text style={ceo.tag}>
            {s.ceoTag} · {dateLabel(null, language, true).toUpperCase()}
          </Text>
        </View>

        <Text style={ceo.eyebrow}>{(project.organizationName || project.industry || "").toUpperCase()}</Text>
        {project.headline ? (
          <Text style={ceo.title}>
            {project.headline.label} : <Text style={ceo.titleAccent}>{value(project.headline.value)}</Text>
          </Text>
        ) : (
          <Text style={ceo.title}>{s.pendingHeadline}</Text>
        )}

        <View style={ceo.figures}>
          {figures.map((f, i) => (
            <View key={f.label} style={{ ...ceo.figure, ...(i > 0 ? { borderLeftWidth: 1, borderLeftColor: LINE, paddingLeft: 14 } : {}) }}>
              <Text style={ceo.figureLabel}>{f.label.toUpperCase()}</Text>
              <Text style={ceo.figureValue}>{value(f.value)}</Text>
              <CeoBadge confidence={f.confidence} s={s} />
            </View>
          ))}
          <View style={{ ...ceo.figure, borderLeftWidth: 1, borderLeftColor: LINE, paddingLeft: 14 }}>
            <Text style={ceo.figureLabel}>{s.hoursToRoadmap}</Text>
            <Text style={ceo.figureValue}>
              {project.hoursToRoadmap !== null ? `${project.hoursToRoadmap} ${s.hours}` : "—"}
            </Text>
            {project.hoursToRoadmap === null && <Text style={{ ...ceo.moduleStatus, marginTop: 6 }}>{s.roadmapPending}</Text>}
          </View>
        </View>

        <View style={ceo.bottom}>
          <View style={ceo.modulesCol}>
            <Text style={ceo.label}>4 TOMORROW · {MODULES.map((m) => s.modules[m].toUpperCase()).join(" · ")}</Text>
            <View style={ceo.moduleRow}>
              {project.modules.map((m) => {
                const fill = m.status === "done" ? "100%" : m.status === "in_progress" ? "50%" : "0%";
                return (
                  <View key={m.module} style={ceo.module}>
                    <View style={ceo.moduleBar}>
                      <View style={{ height: 3, width: fill, backgroundColor: MODULE_COLOR[m.module] }} />
                    </View>
                    <Text style={ceo.moduleName}>{s.modules[m.module]}</Text>
                    <Text style={ceo.moduleStatus}>
                      {s.moduleSub[m.module]} · {s.status[m.status]}
                    </Text>
                  </View>
                );
              })}
            </View>
            {project.trajectory && (
              <Text style={{ marginTop: 16, fontSize: 9.5, lineHeight: 1.4, color: "#cfc8bd" }}>
                {project.trajectory.name}
                {project.trajectory.description ? ` — ${project.trajectory.description.slice(0, 220)}` : ""}
              </Text>
            )}
          </View>
          <View style={ceo.decisions}>
            <Text style={{ ...ceo.label, color: GOLD }}>{s.decisions}</Text>
            <View style={{ marginTop: 8 }}>
              {steps.length === 0 ? (
                <Text style={{ ...ceo.decisionText, paddingTop: 6 }}>{s.noDecisions}</Text>
              ) : (
                steps.map((p, i) => (
                  <View key={`${p.name}-${i}`} style={ceo.decisionRow}>
                    <Text style={ceo.decisionNum}>{i + 1}</Text>
                    <Text style={ceo.decisionText}>
                      {p.name} · {dateLabel(p.endDate, language)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>

        <View style={ceo.footer} fixed>
          <Text>{s.footerNote}</Text>
          <Text>4TOMORROW-STRATEGY.COM</Text>
        </View>
      </Page>
    </Document>
  );
}

/* ------------------------------------------------------------------ */
/* Detailed report                                                      */
/* ------------------------------------------------------------------ */

const det = StyleSheet.create({
  page: { backgroundColor: PAPER, color: TEXT, paddingTop: 48, paddingBottom: 54, paddingHorizontal: 54, fontFamily: "Helvetica", fontSize: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottomWidth: 1.5, borderBottomColor: TEXT },
  brand: { fontFamily: "Times-Roman", fontSize: 15 },
  tag: { fontFamily: "Courier", fontSize: 7.5, letterSpacing: 1.4, color: TEXT_MUTED },
  title: { marginTop: 24, fontFamily: "Times-Roman", fontSize: 26, lineHeight: 1.1 },
  meta: { marginTop: 6, fontFamily: "Courier", fontSize: 7.5, letterSpacing: 1.2, color: TEXT_MUTED },
  h2: { marginTop: 22, marginBottom: 6, fontFamily: "Times-Roman", fontSize: 17 },
  h3: { marginTop: 8, marginBottom: 2, fontFamily: "Helvetica-Bold", fontSize: 10 },
  p: { fontSize: 10, lineHeight: 1.55, color: TEXT, marginBottom: 3 },
  muted: { fontSize: 9, color: TEXT_MUTED, lineHeight: 1.45 },
  table: { marginTop: 6 },
  th: { flexDirection: "row", borderBottomWidth: 1.2, borderBottomColor: TEXT, paddingVertical: 5 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: RULE, paddingVertical: 5 },
  thText: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  td: { fontSize: 9.5, lineHeight: 1.4 },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 54,
    right: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Courier",
    fontSize: 7,
    color: TEXT_MUTED,
  },
});

function H2({ children }: { children: string }) {
  return (
    <Text style={det.h2} minPresenceAhead={60}>
      {children}
    </Text>
  );
}

export function DetailedReportDocument({ project, language }: { project: ProjectImpact; language: Language }) {
  const s = STRINGS[language];

  return (
    <Document title={`4 Tomorrow — ${s.detailedTag}`}>
      <Page size="A4" style={det.page} wrap>
        <View style={det.header} fixed>
          <Text style={det.brand}>4 Tomorrow</Text>
          <Text style={det.tag}>
            {s.detailedTag} · {dateLabel(null, language, true).toUpperCase()}
          </Text>
        </View>

        <Text style={det.title}>{project.title}</Text>
        <Text style={det.meta}>
          {[project.organizationName, project.industry].filter(Boolean).join(" · ").toUpperCase()}
        </Text>

        <H2>{s.summary}</H2>
        {project.headline ? (
          <Text style={det.p}>
            {project.headline.label} : {value(project.headline.value)} ({s.confidence[project.headline.confidence].toLowerCase()}).
          </Text>
        ) : (
          <Text style={det.p}>{s.pendingHeadline}</Text>
        )}
        {(project.trajectory?.executiveBriefing || project.strategicBrief) && (
          <Text style={det.p}>{project.trajectory?.executiveBriefing || project.strategicBrief}</Text>
        )}

        <H2>{s.need}</H2>
        {project.challenges && (
          <>
            <Text style={det.h3}>{s.challenges}</Text>
            <Text style={det.p}>{project.challenges}</Text>
          </>
        )}
        {project.objectives && (
          <>
            <Text style={det.h3}>{s.objectives}</Text>
            <Text style={det.p}>{project.objectives}</Text>
          </>
        )}
        {project.constraints && (
          <>
            <Text style={det.h3}>{s.constraints}</Text>
            <Text style={det.p}>{project.constraints}</Text>
          </>
        )}

        <H2>{s.scenarios}</H2>
        {project.scenarios.length === 0 ? (
          <Text style={det.muted}>{s.none}</Text>
        ) : (
          project.scenarios.map((sc) => (
            <View key={sc.name} style={det.tr} wrap={false}>
              <Text style={{ ...det.td, flex: 1, fontFamily: sc.selected ? "Helvetica-Bold" : "Helvetica" }}>
                {sc.name}
                {sc.selected ? ` (${s.retained})` : ""}
              </Text>
              <Text style={{ ...det.td, flex: 1.6, color: TEXT_MUTED }}>{sc.stance ?? ""}</Text>
            </View>
          ))
        )}

        <H2>{s.indicators}</H2>
        {project.indicators.length === 0 ? (
          <Text style={det.muted}>{s.none}</Text>
        ) : (
          <View style={det.table}>
            <View style={det.th}>
              <Text style={{ ...det.thText, flex: 2 }}>{s.indicator}</Text>
              <Text style={{ ...det.thText, flex: 1, textAlign: "right" }}>{s.value}</Text>
              <Text style={{ ...det.thText, flex: 1, paddingLeft: 12 }}>{s.confidenceCol}</Text>
            </View>
            {project.indicators.map((i) => (
              <View key={i.label} style={det.tr} wrap={false}>
                <Text style={{ ...det.td, flex: 2 }}>{i.label}</Text>
                <Text style={{ ...det.td, flex: 1, textAlign: "right" }}>{value(i.value)}</Text>
                <Text style={{ ...det.td, flex: 1, paddingLeft: 12, color: TEXT_MUTED }}>{s.confidence[i.confidence]}</Text>
              </View>
            ))}
          </View>
        )}

        <H2>{s.roadmap}</H2>
        {project.phases.length === 0 ? (
          <Text style={det.muted}>{s.none}</Text>
        ) : (
          <View style={det.table}>
            <View style={det.th}>
              <Text style={{ ...det.thText, flex: 1.3 }}>{s.phase}</Text>
              <Text style={{ ...det.thText, flex: 2 }}>{s.deliverables}</Text>
              <Text style={{ ...det.thText, flex: 0.7, textAlign: "right" }}>{s.end}</Text>
            </View>
            {project.phases.map((p, i) => (
              <View key={`${p.name}-${i}`} style={det.tr} wrap={false}>
                <Text style={{ ...det.td, flex: 1.3, paddingRight: 8 }}>
                  {p.name}
                  {"\n"}
                  <Text style={{ color: TEXT_MUTED, fontSize: 8 }}>{s.status[p.status === "upcoming" ? "not_started" : p.status]}</Text>
                </Text>
                <Text style={{ ...det.td, flex: 2, paddingRight: 8 }}>{p.deliverables.slice(0, 4).join(" · ")}</Text>
                <Text style={{ ...det.td, flex: 0.7, textAlign: "right" }}>{dateLabel(p.endDate, language)}</Text>
              </View>
            ))}
          </View>
        )}

        <H2>{s.partners}</H2>
        {project.matches.length === 0 ? (
          <Text style={det.muted}>{s.none}</Text>
        ) : (
          project.matches.slice(0, 12).map((m, i) => (
            <View key={`${m.name}-${i}`} style={det.tr} wrap={false}>
              <Text style={{ ...det.td, flex: 1.2, fontFamily: "Helvetica-Bold" }}>{m.name}</Text>
              <Text style={{ ...det.td, flex: 0.8, color: TEXT_MUTED }}>{m.category}</Text>
              <Text style={{ ...det.td, flex: 2 }}>{m.reason ?? ""}</Text>
            </View>
          ))
        )}

        <H2>{s.trainings}</H2>
        {project.trainings.length === 0 ? (
          <Text style={det.muted}>{s.none}</Text>
        ) : (
          project.trainings.map((tr, i) => (
            <Text key={`${tr.topic}-${i}`} style={det.p}>
              {tr.topic}
            </Text>
          ))
        )}

        <H2>{s.risks}</H2>
        {project.risks.length === 0 ? (
          <Text style={det.muted}>{s.none}</Text>
        ) : (
          project.risks.map((r, i) => (
            <Text key={`${r.name}-${i}`} style={det.p}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{r.name}</Text>
              {r.reason ? ` — ${r.reason}` : ""}
            </Text>
          ))
        )}
        {project.opportunities.length > 0 && (
          <>
            <Text style={det.h3}>{s.opportunities}</Text>
            {project.opportunities.map((o, i) => (
              <Text key={`${o.name}-${i}`} style={det.p}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{o.name}</Text>
                {o.reason ? ` — ${o.reason}` : ""}
              </Text>
            ))}
          </>
        )}

        <H2>{s.method}</H2>
        <Text style={det.p}>{s.methodText}</Text>

        <View style={det.footer} fixed>
          <Text>4 TOMORROW STRATEGY</Text>
          <Text render={({ pageNumber, totalPages }) => `${s.page} ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
