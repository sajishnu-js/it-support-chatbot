"use client";

import { FileText } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { categoryMeta } from "@/lib/categories";
import { formatExt } from "@/lib/format";
import type { KnowledgeSource } from "@/lib/types";

export function CitationList({ sources }: { sources: KnowledgeSource[] }) {
  if (!sources.length) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Sources
      </span>
      {sources.map((source) => (
        <CitationChip key={`${source.filename}-${source.page ?? "na"}`} source={source} />
      ))}
    </div>
  );
}

function CitationChip({ source }: { source: KnowledgeSource }) {
  const relevance = Math.round(source.score * 100);
  const meta = categoryMeta(source.category);

  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-2.5 py-1 text-xs font-medium text-foreground/90 transition-colors hover:border-primary/50 hover:bg-primary/15">
        <FileText className="size-3.5 text-primary" />
        {source.filename}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-primary">
              {formatExt(source.ext)}
            </span>
            <span className="text-sm font-medium">{source.filename}</span>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <meta.icon className="size-3" />
            {meta.label}
          </span>
          {source.page !== null && <span>Page {source.page + 1}</span>}
          <span>{relevance}% relevant</span>
        </div>
        <p className="mt-2.5 line-clamp-6 text-xs leading-relaxed text-muted-foreground">
          {source.snippet}…
        </p>
      </PopoverContent>
    </Popover>
  );
}
