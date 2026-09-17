import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

export function CoverageMeter({ indexed, total }: { indexed: number; total: number }) {
  const pct = total > 0 ? Math.round((indexed / total) * 100) : 0;

  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Knowledge Base coverage</span>
        <span className="text-sm font-semibold tabular-nums">{pct}%</span>
      </div>
      <ProgressPrimitive.Root value={pct} className="mt-3">
        <ProgressPrimitive.Track className="block h-2 w-full overflow-hidden rounded-full bg-emerald-500/15">
          <ProgressPrimitive.Indicator className="block h-full rounded-full bg-emerald-500 transition-[width] duration-500" />
        </ProgressPrimitive.Track>
      </ProgressPrimitive.Root>
      <p className="mt-2 text-xs text-muted-foreground">
        {indexed} of {total} files fully indexed and searchable
      </p>
    </div>
  );
}
