"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Lets any component (e.g. Learn's "Mentorat en direct" button) open the
// site-wide Tomorrow chat and hand it a starter topic, without the two
// components needing a direct reference to each other. TomorrowChat
// (mounted once in the layout) reads pendingTopic and auto-sends it as
// the first message.
type TomorrowController = {
  open: boolean;
  setOpen: (open: boolean) => void;
  pendingTopic: string | null;
  requestMentoring: (topic: string) => void;
  consumePendingTopic: () => string | null;
};

const TomorrowContext = createContext<TomorrowController | null>(null);

export function TomorrowProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pendingTopic, setPendingTopic] = useState<string | null>(null);

  function requestMentoring(topic: string) {
    setPendingTopic(topic);
    setOpen(true);
  }

  function consumePendingTopic() {
    const topic = pendingTopic;
    setPendingTopic(null);
    return topic;
  }

  return (
    <TomorrowContext.Provider value={{ open, setOpen, pendingTopic, requestMentoring, consumePendingTopic }}>
      {children}
    </TomorrowContext.Provider>
  );
}

export function useTomorrowController() {
  const ctx = useContext(TomorrowContext);
  if (!ctx) throw new Error("useTomorrowController must be used within TomorrowProvider");
  return ctx;
}
