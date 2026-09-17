"use client";

import { Database, FileStack, Layers, MessagesSquare, RefreshCw } from "lucide-react";

import { ActivityFeed } from "@/components/analytics/activity-feed";
import { CategoryBreakdown } from "@/components/analytics/category-breakdown";
import { CoverageMeter } from "@/components/analytics/coverage-meter";
import { TypeBreakdown } from "@/components/analytics/type-breakdown";
import { PageHeader } from "@/components/common/page-header";
import { StatTile } from "@/components/common/stat-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalytics } from "@/lib/hooks/use-analytics";
import { useDocuments } from "@/lib/hooks/use-documents";

export default function AnalyticsPage() {
  const { analytics, loading, error } = useAnalytics();
  const { documents } = useDocuments();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6">
      <PageHeader
        title="Analytics"
        description="Real usage and Knowledge Base metrics — nothing here is simulated."
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="skeleton-shimmer h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : error || !analytics ? (
        <div className="glass-panel rounded-xl p-8 text-center text-sm text-muted-foreground">
          {error ?? "Analytics are unavailable."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatTile label="Total files" value={analytics.total_documents} icon={FileStack} />
            <StatTile label="Indexed" value={analytics.indexed_documents} icon={Database} />
            <StatTile label="Pending" value={analytics.pending_documents} icon={RefreshCw} />
            <StatTile label="Total chunks" value={analytics.total_chunks} icon={Layers} />
            <StatTile
              label="Questions asked"
              value={analytics.total_questions}
              icon={MessagesSquare}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CoverageMeter indexed={analytics.indexed_documents} total={analytics.total_documents} />
            <TypeBreakdown documents={documents} />
          </div>

          <CategoryBreakdown documentsByCategory={analytics.documents_by_category} />

          <ActivityFeed activity={analytics.recent_activity} />
        </>
      )}
    </div>
  );
}
