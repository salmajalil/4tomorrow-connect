"use client";

import { useState } from "react";
import { Eyebrow } from "@/components/eyebrow";
import { ExportPdfButton } from "@/components/export-pdf-button";
import { DOMAIN_LABELS, type Domain } from "@/lib/learn";
import { useLanguage } from "@/components/language-provider";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Training } from "@/types/database";

type Tab = "apercu" | "points-cles" | "experience" | "video" | "qualiopi";

function tabs(training: Dictionary["learn"]["training"]): { id: Tab; label: string }[] {
  return [
    { id: "apercu", label: training.tabOverview },
    { id: "points-cles", label: training.tabKeyPoints },
    { id: "experience", label: training.tabExperience },
    { id: "video", label: training.tabVideo },
    { id: "qualiopi", label: training.tabQualiopi },
  ];
}

function Flashcard({
  question,
  answer,
  category,
  index,
  tapToReveal,
}: {
  question: string;
  answer: string;
  category?: string | null;
  index: number;
  tapToReveal: string;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setRevealed((v) => !v)}
      className={`flex min-h-[9rem] flex-col justify-between rounded-xl border p-4 text-left transition ${
        revealed ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/50"
      }`}
    >
      <div>
        {category && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-accent-strong">{category}</span>
        )}
        <p className="mt-1 text-sm font-medium text-ink">
          {index + 1}. {question}
        </p>
      </div>
      {revealed ? (
        <p className="mt-3 text-sm text-muted">{answer}</p>
      ) : (
        <span className="mt-3 self-start rounded-full border border-border px-3 py-1 text-xs font-semibold text-accent">
          {tapToReveal}
        </span>
      )}
    </button>
  );
}

function FormatTile({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-xl">
        {icon}
      </span>
      <div>
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function QualiopiBadge({ label }: { label: string }) {
  return (
    <div className="flex w-fit items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3.5 py-1.5 text-xs text-muted">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-ink">
        ✓
      </span>
      {label}
    </div>
  );
}

function QuizQuestion({
  question,
  options,
  correctOptionId,
  explanation,
  index,
  onAnswered,
}: {
  question: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
  index: number;
  onAnswered: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const letters = ["A", "B", "C", "D"];

  function pick(optionId: string) {
    if (selected) return;
    setSelected(optionId);
    onAnswered(optionId === correctOptionId);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-ink">
        {index + 1}. {question}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {options.map((opt, i) => {
          const isCorrect = opt.id === correctOptionId;
          const isSelected = opt.id === selected;
          const showState = !!selected;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => pick(opt.id)}
              disabled={!!selected}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition disabled:cursor-not-allowed ${
                showState && isCorrect
                  ? "border-success bg-success/10 text-ink"
                  : showState && isSelected && !isCorrect
                    ? "border-danger bg-danger/10 text-ink"
                    : "border-border bg-surface-2 text-ink hover:border-accent/50"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                  showState && isCorrect
                    ? "border-success text-success"
                    : showState && isSelected && !isCorrect
                      ? "border-danger text-danger"
                      : "border-border text-muted"
                }`}
              >
                {letters[i] ?? i + 1}
              </span>
              {opt.text}
              {showState && isCorrect && <span className="ml-auto text-success">✓</span>}
              {showState && isSelected && !isCorrect && <span className="ml-auto text-danger">✗</span>}
            </button>
          );
        })}
      </div>
      {selected && <p className="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-muted">{explanation}</p>}
    </div>
  );
}

export function TrainingView({ training }: { training: Training }) {
  const { t } = useLanguage();
  const tr = t.learn.training;
  const TABS = tabs(tr);
  const [tab, setTab] = useState<Tab>("apercu");
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState(0);
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
              {DOMAIN_LABELS[d] ?? d}
            </span>
          ))}
          {training.duration_minutes && (
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted">
              ⏱ {training.duration_minutes} min
            </span>
          )}
          {quizAnswered > 0 && (
            <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-strong">
              ⚡ {quizScore * 10} XP
            </span>
          )}
        </div>
        <div>
          <ExportPdfButton
            kind="learn"
            payload={{ training }}
            filename={`4tomorrow-learn-${training.id}.pdf`}
          />
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

      {tab === "apercu" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{tr.addressedChallenge}</h2>
            <p className="mt-2 text-sm text-ink">{training.executive_summary.addressedChallenge}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{tr.summary}</h2>
            <p className="mt-2 text-sm text-ink">{training.executive_summary.summary}</p>
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
                  <div>
                    <p className="text-ink">{insight.text}</p>
                    {insight.source && <p className="mt-1 text-xs text-muted">{tr.source} {insight.source}</p>}
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

      {tab === "experience" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <FormatTile icon="🃏" title={tr.interactiveCards} subtitle={tr.interactiveCardsSubtitle} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {training.flashcards.map((f, i) => (
                <Flashcard
                  key={i}
                  index={i}
                  question={f.question}
                  answer={f.answer}
                  category={f.category}
                  tapToReveal={tr.tapToReveal}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{tr.validationQuiz}</h2>
              {quizAnswered > 0 && (
                <span className="text-xs font-semibold text-accent-strong">
                  {quizScore}/{quizAnswered} {tr.correct}
                  {quizAnswered === totalQuestions ? ` ${tr.completed}` : ""}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {training.comprehension_check.map((q, i) => (
                <QuizQuestion
                  key={i}
                  index={i}
                  question={q.question}
                  options={q.options}
                  correctOptionId={q.correctOptionId}
                  explanation={q.explanation}
                  onAnswered={(correct) => {
                    setQuizAnswered((n) => n + 1);
                    if (correct) setQuizScore((n) => n + 1);
                  }}
                />
              ))}
            </div>
          </div>
          <QualiopiBadge label={tr.qualiopiCheckmark} />
        </div>
      )}

      {tab === "video" && (
        <div className="flex flex-col gap-4">
          <FormatTile icon="🎬" title={tr.videoScript} subtitle={tr.videoScriptSubtitle} />
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
                <p className="mt-2 text-xs text-muted">🎬 {scene.visualSuggestion}</p>
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
            {training.mode === "diagnostic" ? tr.fromDiagnostic : ""}. {tr.evaluationProof} {totalQuestions}{" "}
            {totalQuestions > 1 ? `${tr.question}s` : tr.question} {tr.questionsAbove}
          </div>
        </div>
      )}
    </div>
  );
}
