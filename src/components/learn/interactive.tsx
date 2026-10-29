"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import type { Dictionary } from "@/lib/i18n/dictionary";

type Tr = Dictionary["learn"]["training"];

function Ring({ value, total, size = 96 }: { value: number; total: number; size?: number }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c - pct * c}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-2xl text-ink tabular-nums">
        {value}/{total}
      </span>
    </div>
  );
}

// One card at a time, flipped in 3D; the learner sorts each card into
// "I knew it" or "review again", and can replay only the cards to review.
export function FlashcardDeck({
  cards,
  tr,
  onProgress,
}: {
  cards: { question: string; answer: string; category?: string | null }[];
  tr: Tr;
  onProgress?: (mastered: number) => void;
}) {
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<number[]>([]);
  const [review, setReview] = useState<number[]>([]);

  if (cards.length === 0) return null;
  const done = pos >= order.length;
  const idx = order[pos];
  const card = done ? null : cards[idx];

  function sort(knewIt: boolean) {
    if (idx === undefined) return;
    if (knewIt) {
      const next = known.includes(idx) ? known : [...known, idx];
      setKnown(next);
      setReview((r) => r.filter((i) => i !== idx));
      onProgress?.(next.length);
    } else {
      setReview((r) => (r.includes(idx) ? r : [...r, idx]));
    }
    setFlipped(false);
    setPos((p) => p + 1);
  }

  function restart(only?: number[]) {
    setOrder(only && only.length ? only : cards.map((_, i) => i));
    setPos(0);
    setFlipped(false);
    if (!only) {
      setKnown([]);
      setReview([]);
      onProgress?.(0);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 bg-border">
          <div className="h-full bg-accent transition-all" style={{ width: `${(Math.min(pos, order.length) / order.length) * 100}%` }} />
        </div>
        <span className="font-mono text-[11px] tabular-nums text-muted">
          {Math.min(pos + 1, order.length)}/{order.length}
        </span>
        <span className="flex items-center gap-1 font-mono text-[11px] text-success">
          <Icon name="check" className="h-3 w-3" />
          {known.length}
        </span>
      </div>

      {card ? (
        <>
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="flip-scene block w-full text-left"
            aria-label={tr.flipHint}
          >
            <div className="flip-card relative min-h-[15rem] sm:min-h-[17rem]" data-flipped={flipped}>
              <div className="flip-face absolute inset-0 flex flex-col justify-between border border-border bg-surface p-6">
                <div>
                  {card.category && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent-strong">{card.category}</span>
                  )}
                  <p className="mt-3 text-balance font-display text-2xl leading-snug text-ink sm:text-3xl">{card.question}</p>
                </div>
                <span className="flex items-center gap-1.5 self-start text-xs text-muted">
                  <Icon name="learn" className="h-3.5 w-3.5" />
                  {tr.flipHint}
                </span>
              </div>
              <div className="flip-face flip-back absolute inset-0 flex flex-col justify-center border border-accent bg-surface-2 p-6">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent-strong">{tr.answerLabel}</span>
                <p className="mt-3 text-base leading-relaxed text-ink">{card.answer}</p>
              </div>
            </div>
          </button>
          <div className={`grid grid-cols-2 gap-2 transition ${flipped ? "opacity-100" : "pointer-events-none opacity-30"}`}>
            <button type="button" onClick={() => sort(false)} className="border border-border-strong px-4 py-3 text-sm text-ink hover:border-accent">
              {tr.reviewAgain}
            </button>
            <button type="button" onClick={() => sort(true)} className="bg-accent px-4 py-3 text-sm font-medium text-accent-ink hover:bg-accent-strong">
              {tr.knewIt}
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 border border-border bg-surface p-8 text-center">
          <Ring value={known.length} total={cards.length} />
          <p className="font-display text-2xl text-ink">{tr.deckDone}</p>
          <p className="text-sm text-muted">
            {known.length} {tr.mastered}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {review.length > 0 && (
              <button type="button" onClick={() => restart(review)} className="bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink">
                {tr.reviewOnly} ({review.length})
              </button>
            )}
            <button type="button" onClick={() => restart()} className="border border-border-strong px-4 py-2.5 text-sm text-ink">
              {tr.restart}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// One question at a time with instant feedback and the explanation, then a
// score screen — the proof of learning Qualiopi asks for, made engaging.
export function QuizRunner({
  questions,
  tr,
  onScore,
}: {
  questions: { question: string; options: { id: string; text: string }[]; correctOptionId: string; explanation: string }[];
  tr: Tr;
  onScore?: (score: number, answered: number) => void;
}) {
  const [pos, setPos] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const letters = ["A", "B", "C", "D", "E"];

  if (questions.length === 0) return null;
  const done = pos >= questions.length;
  const q = done ? null : questions[pos];

  function pick(id: string) {
    if (selected || !q) return;
    setSelected(id);
    const ok = id === q.correctOptionId;
    const next = ok ? score + 1 : score;
    if (ok) setScore(next);
    onScore?.(next, pos + 1);
  }

  function nextQuestion() {
    setSelected(null);
    setPos((p) => p + 1);
  }

  if (!q) {
    const ratio = score / questions.length;
    return (
      <div className="flex flex-col items-center gap-4 border border-border bg-surface p-8 text-center">
        <Ring value={score} total={questions.length} />
        <p className="font-display text-2xl text-ink">
          {ratio === 1 ? tr.quizPerfect : ratio >= 0.6 ? tr.quizGood : tr.quizRetryMsg}
        </p>
        <button
          type="button"
          onClick={() => {
            setPos(0);
            setScore(0);
            setSelected(null);
            onScore?.(0, 0);
          }}
          className="border border-border-strong px-4 py-2.5 text-sm text-ink"
        >
          {tr.restart}
        </button>
      </div>
    );
  }

  const correct = selected === q.correctOptionId;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        {questions.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 ${i < pos ? "bg-accent" : i === pos ? "bg-accent/50" : "bg-border"}`} />
        ))}
      </div>
      <div className="border border-border bg-surface p-5 sm:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          {tr.question} {pos + 1}/{questions.length}
        </p>
        <p className="mt-2 text-balance font-display text-2xl leading-snug text-ink">{q.question}</p>
        <div className="mt-5 flex flex-col gap-2">
          {q.options.map((opt, i) => {
            const isCorrect = opt.id === q.correctOptionId;
            const isSel = opt.id === selected;
            const state = !selected ? "idle" : isCorrect ? "right" : isSel ? "wrong" : "off";
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => pick(opt.id)}
                disabled={!!selected}
                className={`flex items-center gap-3 border px-4 py-3 text-left text-sm transition ${
                  state === "right"
                    ? "border-success bg-success/10 text-ink"
                    : state === "wrong"
                      ? "border-danger bg-danger/10 text-ink"
                      : state === "off"
                        ? "border-border text-muted"
                        : "border-border bg-surface-2 text-ink hover:border-accent"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-xs ${
                    state === "right" ? "border-success text-success" : state === "wrong" ? "border-danger text-danger" : "border-border-strong text-muted"
                  }`}
                >
                  {state === "right" ? <Icon name="check" className="h-3.5 w-3.5" /> : letters[i] ?? i + 1}
                </span>
                {opt.text}
              </button>
            );
          })}
        </div>
        {selected && (
          <div className={`mt-4 border-l-2 px-4 py-3 ${correct ? "border-success bg-success/5" : "border-danger bg-danger/5"}`}>
            <p className={`text-sm font-medium ${correct ? "text-success" : "text-danger"}`}>{correct ? tr.quizRight : tr.quizWrong}</p>
            <p className="mt-1 text-sm leading-relaxed text-body">{q.explanation}</p>
          </div>
        )}
      </div>
      {selected && (
        <button type="button" onClick={nextQuestion} className="self-end bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:bg-accent-strong">
          {pos + 1 === questions.length ? tr.seeResult : tr.nextQuestion}
        </button>
      )}
    </div>
  );
}
