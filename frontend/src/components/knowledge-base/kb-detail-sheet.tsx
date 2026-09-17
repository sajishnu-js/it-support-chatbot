"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/knowledge-base/status-pill";
import { categoryMeta } from "@/lib/categories";
import { ApiError, previewDocument } from "@/lib/api";
import { formatBytes, formatExt, formatRelativeTime } from "@/lib/format";
import type { KnowledgeDocument } from "@/lib/types";

export function KbDetailSheet({
  document,
  onOpenChange,
}: {
  document: KnowledgeDocument | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!document) return;
    setLoading(true);
    setError(null);
    setPreview(null);

    previewDocument(document.filename)
      .then((res) => {
        setPreview(res.preview);
        setTruncated(res.truncated);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load preview.");
      })
      .finally(() => setLoading(false));
  }, [document]);

  return (
    <Sheet open={!!document} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 sm:max-w-md">
        {document && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{document.filename}</SheetTitle>
                  <SheetDescription>Knowledge Base item details</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={document.status} />
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-muted-foreground">
                  {formatExt(document.ext)}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-border/60 p-3.5 text-sm">
                <Detail label="Category" value={categoryMeta(document.category).label} />
                <Detail label="File size" value={formatBytes(document.size)} />
                <Detail label="Chunks indexed" value={String(document.chunk_count)} />
                <Detail label="Last modified" value={formatRelativeTime(document.modified_at)} />
                <Detail label="Last indexed" value={formatRelativeTime(document.indexed_at)} />
                <Detail label="Embedding model" value="all-MiniLM-L6-v2" />
                <Detail label="Vector store" value="FAISS (local)" />
              </dl>

              <div>
                <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Content preview
                </h4>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-2/3" />
                  </div>
                ) : error ? (
                  <p className="text-xs text-destructive">{error}</p>
                ) : (
                  <p className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                    {preview}
                    {truncated && "…"}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
