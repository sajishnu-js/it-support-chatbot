import { resolveConfig, runAgent } from "@/lib/server/agent";

export const maxDuration = 60;

/** Streams the agent's real steps as NDJSON, one event per line, so the UI can
 * render the investigation as it happens instead of waiting on a final blob. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const issue: string = (body.issue ?? "").trim();
  // Sanitised server-side: the config is client-supplied, so lengths are capped
  // and the search budget clamped before it can reach the model.
  const config = resolveConfig(body.config);

  const encoder = new TextEncoder();
  const line = (obj: unknown) => encoder.encode(`${JSON.stringify(obj)}\n`);

  if (!issue) {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(line({ type: "error", message: "Describe the issue to triage." }));
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runAgent(issue, config)) {
          controller.enqueue(line(event));
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        controller.enqueue(line({ type: "error", message: `Agent run failed: ${detail}` }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache, no-transform" },
  });
}
