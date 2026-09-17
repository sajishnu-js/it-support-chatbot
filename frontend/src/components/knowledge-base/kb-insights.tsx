import { categoryMeta } from "@/lib/categories";
import { formatBytes } from "@/lib/format";
import type { KnowledgeDocument } from "@/lib/types";

export function KbInsights({ documents }: { documents: KnowledgeDocument[] }) {
  if (documents.length === 0) return null;

  const counts = new Map<string, number>();
  for (const doc of documents) {
    counts.set(doc.category, (counts.get(doc.category) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, count]) => count));

  const largest = [...documents].sort((a, b) => b.size - a.size)[0];
  const mostChunks = [...documents].sort((a, b) => b.chunk_count - a.chunk_count)[0];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="glass-panel rounded-xl p-4">
        <span className="text-sm font-medium">Knowledge by category</span>
        <div className="mt-3 flex flex-col gap-2.5">
          {rows.map(([key, count]) => {
            const meta = categoryMeta(key);
            return (
              <div key={key} className="flex items-center gap-2.5">
                <meta.icon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="w-36 shrink-0 truncate text-xs text-muted-foreground">
                  {meta.label}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </div>
                <span className="w-4 shrink-0 text-right text-xs font-medium tabular-nums">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-panel rounded-xl p-4">
        <span className="text-sm font-medium">Quick facts</span>
        <div className="mt-3 flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-muted-foreground">Largest file</span>
            <span className="truncate font-medium">
              {largest.filename} · {formatBytes(largest.size)}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-muted-foreground">Most chunked</span>
            <span className="truncate font-medium">
              {mostChunks.filename} · {mostChunks.chunk_count} chunks
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Categories covered</span>
            <span className="font-medium">{rows.length} of 8</span>
          </div>
        </div>
      </div>
    </div>
  );
}
