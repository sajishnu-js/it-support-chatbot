"use client";

import { ArrowUpRight, ClipboardCheck, Copy, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { categoryMeta } from "@/lib/categories";
import type { AgentTriage, TriageSeverity } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<TriageSeverity, string> = {
  P1: "bg-destructive/15 text-destructive border-destructive/30",
  P2: "bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400",
  P3: "bg-sky-500/15 text-sky-600 border-sky-500/30 dark:text-sky-400",
  P4: "bg-muted text-muted-foreground border-border",
};

const SEVERITY_LABELS: Record<TriageSeverity, string> = {
  P1: "P1 · Critical",
  P2: "P2 · High",
  P3: "P3 · Normal",
  P4: "P4 · Low",
};

/** Formats the triage as plain text for pasting into a ticketing system. */
function asTicketText(triage: AgentTriage): string {
  const steps = triage.resolution_steps.map((step, i) => `${i + 1}. ${step}`).join("\n");
  return [
    `Severity: ${SEVERITY_LABELS[triage.severity]}`,
    `Category: ${categoryMeta(triage.category).label}`,
    "",
    `Summary:\n${triage.summary}`,
    "",
    `Resolution steps:\n${steps}`,
    "",
    `Escalation:\n${triage.escalation}`,
    "",
    `Sources: ${triage.cited_documents.join(", ") || "none"}`,
  ].join("\n");
}

export function TriageResult({ triage }: { triage: AgentTriage }) {
  const [copied, setCopied] = useState(false);
  const meta = categoryMeta(triage.category);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(asTicketText(triage));
      setCopied(true);
      toast.success("Triage copied as ticket text");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <div className="glass-panel rounded-xl p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn("border font-medium", SEVERITY_STYLES[triage.severity])}>
          {SEVERITY_LABELS[triage.severity]}
        </Badge>
        <Badge variant="secondary" className="gap-1 font-normal">
          <meta.icon className="size-3" />
          {meta.label}
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          className="ml-auto gap-1.5 text-xs"
        >
          {copied ? <ClipboardCheck className="size-3.5" /> : <Copy className="size-3.5" />}
          Copy as ticket
        </Button>
      </div>

      <p className="mt-4 text-sm leading-relaxed">{triage.summary}</p>

      {triage.severity_reason && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Severity rationale: {triage.severity_reason}
        </p>
      )}

      {triage.resolution_steps.length > 0 && (
        <section className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Resolution steps
          </h3>
          <ol className="mt-2 space-y-2">
            {triage.resolution_steps.map((step, index) => (
              <li key={index} className="flex gap-2.5 text-sm leading-relaxed">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-5">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ArrowUpRight className="size-3.5" />
          Escalation
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed">{triage.escalation}</p>
      </section>

      <section className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sources
        </h3>
        {triage.cited_documents.length === 0 ? (
          <p className="mt-1.5 text-sm text-muted-foreground">
            No Knowledge Base document supported this triage.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {triage.cited_documents.map((filename) => (
              <Badge key={filename} variant="secondary" className="gap-1 font-normal">
                <FileText className="size-3" />
                {filename}
              </Badge>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
