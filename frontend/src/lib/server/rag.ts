/**
 * Serverless RAG core — the Vercel-side equivalent of rag_pipeline.py.
 *
 * The Python backend embeds locally with sentence-transformers and searches a
 * FAISS index; neither can run in a serverless function (torch alone exceeds
 * the bundle limit). Here the Knowledge Base is a pre-built JSON index of
 * Gemini embeddings (see build_kb_index.py) searched by dot product in memory.
 * 280 chunks is small enough that an exact scan is faster than any index.
 *
 * Prompts and the grounding contract are kept byte-identical to
 * rag_pipeline.py so both deployments answer the same way.
 */

import kbIndex from "@/data/kb-index.json";
import type { CategoryKey, KnowledgeDocument, KnowledgeSource, RelatedDocument } from "@/lib/types";

/** Gemini exposes models unevenly across API versions — some live only on v1,
 * some only on v1beta — and the free tier counts its request quota per model.
 * Making both configurable is what lets a deployment move to a model that still
 * has headroom without a code change. Embeddings stay on v1beta, which is the
 * only version that serves gemini-embedding-001. */
const GENERATION_API =
  `https://generativelanguage.googleapis.com/${process.env.GEMINI_API_VERSION || "v1beta"}/models`;
const EMBEDDING_API = "https://generativelanguage.googleapis.com/v1beta/models";
const RELATED_DOCS_LIMIT = 3;
const SNIPPET_LENGTH = 280;

interface IndexedChunk {
  filename: string;
  ext: string;
  category: string;
  page: number | null;
  text: string;
  embedding: number[];
}

/** Stored documents carry their full text so previews work without a
 * filesystem; it is stripped before going over the wire. */
type IndexedDocument = KnowledgeDocument & { text: string };

interface KbIndex {
  embedding_model: string;
  dimensions: number;
  chunk_size: number;
  chunk_overlap: number;
  built_at: string;
  documents: IndexedDocument[];
  chunks: IndexedChunk[];
}

const index = kbIndex as unknown as KbIndex;

export const EMBEDDING_MODEL = index.embedding_model;
export const CHUNK_SIZE = index.chunk_size;
export const CHUNK_OVERLAP = index.chunk_overlap;

export function getDocuments(): KnowledgeDocument[] {
  return index.documents.map(({ text: _text, ...doc }) => doc);
}

export function getDocumentText(filename: string): string | null {
  return index.documents.find((doc) => doc.filename === filename)?.text ?? null;
}

export function getChunkTotal(): number {
  return index.chunks.length;
}

export function getModel(): string {
  return process.env.GEMINI_MODEL || "gemini-flash-latest";
}

export function hasApiKey(): boolean {
  const key = process.env.GEMINI_API_KEY || "";
  return key !== "" && key !== "YOUR_GEMINI_API_KEY_HERE";
}

function requireApiKey(): string {
  const key = process.env.GEMINI_API_KEY || "";
  if (!key || key === "YOUR_GEMINI_API_KEY_HERE") {
    throw new Error(
      "GEMINI_API_KEY is not configured on the server. Add it in your Vercel project settings."
    );
  }
  return key;
}

/** Same grounding contract as PROMPT_TEMPLATE in rag_pipeline.py. */
const STRICT_PROMPT = `
You are an expert IT Support Assistant for TechCore Solutions.
Your job is to answer IT support questions accurately.

Use ONLY the information provided in the context below to answer.
If the answer is not in the context, say exactly:
"I don't have specific information about this in my documents.
Please contact IT Helpdesk at helpdesk@techcore.com or extension 1001."

Do NOT make up information.
Do NOT use knowledge outside of the provided context.
Be clear, concise, and provide step-by-step instructions where relevant.

Context:
{context}

Question: {question}

Answer:
`;

/** Mirrors RELAXED_PROMPT_TEMPLATE — opt-in via Settings, never the default. */
const RELAXED_PROMPT = `
You are an expert IT Support Assistant for TechCore Solutions.
Your job is to answer IT support questions accurately.

Prefer the information provided in the context below. If the context fully
answers the question, use it as the source of truth and stay consistent with it.
If the context is missing or incomplete, you may use your general IT knowledge
to fill the gaps, but clearly note when you are doing so.

Be clear, concise, and provide step-by-step instructions where relevant.

Context:
{context}

Question: {question}

Answer:
`;

function buildPrompt(context: string, question: string, strictMode: boolean): string {
  const template = strictMode ? STRICT_PROMPT : RELAXED_PROMPT;
  return template.replace("{context}", context).replace("{question}", question);
}

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Gemini's free tier returns 503 "high demand" and 429 quota errors often
 * enough that a single attempt fails visibly for users. Retry the transient
 * ones with backoff, kept short so we stay inside the function's time budget. */
async function fetchWithRetry(url: string, init: RequestInit, label: string): Promise<Response> {
  let lastMessage = "";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;

    const detail = await res.text();
    try {
      lastMessage = JSON.parse(detail)?.error?.message || `${res.status}`;
    } catch {
      lastMessage = `${res.status}`;
    }

    if (!RETRY_STATUSES.has(res.status) || attempt === MAX_ATTEMPTS - 1) {
      throw new Error(`${label}: ${lastMessage}`);
    }
    await sleep(700 * 2 ** attempt);
  }

  throw new Error(`${label}: ${lastMessage}`);
}

/** Raw generateContent call for callers that need a non-RAG request body —
 * the agent loop sends tool declarations and multi-turn history. */
export async function generateContent(body: unknown): Promise<GeminiResponse> {
  const res = await callGemini(getModel(), body);
  return res.json();
}

export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
}

export interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[]; role?: string }; finishReason?: string }>;
}

async function callGemini(path: string, body: unknown, stream = false): Promise<Response> {
  const key = requireApiKey();
  const method = stream ? "streamGenerateContent?alt=sse&" : "generateContent?";
  return fetchWithRetry(
    `${GENERATION_API}/${path}:${method}key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    `Error calling model '${getModel()}'`
  );
}

/** Embeds the question with the same model and dimensionality used to build
 * the index, as a RETRIEVAL_QUERY so it lands in the documents' vector space. */
async function embedQuery(question: string): Promise<number[]> {
  const key = requireApiKey();
  const res = await fetchWithRetry(
    `${EMBEDDING_API}/${EMBEDDING_MODEL}:embedContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text: question }] },
        taskType: "RETRIEVAL_QUERY",
        outputDimensionality: index.dimensions,
      }),
    },
    "Failed to embed the question"
  );

  const data = await res.json();
  const values: number[] = data.embedding.values;
  const magnitude = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  return magnitude === 0 ? values : values.map((v) => v / magnitude);
}

/** Exact nearest-neighbour scan. Both sides are unit vectors, so the dot
 * product is cosine similarity and already sits in a 0-1 display range. */
function search(queryVector: number[], k: number): Array<{ chunk: IndexedChunk; score: number }> {
  const scored = index.chunks.map((chunk) => {
    let dot = 0;
    for (let i = 0; i < queryVector.length; i++) dot += queryVector[i] * chunk.embedding[i];
    return { chunk, score: dot };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/** De-dupes to one citation card per file, matching _source_entries(). */
function toSources(hits: Array<{ chunk: IndexedChunk; score: number }>): KnowledgeSource[] {
  const sources: KnowledgeSource[] = [];
  const seen = new Set<string>();

  for (const { chunk, score } of hits) {
    if (seen.has(chunk.filename)) continue;
    seen.add(chunk.filename);
    sources.push({
      filename: chunk.filename,
      ext: chunk.ext,
      category: chunk.category as CategoryKey,
      snippet: chunk.text.slice(0, SNIPPET_LENGTH),
      page: chunk.page ?? null,
      score: Math.round(Math.max(0, score) * 10000) / 10000,
    });
  }
  return sources;
}

/** Other indexed files sharing a category with what was cited — derived from
 * real metadata only, never invented. Mirrors _related_documents(). */
export function relatedDocuments(cited: string[]): RelatedDocument[] {
  if (cited.length === 0) return [];

  const byFilename = new Map(index.documents.map((doc) => [doc.filename, doc]));
  const citedCategories = new Set(
    cited.map((name) => byFilename.get(name)?.category).filter(Boolean)
  );
  if (citedCategories.size === 0) return [];

  return index.documents
    .filter(
      (doc) =>
        doc.status === "Indexed" &&
        citedCategories.has(doc.category) &&
        !cited.includes(doc.filename)
    )
    .slice(0, RELATED_DOCS_LIMIT)
    .map((doc) => ({
      filename: doc.filename,
      category: doc.category,
      chunk_count: doc.chunk_count,
    }));
}

export async function retrieve(question: string, k: number) {
  const hits = search(await embedQuery(question), k);
  return { hits, sources: toSources(hits) };
}

function formatContext(hits: Array<{ chunk: IndexedChunk }>): string {
  return hits.map(({ chunk }) => chunk.text).join("\n\n");
}

export async function queryRag(question: string, k: number, strictMode: boolean) {
  const { hits, sources } = await retrieve(question, k);
  const prompt = buildPrompt(formatContext(hits), question, strictMode);

  const res = await callGemini(getModel(), {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0 },
  });

  const data = await res.json();
  const answer: string =
    data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";

  return { answer, sources };
}

/** Streams generated text chunk-by-chunk, mirroring stream_rag(). */
export async function* streamRag(question: string, k: number, strictMode: boolean) {
  const { hits, sources } = await retrieve(question, k);
  yield { kind: "retrieval" as const, sources };

  const prompt = buildPrompt(formatContext(hits), question, strictMode);
  const res = await callGemini(getModel(), {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0 },
  }, true);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload);
          const text = parsed.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text ?? "")
            .join("");
          if (text) yield { kind: "token" as const, text };
        } catch {
          // partial SSE frame — the next read completes it
        }
      }
    }
    if (done) break;
  }

  yield { kind: "sources" as const, sources };
}
