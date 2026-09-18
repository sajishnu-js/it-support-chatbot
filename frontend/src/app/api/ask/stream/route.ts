import { relatedDocuments, streamRag } from "@/lib/server/rag";
import { getSettings, recordQuestion } from "@/lib/server/state";

export const maxDuration = 60;

/** NDJSON stream — one JSON object per line, emitted as each stage actually
 * completes, so the UI shows real retrieval/generation progress rather than a
 * fake timer. Event shapes match backend.py's /ask/stream exactly. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const question: string = (body.question ?? "").trim();

  const settings = getSettings();
  const topK: number = body.top_k ?? settings.top_k;
  const strictMode: boolean = body.strict_mode ?? settings.strict_mode;

  const encoder = new TextEncoder();
  const line = (obj: unknown) => encoder.encode(`${JSON.stringify(obj)}\n`);

  if (!question) {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(line({ type: "token", text: "Please enter a valid question." }));
        controller.enqueue(line({ type: "sources", sources: [], related: [] }));
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of streamRag(question, topK, strictMode)) {
          if (event.kind === "token") {
            controller.enqueue(line({ type: "token", text: event.text }));
          } else if (event.kind === "retrieval") {
            // Recorded at retrieval (not after generation) so analytics reflect
            // real Knowledge Base usage even if the LLM call later fails.
            recordQuestion(question, event.sources.length);
            controller.enqueue(line({ type: "retrieval", sources: event.sources }));
          } else {
            controller.enqueue(
              line({
                type: "sources",
                sources: event.sources,
                related: relatedDocuments(event.sources.map((s) => s.filename)),
              })
            );
          }
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        controller.enqueue(line({ type: "error", message: `Failed to generate a response: ${detail}` }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
