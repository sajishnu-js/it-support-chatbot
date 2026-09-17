import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DocumentStatus } from "@/lib/types";

const CONFIG: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  Indexed: {
    label: "Indexed",
    className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    icon: CheckCircle2,
  },
  Pending: {
    label: "Pending",
    className: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    icon: CircleDashed,
  },
};

export function StatusPill({ status }: { status: DocumentStatus | string }) {
  const config = CONFIG[status] ?? { label: status, className: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle };
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}
