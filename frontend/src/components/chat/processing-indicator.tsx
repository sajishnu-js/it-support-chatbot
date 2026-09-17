import { AiCore } from "@/components/chat/ai-core";
import type { KnowledgeSource } from "@/lib/types";

export function ProcessingIndicator({ retrievalSources }: { retrievalSources?: KnowledgeSource[] }) {
  const retrieved = !!retrievalSources;

  return (
    <div className="flex items-center gap-3">
      <AiCore size="sm" searching={!retrieved} sources={retrievalSources} />
      <div className="text-sm text-muted-foreground">
        {retrieved ? (
          <>
            <p className="font-medium text-foreground/80">
              Found {retrievalSources.length} relevant source
              {retrievalSources.length === 1 ? "" : "s"}
            </p>
            <p className="text-xs">Generating response…</p>
          </>
        ) : (
          <p>Searching the Knowledge Base…</p>
        )}
      </div>
    </div>
  );
}
