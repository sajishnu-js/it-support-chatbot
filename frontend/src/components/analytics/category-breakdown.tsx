import { categoryMeta } from "@/lib/categories";
import type { CategoryKey } from "@/lib/types";

export function CategoryBreakdown({
  documentsByCategory,
}: {
  documentsByCategory: Partial<Record<CategoryKey, number>>;
}) {
  const rows = (Object.entries(documentsByCategory) as [CategoryKey, number][]).sort(
    (a, b) => b[1] - a[1]
  );
  const max = Math.max(1, ...rows.map(([, count]) => count));

  return (
    <div className="glass-panel rounded-xl p-4">
      <span className="text-sm font-medium">Knowledge Base by category</span>
      <div className="mt-4 flex flex-col gap-2.5">
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground">No documents indexed yet.</p>
        )}
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
  );
}
