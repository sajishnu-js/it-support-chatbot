"use client";

import { Compass, FileSearch, ListTree, Scale } from "lucide-react";

import { AiCore } from "@/components/chat/ai-core";

const SUGGESTIONS = [
  {
    icon: Compass,
    text: "How do I reset a user's Active Directory password?",
  },
  {
    icon: FileSearch,
    text: "What should I do if I suspect a phishing email?",
  },
  {
    icon: ListTree,
    text: "What is the escalation process for a P1 incident?",
  },
  {
    icon: Scale,
    text: "What is the company password policy?",
  },
];

export function EmptyState({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      <AiCore size="lg" className="mb-6" />
      <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
        Ask your Knowledge Base anything.
      </h1>
      <p className="mt-3 max-w-md text-pretty text-sm text-muted-foreground">
        Every answer is retrieved from TechCore&apos;s indexed documentation and grounded with
        citations — nothing is invented.
      </p>

      <div className="mt-8 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map(({ icon: Icon, text }) => (
          <button
            key={text}
            type="button"
            onClick={() => onSelect(text)}
            className="glass-panel group flex items-start gap-3 rounded-xl p-3.5 text-left text-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="text-foreground/90">{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
