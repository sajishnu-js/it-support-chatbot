"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, RotateCcw, Shield, ThumbsDown, ThumbsUp, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CitationList } from "@/components/chat/citation-card";
import { Markdown } from "@/components/chat/markdown";
import { ProcessingIndicator } from "@/components/chat/processing-indicator";
import { RelatedArticles } from "@/components/chat/related-articles";
import { formatClockTime } from "@/lib/format";
import { useUiPrefsStore } from "@/lib/store/ui-prefs-store";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/lib/types";

export function ChatMessage({
  message,
  onRegenerate,
}: {
  message: ChatMessageType;
  onRegenerate?: () => void;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const showTimestamps = useUiPrefsStore((s) => s.showTimestamps);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn("animate-fade-in-up flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full border",
          isUser
            ? "border-border bg-secondary text-secondary-foreground"
            : "border-primary/20 bg-primary/10 text-primary"
        )}
      >
        {isUser ? <User className="size-4" /> : <Shield className="size-4" />}
      </div>

      <div className={cn("flex min-w-0 max-w-[85%] flex-col", isUser && "items-end")}>
        <div
          className={cn(
            "glass-panel rounded-2xl px-4 py-3 text-sm",
            isUser ? "rounded-tr-sm bg-primary/10" : "rounded-tl-sm"
          )}
        >
          {message.status === "streaming" && !message.content ? (
            <ProcessingIndicator retrievalSources={message.retrievalSources} />
          ) : message.status === "error" ? (
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  Something went wrong while generating the response.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Please try again, or contact IT Helpdesk at helpdesk@techcore.com / extension
                  1001.
                </p>
              </div>
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <>
              <Markdown content={message.content} />
              {message.status === "streaming" && (
                <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-primary/70" />
              )}
            </>
          )}
          {message.sources && message.sources.length > 0 && (
            <CitationList sources={message.sources} />
          )}
          {message.related && message.related.length > 0 && (
            <RelatedArticles related={message.related} />
          )}
        </div>

        <div className="mt-1 flex items-center gap-1 px-1">
          {showTimestamps && (
            <span className="text-[11px] text-muted-foreground">
              {formatClockTime(message.createdAt)}
            </span>
          )}

          {!isUser && message.status === "done" && (
            <div className="ml-1 flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Copy response"
                onClick={handleCopy}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </Button>
              {onRegenerate && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Regenerate response"
                  onClick={onRegenerate}
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Good response"
                aria-pressed={feedback === "up"}
                onClick={() => setFeedback(feedback === "up" ? null : "up")}
                className={cn(feedback === "up" && "text-emerald-500")}
              >
                <ThumbsUp className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Bad response"
                aria-pressed={feedback === "down"}
                onClick={() => setFeedback(feedback === "down" ? null : "down")}
                className={cn(feedback === "down" && "text-destructive")}
              >
                <ThumbsDown className="size-3.5" />
              </Button>
            </div>
          )}
          {!isUser && message.status === "error" && onRegenerate && (
            <Button variant="ghost" size="xs" onClick={onRegenerate} className="ml-1 gap-1">
              <RotateCcw className="size-3.5" />
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
