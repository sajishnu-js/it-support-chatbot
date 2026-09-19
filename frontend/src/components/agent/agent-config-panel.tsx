"use client";

import { ChevronDown, Lock, RotateCcw, Shield, SlidersHorizontal, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { AGENT_LIMITS, DEFAULT_AGENT_CONFIG } from "@/lib/agent-defaults";
import { useAgentConfigStore } from "@/lib/store/agent-config-store";
import { cn } from "@/lib/utils";

/** Presets are starting points, not modes — each one just fills the two prompt
 * fields, which stay fully editable afterwards. */
const PRESETS = [
  {
    name: "Default triage",
    role: DEFAULT_AGENT_CONFIG.role,
    guardrails: DEFAULT_AGENT_CONFIG.guardrails,
  },
  {
    name: "Security-first",
    role: `You are the TechCore security triage agent. Treat every issue as a potential security incident until the Knowledge Base shows otherwise.

Search for the symptom, then for the relevant security policy and incident-response procedure.

Severity: P1 = active compromise, data exposure or credential theft; P2 = suspected compromise or a control that has failed; P3 = a policy question or routine hardening request; P4 = informational.`,
    guardrails: `- Ground every step in a retrieved passage. Never invent commands, URLs or policy values.
- Always state containment steps before remediation steps.
- If credentials may be exposed, the first step must be to disable or reset the affected account.
- Never repeat a password, token or key that appears in the issue description.
- Escalate to the Security team whenever compromise cannot be ruled out.`,
  },
  {
    name: "End-user friendly",
    role: `You are a friendly TechCore IT assistant writing for non-technical staff.

Search the Knowledge Base for the issue, then explain the fix in plain language. Avoid jargon; when a technical term is unavoidable, explain it in the same sentence.

Severity: P1 = nobody in the office can work; P2 = this person cannot work; P3 = a normal request; P4 = a question.`,
    guardrails: `- Only describe steps an ordinary user can perform themselves. Anything requiring admin rights belongs in escalation, not resolution_steps.
- Ground every step in a retrieved passage — never guess a menu path or URL.
- Keep each step to one action, written as a short sentence.
- Never ask the user to share their password with anyone, including IT.`,
  },
];

export function AgentConfigPanel({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const role = useAgentConfigStore((s) => s.role);
  const guardrails = useAgentConfigStore((s) => s.guardrails);
  const maxSearches = useAgentConfigStore((s) => s.maxSearches);
  const setRole = useAgentConfigStore((s) => s.setRole);
  const setGuardrails = useAgentConfigStore((s) => s.setGuardrails);
  const setMaxSearches = useAgentConfigStore((s) => s.setMaxSearches);
  const reset = useAgentConfigStore((s) => s.reset);

  const customised =
    role !== DEFAULT_AGENT_CONFIG.role ||
    guardrails !== DEFAULT_AGENT_CONFIG.guardrails ||
    maxSearches !== DEFAULT_AGENT_CONFIG.maxSearches;

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setRole(preset.role);
    setGuardrails(preset.guardrails);
    toast.success(`Applied the “${preset.name}” prompt`);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="glass-panel rounded-xl">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-3 text-left outline-none">
        <SlidersHorizontal className="size-4 text-primary" />
        <span className="text-sm font-semibold">Agent configuration</span>
        {customised && (
          <Badge variant="secondary" className="font-normal">
            Customised
          </Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {maxSearches} search{maxSearches === 1 ? "" : "es"} max
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-5 border-t border-border/60 px-4 py-4">
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="size-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Start from a preset
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.name}
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => applyPreset(preset)}
                  className="text-xs"
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </section>

          <section>
            <label htmlFor="agent-role" className="text-sm font-medium">
              Agent prompt
            </label>
            <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
              Who the agent is, how it should search, and how it should rate severity.
            </p>
            <Textarea
              id="agent-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={disabled}
              rows={8}
              maxLength={AGENT_LIMITS.roleMaxLength}
              className="resize-y font-mono text-xs leading-relaxed"
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">
              {role.length} / {AGENT_LIMITS.roleMaxLength}
            </p>
          </section>

          <section>
            <label htmlFor="agent-guardrails" className="flex items-center gap-1.5 text-sm font-medium">
              <Shield className="size-3.5" />
              Guardrails
            </label>
            <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
              Hard rules the agent must follow. These are sent as a separate, explicitly labelled
              section of the prompt.
            </p>
            <Textarea
              id="agent-guardrails"
              value={guardrails}
              onChange={(e) => setGuardrails(e.target.value)}
              disabled={disabled}
              rows={7}
              maxLength={AGENT_LIMITS.guardrailsMaxLength}
              className="resize-y font-mono text-xs leading-relaxed"
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">
              {guardrails.length} / {AGENT_LIMITS.guardrailsMaxLength}
            </p>
          </section>

          <section>
            <label htmlFor="agent-max-searches" className="text-sm font-medium">
              Search budget
            </label>
            <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
              After this many Knowledge Base searches the agent must submit its triage. Each step is
              a separate Gemini request, so a higher budget costs more of your daily quota.
            </p>
            <div className="flex items-center gap-4">
              <Slider
                id="agent-max-searches"
                value={maxSearches}
                onValueChange={(value) =>
                  setMaxSearches(Array.isArray(value) ? value[0] : (value as number))
                }
                min={AGENT_LIMITS.minSearches}
                max={AGENT_LIMITS.maxSearches}
                step={1}
                disabled={disabled}
                className="flex-1"
              />
              <span className="w-24 shrink-0 text-right text-sm tabular-nums">
                {maxSearches} search{maxSearches === 1 ? "" : "es"}
              </span>
            </div>
          </section>

          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              The tool protocol — search the Knowledge Base, then finish by calling{" "}
              <code className="rounded bg-muted px-1 py-0.5">submit_triage</code> — is appended
              automatically and cannot be edited. The loop only terminates on that call, so a prompt
              that removed it would leave the agent unable to finish.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled || !customised}
              onClick={() => {
                reset();
                toast.success("Agent configuration reset to defaults");
              }}
              className="gap-1.5 text-xs"
            >
              <RotateCcw className="size-3.5" />
              Reset to defaults
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
