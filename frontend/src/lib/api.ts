import type {
  AgentEvent,
  AnalyticsSummary,
  AskResponse,
  HealthStatus,
  KnowledgeDocument,
  KnowledgeSource,
  RagSettings,
  RelatedDocument,
} from "@/lib/types";

/** Where the RAG API lives.
 *
 * Unset (the deployed default) means same-origin `/api` — the Next.js route
 * handlers in src/app/api, which run the RAG pipeline against a pre-built
 * Gemini embedding index. Set NEXT_PUBLIC_API_URL to point at the Python
 * FastAPI backend instead; frontend/.env.local does this for local dev.
 *
 * Inlined at build time, so changing it requires a rebuild, not a restart.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "/api";

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(
      "Unable to connect to the AI service. Please check that the backend is running."
    );
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // response body wasn't JSON — fall back to statusText
    }
    throw new ApiError(detail, res.status);
  }

  return res.json() as Promise<T>;
}

export function getHealth() {
  return request<HealthStatus>("/health");
}

export function getSettings() {
  return request<RagSettings>("/settings");
}

export function updateSettings(update: Partial<RagSettings>) {
  return request<RagSettings>("/settings", {
    method: "POST",
    body: JSON.stringify(update),
  });
}

export function getAnalytics() {
  return request<AnalyticsSummary>("/analytics");
}

export function getDocuments() {
  return request<{ documents: KnowledgeDocument[] }>("/documents").then(
    (res) => res.documents
  );
}

export function deleteDocument(filename: string) {
  return request<{ deleted: string }>(`/documents/${encodeURIComponent(filename)}`, {
    method: "DELETE",
  });
}

export function previewDocument(filename: string) {
  return request<{ filename: string; preview: string; truncated: boolean }>(
    `/documents/${encodeURIComponent(filename)}/preview`
  );
}

export function rebuildIndex() {
  return request<{ documents_indexed: number; total_chunks: number }>(
    "/documents/rebuild",
    { method: "POST" }
  );
}

export function ask(question: string, opts?: Partial<RagSettings>) {
  return request<AskResponse>("/ask", {
    method: "POST",
    body: JSON.stringify({ question, ...opts }),
  });
}

/** Uploads a file with real byte-level progress via XHR (fetch can't report upload progress). */
export function uploadDocument(
  file: File,
  onProgress?: (percent: number) => void
): Promise<KnowledgeDocument> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new ApiError("Received an invalid response while indexing the file."));
        }
      } else {
        let detail = xhr.statusText;
        try {
          detail = JSON.parse(xhr.responseText).detail || detail;
        } catch {
          // ignore
        }
        reject(new ApiError(detail, xhr.status));
      }
    });

    xhr.addEventListener("error", () =>
      reject(
        new ApiError(
          "Unable to connect to the AI service. Please check that the backend is running."
        )
      )
    );

    xhr.open("POST", `${API_BASE_URL}/documents/upload`);
    xhr.send(form);
  });
}

interface StreamAskCallbacks {
  /** Fires once retrieval genuinely finishes, before the LLM is even called. */
  onRetrieval: (sources: KnowledgeSource[]) => void;
  onToken: (chunk: string) => void;
  onSources: (sources: KnowledgeSource[], related: RelatedDocument[]) => void;
  onError: (message: string) => void;
  signal?: AbortSignal;
}

type StreamEvent =
  | { type: "retrieval"; sources: KnowledgeSource[] }
  | { type: "token"; text: string }
  | { type: "sources"; sources: KnowledgeSource[]; related: RelatedDocument[] }
  | { type: "error"; message: string };

/** Streams NDJSON events (one JSON object per line) reflecting each real
 * backend stage — retrieval, then generation token-by-token, then final
 * sources — so the UI never has to fake or guess a stage. */
export async function askStream(
  question: string,
  opts: Partial<RagSettings>,
  { onRetrieval, onToken, onSources, onError, signal }: StreamAskCallbacks
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/ask/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, ...opts }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    onError("Unable to connect to the AI service. Please check that the backend is running.");
    return;
  }

  if (!res.ok || !res.body) {
    onError(`The AI service returned an error (${res.status}).`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let gotTerminalEvent = false;

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    let event: StreamEvent;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    switch (event.type) {
      case "retrieval":
        onRetrieval(event.sources);
        break;
      case "token":
        onToken(event.text);
        break;
      case "sources":
        gotTerminalEvent = true;
        onSources(event.sources, event.related);
        break;
      case "error":
        gotTerminalEvent = true;
        onError(event.message);
        break;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) handleLine(line);
    }
    if (done) break;
  }
  if (buffer) handleLine(buffer);

  if (!gotTerminalEvent) {
    onError("The connection ended before a response was completed.");
  }
}

/** Streams the AI Agent's triage run.
 *
 * Always same-origin: the agent loop lives only in the Next.js route handlers,
 * so it must not follow API_BASE_URL when that points at the Python backend.
 */
export async function runAgentStream(
  issue: string,
  { onEvent, onError, signal }: {
    onEvent: (event: AgentEvent) => void;
    onError: (message: string) => void;
    signal?: AbortSignal;
  }
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issue }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    onError("Unable to reach the agent service.");
    return;
  }

  if (!res.ok || !res.body) {
    onError(`The agent service returned an error (${res.status}).`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawTerminal = false;

  const handle = (line: string) => {
    if (!line.trim()) return;
    try {
      const event = JSON.parse(line) as AgentEvent;
      if (event.type === "final" || event.type === "error") sawTerminal = true;
      onEvent(event);
    } catch {
      // partial line — the next read completes it
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) handle(line);
    }
    if (done) break;
  }
  if (buffer) handle(buffer);

  if (!sawTerminal) onError("The agent run ended before producing a triage.");
}
