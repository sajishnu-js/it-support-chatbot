"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { notify } from "@/lib/notify";
import { buildTicketSummary, ticketSummaryFilename } from "@/lib/ticket-summary";
import type { Conversation } from "@/lib/types";

export function TicketSummaryDialog({
  conversation,
  open,
  onOpenChange,
}: {
  conversation: Conversation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const summary = useMemo(() => buildTicketSummary(conversation), [conversation]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    notify.success("Summary copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const blob = new Blob([summary], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ticketSummaryFilename(conversation.title);
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ticket summary</DialogTitle>
          <DialogDescription>
            Generated from this conversation. Copy or download it, then paste it into your
            ticketing system — nothing is submitted automatically.
          </DialogDescription>
        </DialogHeader>

        <pre className="max-h-80 overflow-y-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre-wrap">
          {summary}
        </pre>

        <DialogFooter>
          <Button variant="outline" onClick={handleDownload} className="gap-1.5">
            <Download className="size-3.5" />
            Download .txt
          </Button>
          <Button onClick={handleCopy} className="gap-1.5">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            Copy summary
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
