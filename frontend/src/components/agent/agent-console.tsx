"use client";

import { Bot, Send, Square } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AgentConfigPanel } from "@/components/agent/agent-config-panel";
import { AgentTrace } from "@/components/agent/agent-trace";
import { TriageResult } from "@/components/agent/triage-result";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { runAgentStream } from "@/lib/api";
import { useAgentConfigStore } from "@/lib/store/agent-config-store";
import type { AgentEvent, AgentTriage } from "@/lib/types";

const EXAMPLES = [
  "Three people in Finance can't reach the shared drive since this morning.",
  "A user clicked a link in a suspicious email and entered their password.",
  "New starter begins Monday and needs accounts, laptop and access.",
  "My laptop is running very slowly and fans are loud.",
];

export function AgentConsole() {
  const [issue, setIssue] = useState("");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [triage, setTriage] = useState<AgentTriage | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const role = useAgentConfigStore((s) => s.role);
  const guardrails = useAgentConfigStore((s) => s.guardrails);
  const maxSearches = useAgentConfigStore((s) => s.maxSearches);

  const start = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || running) return;

    setEvents([]);
    setTriage(null);
    setRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    await runAgentStream(trimmed, { role, guardrails, maxSearches }, {
      signal: controller.signal,
      onEvent: (event) => {
        if (event.type === "final") {
          setTriage(event.triage);
        } else {
          setEvents((prev) => [...prev, event]);
        }
      },
      onError: (message) => {
        setEvents((prev) => [...prev, { type: "error", message }]);
        toast.error(message);
      },
    });

    setRunning(false);
    abortRef.current = null;
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <AgentConfigPanel disabled={running} />

      <div className="glass-panel rounded-xl p-4">
        <label htmlFor="agent-issue" className="text-sm font-medium">
          Describe the issue
        </label>
        <Textarea
          id="agent-issue"
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void start(issue);
            }
          }}
          placeholder="e.g. Several users in Finance cannot connect to the VPN since the weekend maintenance."
          rows={3}
          className="mt-2 resize-none"
          disabled={running}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {running ? (
            <Button onClick={stop} variant="outline" className="gap-1.5">
              <Square className="size-3.5" />
              Stop
            </Button>
          ) : (
            <Button onClick={() => void start(issue)} disabled={!issue.trim()} className="gap-1.5">
              <Send className="size-3.5" />
              Run triage
            </Button>
          )}
          <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter</span>
        </div>
      </div>

      {events.length === 0 && !triage && !running && (
        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Try an example</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            The agent searches the Knowledge Base on its own — often several times — before it
            commits to a triage.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                onClick={() => {
                  setIssue(example);
                  void start(example);
                }}
                className="rounded-lg border border-border/60 bg-background/40 p-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {triage && <TriageResult triage={triage} />}

      <AgentTrace events={events} running={running} />
    </div>
  );
}
