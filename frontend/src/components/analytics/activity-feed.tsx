import { MessageCircle } from "lucide-react";

import { formatRelativeTime } from "@/lib/format";
import type { RecentActivity } from "@/lib/types";

export function ActivityFeed({ activity }: { activity: RecentActivity[] }) {
  return (
    <div className="glass-panel rounded-xl p-4">
      <span className="text-sm font-medium">Recent activity</span>
      <div className="mt-3 flex flex-col">
        {activity.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Questions asked in Chat will show up here.
          </p>
        )}
        {activity.map((entry, i) => (
          <div
            key={`${entry.timestamp}-${i}`}
            className="flex items-start gap-2.5 border-b border-border/50 py-2.5 last:border-0"
          >
            <MessageCircle className="mt-0.5 size-3.5 shrink-0 text-primary/70" />
            <p className="min-w-0 flex-1 truncate text-sm">{entry.question}</p>
            <span className="shrink-0 text-xs text-muted-foreground">
              {entry.source_count} source{entry.source_count === 1 ? "" : "s"}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatRelativeTime(entry.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
