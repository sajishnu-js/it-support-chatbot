import { FileText } from "lucide-react";

import { categoryMeta } from "@/lib/categories";
import type { RelatedDocument } from "@/lib/types";

export function RelatedArticles({ related }: { related: RelatedDocument[] }) {
  if (!related.length) return null;

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Related knowledge
      </span>
      <div className="mt-2 flex flex-col gap-1.5">
        {related.map((doc) => {
          const meta = categoryMeta(doc.category);
          return (
            <div key={doc.filename} className="flex items-center gap-2 text-xs">
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{doc.filename}</span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                <meta.icon className="size-2.5" />
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
