"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { useTomorrowController } from "@/components/assistant/tomorrow-context";
import { SearchIcon } from "@/components/icons";
import type { ChatMessage } from "@/lib/assistant";

// Floating site-wide widget — always mounted (see src/app/layout.tsx), so it
// follows the user across every module. Only the current pathname is sent
// to the API for module context; no project data ever leaves the client.
export function TomorrowChat() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const { open, setOpen, pendingTopic, consumePendingTopic } = useTomorrowController();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages, pending]);

  async function sendMessage(text: string) {
    if (!text || pending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setPending(true);
    setError("");

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, pathname, webSearchEnabled: webSearch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.assistant.errorFallback);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.assistant.errorFallback);
    } finally {
      setPending(false);
    }
  }

  // A "Mentorat en direct" button elsewhere in the app (see Learn's
  // TrainingView) sets pendingTopic and opens the chat — pick it up here
  // and kick off the conversation as a real first user message.
  useEffect(() => {
    if (!open || !pendingTopic) return;
    const topic = consumePendingTopic();
    if (!topic) return;
    const timer = setTimeout(() => sendMessage(t.assistant.mentoringSeed.replace("{topic}", topic)), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingTopic]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end sm:bottom-6 sm:right-6">
      {open && (
        <div className="mb-3 flex h-[28rem] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">{t.assistant.title}</p>
              <p className="text-xs text-muted">{t.assistant.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.assistant.closeLabel}
              className="rounded-full p-1.5 text-muted transition hover:bg-surface hover:text-ink"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <ChatBubble role="assistant" content={t.assistant.greeting} />
            {messages.map((m, i) => (
              <ChatBubble key={i} role={m.role} content={m.content} />
            ))}
            {pending && (
              <p className="text-xs italic text-muted">{t.assistant.thinking}</p>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          <div className="border-t border-border bg-surface-2 px-3 pt-2.5">
            <button
              type="button"
              onClick={() => setWebSearch((v) => !v)}
              aria-pressed={webSearch}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                webSearch
                  ? "border-accent bg-accent/15 text-accent-strong"
                  : "border-border bg-surface text-muted hover:text-ink"
              }`}
            >
              <SearchIcon aria-hidden className="h-3.5 w-3.5" />
              {t.assistant.webSearchToggle}
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input.trim());
            }}
            className="flex items-center gap-2 bg-surface-2 p-3 pt-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.assistant.inputPlaceholder}
              maxLength={2000}
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t.assistant.send}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={t.assistant.openLabel}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-[0_0_30px_-6px_var(--accent)] transition hover:bg-accent-strong"
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
            <path
              d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

function ChatBubble({ role, content }: { role: ChatMessage["role"]; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
          isUser ? "bg-accent text-accent-ink" : "border border-border bg-surface-2 text-ink"
        }`}
      >
        {content}
      </p>
    </div>
  );
}
