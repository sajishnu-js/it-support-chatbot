"use client";

import { useEffect, useRef, useState } from "react";
import { FileOutput } from "lucide-react";

import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessage } from "@/components/chat/chat-message";
import { EmptyState } from "@/components/chat/empty-state";
import { TicketSummaryDialog } from "@/components/chat/ticket-summary-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { askStream } from "@/lib/api";
import { notify } from "@/lib/notify";
import { useChatStore } from "@/lib/store/chat-store";

export function ChatView() {
  const activeConversation = useChatStore((s) => s.activeConversation());
  const ensureActiveConversation = useChatStore((s) => s.ensureActiveConversation);
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const addAssistantPlaceholder = useChatStore((s) => s.addAssistantPlaceholder);
  const resetAssistantMessage = useChatStore((s) => s.resetAssistantMessage);
  const setRetrievalSources = useChatStore((s) => s.setRetrievalSources);
  const appendToken = useChatStore((s) => s.appendToken);
  const finalizeAssistant = useChatStore((s) => s.finalizeAssistant);
  const failAssistant = useChatStore((s) => s.failAssistant);
  const pendingPrompt = useChatStore((s) => s.pendingPrompt);
  const setPendingPrompt = useChatStore((s) => s.setPendingPrompt);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = activeConversation?.messages ?? [];
  const lastMessageContent = messages[messages.length - 1]?.content;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastMessageContent]);

  const runStream = async (conversationId: string, question: string, assistantId: string) => {
    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    await askStream(
      question,
      {},
      {
        signal: controller.signal,
        onRetrieval: (sources) => setRetrievalSources(conversationId, assistantId, sources),
        onToken: (token) => appendToken(conversationId, assistantId, token),
        onSources: (sources, related) =>
          finalizeAssistant(conversationId, assistantId, sources, related),
        onError: (message) => {
          failAssistant(conversationId, assistantId, message);
          notify.error("Failed to generate a response", {
            description: "Check your Knowledge Base and AI configuration, then try again.",
          });
        },
      }
    );

    setIsStreaming(false);
    abortRef.current = null;
  };

  const handleSend = (question: string) => {
    const conversationId = ensureActiveConversation();
    addUserMessage(conversationId, question);
    const assistantId = addAssistantPlaceholder(conversationId);
    void runStream(conversationId, question, assistantId);
  };

  // Quick actions / category shortcuts (sidebar) set pendingPrompt then
  // navigate here — consume it once so the message actually gets sent.
  useEffect(() => {
    if (pendingPrompt) {
      handleSend(pendingPrompt);
      setPendingPrompt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt]);

  const handleRegenerate = (assistantMessageId: string) => {
    if (!activeConversation || isStreaming) return;
    const index = activeConversation.messages.findIndex((m) => m.id === assistantMessageId);
    const previousUserMessage = [...activeConversation.messages.slice(0, index)]
      .reverse()
      .find((m) => m.role === "user");
    if (!previousUserMessage) return;

    resetAssistantMessage(activeConversation.id, assistantMessageId);
    void runStream(activeConversation.id, previousUserMessage.content, assistantMessageId);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  };

  const hasAnswer = messages.some((m) => m.role === "assistant" && m.status === "done");

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl min-h-0 flex-1 flex-col px-4">
      {messages.length === 0 ? (
        <EmptyState onSelect={handleSend} />
      ) : (
        <>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 py-2.5">
            <span className="truncate text-sm font-medium text-muted-foreground">
              {activeConversation?.title ?? "Chat"}
            </span>
            {hasAnswer && (
              <Button variant="outline" size="xs" className="gap-1.5" onClick={() => setSummaryOpen(true)}>
                <FileOutput className="size-3.5" />
                Summarize
              </Button>
            )}
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-5 py-6">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onRegenerate={
                    message.role === "assistant" ? () => handleRegenerate(message.id) : undefined
                  }
                />
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        </>
      )}

      <div className="shrink-0 pb-4">
        <ChatInput isStreaming={isStreaming} onSend={handleSend} onStop={handleStop} />
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Answers are grounded in your Knowledge Base and may be incomplete. Verify critical steps.
        </p>
      </div>

      {activeConversation && (
        <TicketSummaryDialog
          conversation={activeConversation}
          open={summaryOpen}
          onOpenChange={setSummaryOpen}
        />
      )}
    </div>
  );
}
