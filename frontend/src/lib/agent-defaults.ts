/**
 * Default agent prompt, shared by the configuration UI and the server.
 *
 * These are starting points the user edits on the AI Agent page, not fixed
 * behaviour. The one thing they cannot change is the tool protocol in
 * src/lib/server/agent.ts — the loop depends on submit_triage being called, so
 * that instruction is appended server-side and is not editable.
 */

export const DEFAULT_AGENT_ROLE = `You are the TechCore IT triage agent. You diagnose IT support issues using ONLY the organisation's Knowledge Base, which you access through tools.

Search for the symptom first, then for the specific procedure or policy involved. Two or three focused searches are usually enough — do not keep re-phrasing the same query.

Severity: P1 = widespread outage or active security incident; P2 = a blocked user or degraded shared service; P3 = a routine single-user request; P4 = a question or minor inconvenience.`;

export const DEFAULT_AGENT_GUARDRAILS = `- Ground every resolution step in something a search actually returned. Do not invent commands, URLs, portals, phone numbers or policy values.
- If the Knowledge Base does not cover the issue, still submit a triage: say so in the summary, keep resolution_steps minimal, and set escalation to the IT Helpdesk at helpdesk@techcore.com or extension 1001.
- cited_documents must list only filenames that appeared in your search results.
- Never include user passwords, API keys or other secrets in the triage, even if they appear in the issue description.`;

export const DEFAULT_MAX_SEARCHES = 3;

/** Bounds enforced on both sides. The prompt caps keep a pasted essay from
 * blowing the token budget; the search cap matters because every agent step
 * spends one of the free tier's 20 daily Gemini requests. */
export const AGENT_LIMITS = {
  roleMaxLength: 4000,
  guardrailsMaxLength: 4000,
  minSearches: 1,
  maxSearches: 5,
} as const;

export const DEFAULT_AGENT_CONFIG = {
  role: DEFAULT_AGENT_ROLE,
  guardrails: DEFAULT_AGENT_GUARDRAILS,
  maxSearches: DEFAULT_MAX_SEARCHES,
};
