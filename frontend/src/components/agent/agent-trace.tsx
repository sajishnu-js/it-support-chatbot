"use client";

import { Brain, CheckCircle2, ListTree, Search, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { categoryMeta } from "@/lib/categories";
import type { AgentEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const TOOL_ICONS: Record<string, typeof Search> = {
  search_knowledge_base: Search,
  list_knowledge_base: ListTree,
  submit_triage: CheckCircle2,
};

const TOOL_LABELS: Record<string, string> = {
  search_knowledge_base: "Searching Knowledge Base",
  list_knowledge_base: "Listing documents",
  submit_triage: "Submitting triage",
};

/** Renders the agent's investigation as it streams. Every row here is a real
 * model turn or tool execution — there are no placeholder or filler steps. */
export function AgentTrace({ events, running }: { events: AgentEvent[]; running: boolean }) {
  const steps = events.filter((event) => event.type !== "final");
  if (steps.length === 0 && !running) return null;

  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <Brain className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Investigation trace</h2>
        <span className="text-xs text-muted-foreground">
          {steps.length} step{steps.length === 1 ? "" : "s"}
        </span>
      </div>

      <ol className="relative space-y-3 border-l border-border/60 pl-5">
        {steps.map((event, index) => {
          if (event.type === "thinking") {
            return (
              <li key={index} className="relative">
                <Marker className="bg-primary/20 text-primary">
                  <Brain className="size-3" />
                </Marker>
                <p className="text-xs font-medium text-muted-foreground">Reasoning</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{event.text}</p>
              </li>
            );
          }

          if (event.type === "tool_call") {
            const Icon = TOOL_ICONS[event.name] ?? Search;
            return (
              <li key={index} className="relative">
                <Marker className="bg-sky-500/15 text-sky-500">
                  <Icon className="size-3" />
                </Marker>
                <p className="text-xs font-medium text-muted-foreground">
                  {TOOL_LABELS[event.name] ?? event.name}
                </p>
                <p className="mt-0.5 text-sm">
                  <span className="text-muted-foreground">&ldquo;</span>
                  {event.detail}
                  <span className="text-muted-foreground">&rdquo;</span>
                </p>
              </li>
            );
          }

          if (event.type === "tool_result") {
            return (
              <li key={index} className="relative">
                <Marker className="bg-emerald-500/15 text-emerald-500">
                  <CheckCircle2 className="size-3" />
                </Marker>
                <p className="text-xs font-medium text-muted-foreground">{event.summary}</p>
                {event.sources.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {event.sources.map((source) => {
                      const meta = categoryMeta(source.category);
                      return (
                        <Badge
                          key={`${source.filename}-${source.score}`}
                          variant="secondary"
                          className="gap-1 font-normal"
                        >
                          <meta.icon className="size-3" />
                          {source.filename}
                          <span className="text-muted-foreground">
                            {Math.round(source.score * 100)}%
                          </span>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          }

          return (
            <li key={index} className="relative">
              <Marker className="bg-destructive/15 text-destructive">
                <TriangleAlert className="size-3" />
              </Marker>
              <p className="text-sm text-destructive">{event.message}</p>
            </li>
          );
        })}

        {running && (
          <li className="relative">
            <Marker className="bg-primary/20 text-primary">
              <span className="size-1.5 animate-pulse rounded-full bg-current" />
            </Marker>
            <p className="text-sm text-muted-foreground">Working…</p>
          </li>
        )}
      </ol>
    </div>
  );
}

function Marker({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "absolute -left-[26px] flex size-5 items-center justify-center rounded-full ring-4 ring-background",
        className
      )}
    >
      {children}
    </span>
  );
}
