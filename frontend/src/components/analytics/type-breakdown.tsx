import { formatExt } from "@/lib/format";
import type { KnowledgeDocument } from "@/lib/types";

export function TypeBreakdown({ documents }: { documents: KnowledgeDocument[] }) {
  const counts = new Map<string, number>();
  for (const doc of documents) {
    counts.set(doc.ext, (counts.get(doc.ext) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, count]) => count));

  return (
    <div className="glass-panel rounded-xl p-4">
      <span className="text-sm font-medium">Files by type</span>
      <div className="mt-4 flex flex-col gap-3">
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground">No files indexed yet.</p>
        )}
        {rows.map(([ext, count]) => (
          <div key={ext} className="flex items-center gap-3">
            <span className="w-9 shrink-0 text-xs font-medium text-muted-foreground">
              {formatExt(ext)}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-xs font-medium tabular-nums">
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
