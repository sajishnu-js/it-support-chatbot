import { FileText } from "lucide-react";

import { categoryMeta } from "@/lib/categories";
import { formatRelativeTime } from "@/lib/format";
import type { KnowledgeDocument } from "@/lib/types";

export function RecentKnowledge({ documents }: { documents: KnowledgeDocument[] }) {
  const recent = [...documents]
    .filter((d) => d.indexed_at)
    .sort((a, b) => (b.indexed_at ?? "").localeCompare(a.indexed_at ?? ""))
    .slice(0, 5);

  if (recent.length === 0) return null;

  return (
    <div>
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Recently added
      </span>
      <div className="relative mt-2">
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {recent.map((doc) => {
            const meta = categoryMeta(doc.category);
            return (
              <div
                key={doc.filename}
                className="glass-panel flex w-56 shrink-0 items-start gap-2.5 rounded-xl p-3"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{doc.filename}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <meta.icon className="size-3" />
                    {meta.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatRelativeTime(doc.indexed_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        {recent.length > 3 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-r from-transparent to-background"
          />
        )}
      </div>
    </div>
  );
}
