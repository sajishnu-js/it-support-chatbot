"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Database, FolderOpen, Layers, Plus, RefreshCw, Search } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { StatTile } from "@/components/common/stat-tile";
import { KbDetailSheet } from "@/components/knowledge-base/kb-detail-sheet";
import { KbFileCard } from "@/components/knowledge-base/kb-file-card";
import { KbInsights } from "@/components/knowledge-base/kb-insights";
import { KbUploadDialog } from "@/components/knowledge-base/kb-upload-dialog";
import { RecentKnowledge } from "@/components/knowledge-base/recent-knowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, deleteDocument, rebuildIndex } from "@/lib/api";
import { CATEGORY_ORDER, categoryMeta } from "@/lib/categories";
import { useDocuments } from "@/lib/hooks/use-documents";
import { notify } from "@/lib/notify";
import type { CategoryKey, KnowledgeDocument } from "@/lib/types";

type TypeFilter = "all" | ".txt" | ".md" | ".pdf";
type StatusFilter = "all" | "Indexed" | "Pending";
type CategoryFilter = "all" | CategoryKey;
type SortKey = "name" | "size" | "newest" | "oldest";

function KnowledgeBaseContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") as CategoryFilter | null;

  const { documents, loading, error, refresh } = useDocuments();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(initialCategory ?? "all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [selected, setSelected] = useState<KnowledgeDocument | null>(null);

  const filtered = useMemo(() => {
    let list = documents;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((d) => d.filename.toLowerCase().includes(q));
    }
    if (typeFilter !== "all") list = list.filter((d) => d.ext === typeFilter);
    if (statusFilter !== "all") list = list.filter((d) => d.status === statusFilter);
    if (categoryFilter !== "all") list = list.filter((d) => d.category === categoryFilter);

    const sorted = [...list];
    switch (sortKey) {
      case "name":
        sorted.sort((a, b) => a.filename.localeCompare(b.filename));
        break;
      case "size":
        sorted.sort((a, b) => b.size - a.size);
        break;
      case "oldest":
        sorted.sort((a, b) => a.modified_at.localeCompare(b.modified_at));
        break;
      default:
        sorted.sort((a, b) => b.modified_at.localeCompare(a.modified_at));
    }
    return sorted;
  }, [documents, query, typeFilter, statusFilter, categoryFilter, sortKey]);

  const totalChunks = documents.reduce((sum, d) => sum + d.chunk_count, 0);
  const indexedCount = documents.filter((d) => d.status === "Indexed").length;
  const pendingCount = documents.length - indexedCount;

  const handleDelete = async (filename: string) => {
    try {
      await deleteDocument(filename);
      notify.success(`Removed ${filename} from the knowledge base`);
      await refresh();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to remove the file.";
      notify.error(message);
      throw err;
    }
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      const res = await rebuildIndex();
      notify.success(`Rebuilt index — ${res.documents_indexed} files, ${res.total_chunks} chunks`);
      await refresh();
    } catch (err) {
      notify.error(err instanceof ApiError ? err.message : "Failed to rebuild the index.");
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6">
      <PageHeader
        title="Knowledge Base"
        description="Documents indexed here ground every answer in Chat."
        actions={
          <>
            <Button variant="outline" onClick={handleRebuild} disabled={rebuilding}>
              <RefreshCw className={rebuilding ? "animate-spin" : ""} />
              Rebuild index
            </Button>
            <Button onClick={() => setUploadOpen(true)}>
              <Plus />
              Add to Knowledge Base
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total files" value={documents.length} icon={FolderOpen} />
        <StatTile label="Indexed" value={indexedCount} icon={Database} />
        <StatTile label="Pending" value={pendingCount} icon={RefreshCw} />
        <StatTile label="Total chunks" value={totalChunks} icon={Layers} />
      </div>

      {!loading && !error && <RecentKnowledge documents={documents} />}

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the knowledge base…"
            className="pl-8"
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORY_ORDER.map((key) => (
              <SelectItem key={key} value={key}>
                {categoryMeta(key).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
          <SelectTrigger className="w-full sm:w-28">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value=".txt">TXT</SelectItem>
            <SelectItem value=".md">MD</SelectItem>
            <SelectItem value=".pdf">PDF</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Indexed">Indexed</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="size">Largest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2.5" data-testid="kb-file-list">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="skeleton-shimmer h-[70px] w-full rounded-xl" />
          ))
        ) : error ? (
          <div className="glass-panel rounded-xl p-8 text-center text-sm text-muted-foreground">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-panel flex flex-col items-center gap-2 rounded-xl p-10 text-center">
            <Database className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              {documents.length === 0
                ? "Your knowledge base is empty"
                : "No files match your filters"}
            </p>
            <p className="text-xs text-muted-foreground">
              {documents.length === 0
                ? "Add a document to start grounding answers in your own content."
                : "Try adjusting your search or filters."}
            </p>
          </div>
        ) : (
          filtered.map((doc) => (
            <KbFileCard
              key={doc.filename}
              document={doc}
              onOpen={() => setSelected(doc)}
              onDelete={() => handleDelete(doc.filename)}
            />
          ))
        )}
      </div>

      {!loading && !error && documents.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Knowledge insights</h2>
          <KbInsights documents={documents} />
        </div>
      )}

      <KbUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onIndexed={() => void refresh()}
      />
      <KbDetailSheet document={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}

export default function KnowledgeBasePage() {
  return (
    <Suspense fallback={null}>
      <KnowledgeBaseContent />
    </Suspense>
  );
}
