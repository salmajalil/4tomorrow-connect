"use client";

import { Icon, type IconName } from "@/components/icons";
import { useState } from "react";
import { Eyebrow } from "@/components/eyebrow";
import { ExportPdfButton } from "@/components/export-pdf-button";
import { DOMAIN_LABELS, DOMAIN_ICONS, type Domain } from "@/lib/learn";
import { FlashcardDeck, QuizRunner } from "@/components/learn/interactive";
import { useLanguage } from "@/components/language-provider";
import { useTomorrowController } from "@/components/assistant/tomorrow-context";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Training } from "@/types/database";

type Tab = "apercu" | "points-cles" | "cartes" | "quiz" | "video" | "support" | "etapes" | "qualiopi";

function tabs(training: Dictionary["learn"]["training"], isWorkshop: boolean): { id: Tab; label: string }[] {
  if (isWorkshop) {
    return [
      { id: "apercu", label: training.tabOverview },
      { id: "support", label: training.tabSupport },
      { id: "etapes", label: training.tabSteps },
      { id: "qualiopi", label: training.tabQualiopi },
    ];
  }
  return [
    { id: "apercu", label: training.tabOverview },
    { id: "points-cles", label: training.tabKeyPoints },
    { id: "cartes", label: training.tabCards },
    { id: "quiz", label: training.tabQuiz },
    { id: "video", label: `${training.tabVideo} · ${training.optionBadge}` },
    { id: "qualiopi", label: training.tabQualiopi },
  ];
}

function MentoringButton({ topic, label }: { topic: string; label: string }) {
  const { requestMentoring } = useTomorrowController();
  return (
    <button
      type="button"
      onClick={() => requestMentoring(topic)}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-strong transition hover:bg-accent/20"
    >
      <Icon name="chat" className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function FormatTile({ icon, title, subtitle }: { icon: IconName; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-accent">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div>
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
    </div>
  );
}

export function TrainingView({ training }: { training: Training }) {
  const { t } = useLanguage();
  const tr = t.learn.training;
  const isWorkshop = training.mode === "workshop";
  const TABS = tabs(tr, isWorkshop);
  const [tab, setTab] = useState<Tab>("apercu");
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState(0);
  const [mastered, setMastered] = useState(0);
  const [showSummaryFull, setShowSummaryFull] = useState(false);
  const domains = training.domains as Domain[];
  const totalQuestions = training.comprehension_check.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Eyebrow>Learn</Eyebrow>
        <h1 className="font-display text-2xl text-ink">{training.topic}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {domains.map((d) => (
            <span key={d} className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-strong">
              <Icon name={DOMAIN_ICONS[d]} className="inline h-3.5 w-3.5 align-[-2px]" /> {DOMAIN_LABELS[d] ?? d}
            </span>
          ))}
          {training.duration_minutes && (
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted">
              <Icon name="clock" className="inline h-3.5 w-3.5 align-[-2px]" /> {training.duration_minutes} min
            </span>
          )}
        </div>
        {!isWorkshop && (
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <button type="button" onClick={() => setTab("cartes")} className="border border-border bg-surface p-3 text-left hover:border-accent">
              <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{tr.progressCards}</span>
              <span className="mt-1 block font-display text-3xl leading-none text-ink tabular-nums">
                {mastered}
                <span className="text-lg text-muted">/{training.flashcards.length}</span>
              </span>
            </button>
            <button type="button" onClick={() => setTab("quiz")} className="border border-border bg-surface p-3 text-left hover:border-accent">
              <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{tr.progressQuiz}</span>
              <span className="mt-1 block font-display text-3xl leading-none text-ink tabular-nums">
                {quizScore}
                <span className="text-lg text-muted">/{totalQuestions}</span>
              </span>
              {quizAnswered > 0 && quizAnswered < totalQuestions && (
                <span className="mt-1 block font-mono text-[10px] text-muted">
                  {quizAnswered}/{totalQuestions}
                </span>
              )}
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <ExportPdfButton
            kind="learn"
            payload={{ training }}
            filename={`4tomorrow-learn-${training.id}.pdf`}
          />
          <MentoringButton topic={training.topic} label={tr.liveMentoring} />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border pb-2">
        {TABS.map((tabDef) => (
          <button
            key={tabDef.id}
            type="button"
            onClick={() => setTab(tabDef.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              tab === tabDef.id ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"
            }`}
          >
            {tabDef.label}
          </button>
        ))}
      </div>

      {tab === "apercu" && isWorkshop && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{tr.workshopContext}</h2>
            <p className="mt-2 text-sm text-ink">{training.workshop_intro?.context}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{tr.workshopExpectedOutcome}</h2>
            <p className="mt-2 text-sm text-ink">{training.workshop_intro?.expectedOutcome}</p>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{tr.pedagogicalObjectives}</h2>
            <ol className="mt-2 flex flex-col gap-2">
              {training.objectives.map((o, i) => (
                <li key={i} className="flex gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-ink">
                    {i + 1}
                  </span>
                  <span className="text-ink">{o}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {tab === "apercu" && !isWorkshop && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{tr.addressedChallenge}</h2>
            <p className="mt-2 text-sm text-ink">{training.executive_summary.addressedChallenge}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{tr.summary}</h2>
            {(training.executive_summary.summaryHighlights ?? []).length > 0 ? (
              <>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {training.executive_summary.summaryHighlights.map((h, i) => (
                    <li key={i} className="flex items-baseline gap-2 text-sm text-ink">
                      <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      {h}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setShowSummaryFull((v) => !v)}
                  className="mt-2 text-xs font-medium text-muted underline underline-offset-2 hover:text-accent"
                >
                  {showSummaryFull ? tr.hideFullText : tr.readFullText}
                </button>
                {showSummaryFull && <p className="mt-2 text-sm text-ink">{training.executive_summary.summary}</p>}
              </>
            ) : (
              <p className="mt-2 text-sm text-ink">{training.executive_summary.summary}</p>
            )}
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{tr.actionPlan}</h2>
            <ol className="mt-2 flex flex-col gap-2">
              {training.executive_summary.actionPlan.map((step, i) => (
                <li key={i} className="flex gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-ink">
                    {i + 1}
                  </span>
                  <span className="text-ink">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {tab === "support" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted">{tr.workshopSupportSubtitle}</p>
          {(training.workshop_support ?? []).map((section, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-bold text-ink">{section.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{section.content}</p>
              <div className="mt-3">
                <MentoringButton topic={section.title} label={tr.liveMentoring} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "etapes" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted">{tr.workshopStepsSubtitle}</p>
          {(training.workshop_steps ?? [])
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((step, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-accent-strong">
                    {step.order}. {step.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {step.durationMinutes} {tr.workshopStepDuration}
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink">{step.description}</p>
                {step.materials.length > 0 && (
                  <p className="mt-2 text-xs text-muted">
                    {tr.workshopStepMaterials} {step.materials.join(", ")}
                  </p>
                )}
              </div>
            ))}
        </div>
      )}

      {tab === "points-cles" && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{tr.keyInsights}</h2>
            <div className="mt-2 flex flex-col gap-2">
              {training.key_insights.map((insight, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent text-xs font-semibold text-accent-strong">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1">
                    <p className="text-ink">{insight.text}</p>
                    {insight.source && <p className="mt-1 text-xs text-muted">{tr.source} {insight.source}</p>}
                    <div className="mt-2">
                      <MentoringButton topic={insight.text} label={tr.liveMentoring} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{tr.businessImplications}</h2>
            <div className="mt-2 flex flex-col gap-2">
              {training.business_implications.map((b, i) => (
                <div key={i} className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-ink">
                  {b.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "cartes" && (
        <div className="flex flex-col gap-4">
          <FormatTile icon="learn" title={tr.interactiveCards} subtitle={tr.interactiveCardsSubtitle} />
          <FlashcardDeck cards={training.flashcards} tr={tr} onProgress={setMastered} />
        </div>
      )}

      {tab === "quiz" && (
        <div className="flex flex-col gap-4">
          <FormatTile icon="checklist" title={tr.validationQuiz} subtitle={tr.qualiopiCheckmark} />
          <QuizRunner
            questions={training.comprehension_check}
            tr={tr}
            onScore={(score, answered) => {
              setQuizScore(score);
              setQuizAnswered(answered);
            }}
          />
        </div>
      )}

      {tab === "video" && (
        <div className="flex flex-col gap-4">
          <FormatTile icon="film" title={tr.videoScript} subtitle={tr.videoScriptSubtitle} />
          <p className="flex items-start gap-2 border border-dashed border-border-strong px-4 py-3 text-xs text-muted">
            <span className="shrink-0 border border-accent/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent-strong">
              {tr.optionBadge}
            </span>
            {tr.videoOptionHint}
          </p>
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
            <h2 className="font-display text-lg text-ink">{training.video_script.title}</h2>
          </div>
          <div className="flex flex-col gap-3">
            {training.video_script.scenes.map((scene) => (
              <div key={scene.sceneNumber} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-accent-strong">
                    {tr.scene} {scene.sceneNumber}
                  </span>
                  <span className="text-xs text-muted">{scene.durationSeconds}s</span>
                </div>
                <p className="mt-2 text-sm text-ink">{scene.narration}</p>
                <p className="mt-2 flex gap-1.5 text-xs text-muted"><Icon name="film" className="mt-0.5 h-3.5 w-3.5 shrink-0" />{scene.visualSuggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "qualiopi" && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted">{tr.qualiopiIntro}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{tr.targetAudience}</p>
              <p className="mt-1 text-sm text-ink">{training.audience || t.common.notSpecified}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{tr.duration}</p>
              <p className="mt-1 text-sm text-ink">{training.duration_minutes ?? "—"} min</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3 sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{tr.prerequisites}</p>
              <p className="mt-1 text-sm text-ink">{training.prerequisites}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{tr.pedagogicalObjectives}</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {training.objectives.map((o, i) => (
                <li key={i} className="rounded-lg border border-border bg-surface p-2.5 text-sm text-ink">
                  {o}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted">
            {tr.methodUsed}
            {training.source_doc_name ? ` ${tr.fromDocument} ${training.source_doc_name} »` : ""}
            {training.mode === "diagnostic" ? tr.fromDiagnostic : ""}.
            {!isWorkshop && (
              <>
                {" "}
                {tr.evaluationProof} {totalQuestions} {totalQuestions > 1 ? `${tr.question}s` : tr.question} {tr.questionsAbove}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
