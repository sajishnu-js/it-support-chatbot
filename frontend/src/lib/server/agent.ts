/**
 * Autonomous IT triage agent.
 *
 * Distinct from the RAG chat, which is a single retrieve-then-answer pass. Here
 * Gemini drives a real tool-calling loop: it decides what to look up, issues
 * searches against the Knowledge Base, reads what comes back, and searches
 * again if the picture is incomplete — then submits a structured triage.
 *
 * Every step the UI renders comes from an actual model turn or tool execution,
 * so the trace reflects what genuinely happened rather than a scripted
 * animation. The final triage is produced by a tool call rather than parsed out
 * of prose, which keeps the shape guaranteed instead of best-effort.
 */

import {
  AGENT_LIMITS,
  DEFAULT_AGENT_GUARDRAILS,
  DEFAULT_AGENT_ROLE,
  DEFAULT_MAX_SEARCHES,
} from "@/lib/agent-defaults";
import { generateContent, getDocuments, retrieve } from "@/lib/server/rag";
import type { GeminiPart } from "@/lib/server/rag";
import type { AgentConfig, AgentEvent, AgentTriage, TriageSeverity } from "@/lib/types";

/** Once the configured search budget is spent the model is *required* to call
 * submit_triage. Left to itself it will keep refining queries indefinitely —
 * observed running six searches on one issue without concluding — which wastes
 * quota and eventually times out. Forcing the call yields a triage from the
 * evidence already gathered instead of an apology about hitting a limit.
 * The step cap leaves room for the forced turn plus a retry. */
const stepBudget = (maxSearches: number) => maxSearches + 3;
const SEARCH_TOP_K = 4;
const SNIPPET_LENGTH = 320;

const SEVERITIES: TriageSeverity[] = ["P1", "P2", "P3", "P4"];

/** The one part of the prompt the user cannot edit. The loop terminates only
 * when submit_triage is called, so if this were editable a user could write a
 * prompt that makes the agent structurally unable to finish. Everything about
 * *how* to triage stays configurable; only the protocol is fixed. */
const TOOL_PROTOCOL = `
How to work:
1. Call search_knowledge_base to find material about the issue.
2. Call list_knowledge_base if you need to know what documentation exists.
3. When you have enough evidence, call submit_triage exactly once. Never answer
   in plain prose — the triage tool is the only way to finish.
`.trim();

/** Builds the system instruction from the user's configuration.
 *
 * The document inventory is injected rather than left to a tool call: every
 * model turn costs a request against a free-tier budget of 20 per day, and the
 * agent reliably spent one just asking what documents exist — static
 * information that is cheap to hand over upfront.
 */
export function systemInstruction(config: ResolvedConfig): string {
  const inventory = getDocuments()
    .map((doc) => `- ${doc.filename} (${doc.category}, ${doc.chunk_count} chunks)`)
    .join("\n");

  return [
    config.role,
    TOOL_PROTOCOL,
    `Guardrails you must follow:\n${config.guardrails}`,
    `Documents currently indexed:\n${inventory}`,
  ].join("\n\n");
}

export interface ResolvedConfig {
  role: string;
  guardrails: string;
  maxSearches: number;
}

/** Trusts nothing from the client: the config arrives over HTTP, so lengths are
 * capped to protect the token budget and the search count is clamped because
 * each search costs a scarce daily request. Blank fields fall back to the
 * defaults rather than producing an agent with no instructions at all. */
export function resolveConfig(raw: unknown): ResolvedConfig {
  const input = (raw ?? {}) as Partial<AgentConfig>;

  const text = (value: unknown, fallback: string, cap: number) => {
    const trimmed = typeof value === "string" ? value.trim() : "";
    return (trimmed || fallback).slice(0, cap);
  };

  const requested = Number(input.maxSearches);
  const maxSearches = Number.isFinite(requested)
    ? Math.min(AGENT_LIMITS.maxSearches, Math.max(AGENT_LIMITS.minSearches, Math.round(requested)))
    : DEFAULT_MAX_SEARCHES;

  return {
    role: text(input.role, DEFAULT_AGENT_ROLE, AGENT_LIMITS.roleMaxLength),
    guardrails: text(input.guardrails, DEFAULT_AGENT_GUARDRAILS, AGENT_LIMITS.guardrailsMaxLength),
    maxSearches,
  };
}

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "search_knowledge_base",
        description:
          "Semantic search over the IT Knowledge Base. Returns the most relevant passages with their source filename and relevance score.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: {
              type: "STRING",
              description: "What to look for, phrased as a focused question or topic.",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "list_knowledge_base",
        description:
          "List every indexed document with its category and chunk count. Use to discover what documentation exists.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "submit_triage",
        description:
          "Submit the final structured triage. Call exactly once, when the investigation is complete.",
        parameters: {
          type: "OBJECT",
          properties: {
            summary: {
              type: "STRING",
              description: "One or two sentences stating what the issue actually is.",
            },
            severity: { type: "STRING", enum: SEVERITIES },
            severity_reason: {
              type: "STRING",
              description: "Why this severity, in one sentence.",
            },
            category: {
              type: "STRING",
              description:
                "One of: network, security, microsoft365, hardware, software, accounts, infrastructure, helpdesk.",
            },
            resolution_steps: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Ordered, concrete steps a technician should take.",
            },
            escalation: {
              type: "STRING",
              description: "When and to whom this should be escalated if the steps do not resolve it.",
            },
            cited_documents: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Filenames from search results that support this triage.",
            },
          },
          required: [
            "summary",
            "severity",
            "severity_reason",
            "category",
            "resolution_steps",
            "escalation",
            "cited_documents",
          ],
        },
      },
    ],
  },
];

/** Gemini rejects a "function" role — tool results are sent back on a user
 * turn, with the functionResponse carried in its parts. */
interface Turn {
  role: "user" | "model";
  parts: unknown[];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Normalises whatever the model submitted into a valid triage. The tool schema
 * makes the shape likely, not certain, so anything malformed is corrected here
 * rather than rendered as broken UI. */
function normaliseTriage(args: Record<string, unknown>, searched: Set<string>): AgentTriage {
  const severity = asString(args.severity).toUpperCase() as TriageSeverity;
  const cited = asStringArray(args.cited_documents).filter((name) => searched.has(name));

  return {
    summary: asString(args.summary, "No summary was produced."),
    severity: SEVERITIES.includes(severity) ? severity : "P3",
    severity_reason: asString(args.severity_reason),
    category: asString(args.category, "helpdesk").toLowerCase(),
    resolution_steps: asStringArray(args.resolution_steps),
    escalation: asString(
      args.escalation,
      "Contact the IT Helpdesk at helpdesk@techcore.com or extension 1001."
    ),
    // Only filenames the agent genuinely saw in results survive, so a citation
    // can never point at a document it never retrieved.
    cited_documents: cited,
  };
}

export async function* runAgent(
  issue: string,
  config: ResolvedConfig
): AsyncGenerator<AgentEvent> {
  const maxSteps = stepBudget(config.maxSearches);
  const history: Turn[] = [{ role: "user", parts: [{ text: `IT issue to triage:\n${issue}` }] }];
  const searchedFilenames = new Set<string>();
  let searchCount = 0;

  for (let step = 1; step <= maxSteps; step++) {
    const mustConclude = searchCount >= config.maxSearches || step === maxSteps;

    const response = await generateContent({
      systemInstruction: { parts: [{ text: systemInstruction(config) }] },
      contents: history,
      tools: TOOLS,
      toolConfig: {
        functionCallingConfig: mustConclude
          ? { mode: "ANY", allowedFunctionNames: ["submit_triage"] }
          : { mode: "AUTO" },
      },
      generationConfig: { temperature: 0 },
    });

    const parts: GeminiPart[] = response.candidates?.[0]?.content?.parts ?? [];
    const functionCalls = parts.filter((part) => part.functionCall);
    const narration = parts
      .map((part) => part.text ?? "")
      .join("")
      .trim();

    if (narration) {
      yield { type: "thinking", step, text: narration };
    }

    if (functionCalls.length === 0) {
      // No tool call and no triage — nudge once by recording the model's turn
      // and asking it to finish through the tool.
      history.push({ role: "model", parts: parts.length ? parts : [{ text: narration }] });
      history.push({
        role: "user",
        parts: [{ text: "Finish by calling submit_triage with your conclusion." }],
      });
      continue;
    }

    history.push({ role: "model", parts });
    const responseParts: unknown[] = [];

    for (const part of functionCalls) {
      const call = part.functionCall!;
      const args = call.args ?? {};

      if (call.name === "submit_triage") {
        yield { type: "tool_call", step, name: call.name, detail: "Submitting triage" };
        yield { type: "final", triage: normaliseTriage(args, searchedFilenames) };
        return;
      }

      if (call.name === "search_knowledge_base") {
        const query = asString(args.query, issue);
        yield { type: "tool_call", step, name: call.name, detail: query };

        // hits are the individual passages; sources collapse them to one card
        // per file for display. The model gets every passage, since several
        // hits from one document carry more signal than a single snippet.
        searchCount++;
        const { hits, sources } = await retrieve(query, SEARCH_TOP_K);
        for (const source of sources) searchedFilenames.add(source.filename);

        yield {
          type: "tool_result",
          step,
          name: call.name,
          summary: hits.length
            ? `${hits.length} passage${hits.length === 1 ? "" : "s"} across ${sources.length} document${sources.length === 1 ? "" : "s"}`
            : "No matching passages",
          sources,
        };

        responseParts.push({
          functionResponse: {
            name: call.name,
            response: {
              results: hits.map(({ chunk, score }) => ({
                filename: chunk.filename,
                category: chunk.category,
                score: Math.round(Math.max(0, score) * 10000) / 10000,
                passage: chunk.text.slice(0, SNIPPET_LENGTH),
              })),
            },
          },
        });
        continue;
      }

      if (call.name === "list_knowledge_base") {
        yield { type: "tool_call", step, name: call.name, detail: "Listing indexed documents" };
        const documents = getDocuments().map((doc) => ({
          filename: doc.filename,
          category: doc.category,
          chunk_count: doc.chunk_count,
        }));

        yield {
          type: "tool_result",
          step,
          name: call.name,
          summary: `${documents.length} documents indexed`,
          sources: [],
        };

        responseParts.push({
          functionResponse: { name: call.name, response: { documents } },
        });
        continue;
      }

      // Unknown tool — tell the model rather than failing the whole run.
      responseParts.push({
        functionResponse: {
          name: call.name,
          response: { error: `Unknown tool '${call.name}'.` },
        },
      });
    }

    history.push({ role: "user", parts: responseParts });
  }

  yield {
    type: "error",
    message: `The agent reached its ${maxSteps}-step limit without submitting a triage. Try describing the issue more specifically.`,
  };
}
