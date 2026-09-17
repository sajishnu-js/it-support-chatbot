"use client";

import { useState } from "react";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { SettingsRow, SettingsSection } from "@/components/settings/settings-section";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { formatDuration } from "@/lib/format";
import { useHealth } from "@/lib/hooks/use-health";
import { useRagSettings } from "@/lib/hooks/use-settings";
import { notify } from "@/lib/notify";
import { useChatStore } from "@/lib/store/chat-store";
import { useUiPrefsStore } from "@/lib/store/ui-prefs-store";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { settings, loading, save } = useRagSettings();
  const { health, online } = useHealth();
  const { theme, setTheme } = useTheme();
  const clearHistory = useChatStore((s) => s.clearHistory);
  const notificationsEnabled = useUiPrefsStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useUiPrefsStore((s) => s.setNotificationsEnabled);
  const showTimestamps = useUiPrefsStore((s) => s.showTimestamps);
  const setShowTimestamps = useUiPrefsStore((s) => s.setShowTimestamps);
  const [confirmClear, setConfirmClear] = useState(false);
  const [localTopK, setLocalTopK] = useState<number | null>(null);

  const topK = localTopK ?? settings?.top_k ?? 3;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6">
      <PageHeader title="Settings" description="Configure retrieval behavior and review system status." />

      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="skeleton-shimmer h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <SettingsSection
            title="AI & Retrieval"
            description="Controls how the assistant retrieves and answers from your Knowledge Base."
          >
            <SettingsRow
              label="Chunks retrieved per question"
              description="Higher values give the model more context, but can dilute relevance."
            >
              <div className="flex w-48 items-center gap-3">
                <Slider
                  value={[topK]}
                  min={1}
                  max={8}
                  step={1}
                  onValueChange={(v) => setLocalTopK(Array.isArray(v) ? v[0] : v)}
                  onValueCommitted={(v) => {
                    const value = Array.isArray(v) ? v[0] : v;
                    void save({ top_k: value });
                  }}
                  className="flex-1"
                />
                <span className="w-4 shrink-0 text-right text-sm font-medium tabular-nums">
                  {topK}
                </span>
              </div>
            </SettingsRow>

            <SettingsRow
              label="Strict mode"
              description={
                settings?.strict_mode
                  ? "Answers only from your indexed documents."
                  : "Answers may supplement gaps with general IT knowledge."
              }
            >
              <Switch
                checked={settings?.strict_mode ?? true}
                onCheckedChange={(checked) => void save({ strict_mode: checked })}
              />
            </SettingsRow>

            <SettingsRow label="LLM provider">
              <Badge variant="secondary">Gemini · {health?.llm_model ?? "…"}</Badge>
            </SettingsRow>
          </SettingsSection>

          <SettingsSection
            title="Knowledge Base"
            description="How your documents are chunked, embedded, and stored."
          >
            <SettingsRow label="Chunk size / overlap">
              <Badge variant="secondary">
                {health?.chunk_size ?? "…"} chars / {health?.chunk_overlap ?? "…"} overlap
              </Badge>
            </SettingsRow>
            <SettingsRow label="Embedding model">
              <Badge variant="secondary">{health?.embedding_model ?? "…"}</Badge>
            </SettingsRow>
            <SettingsRow label="Vector store">
              <Badge variant="secondary">FAISS (local)</Badge>
            </SettingsRow>
            <SettingsRow label="Documents / chunks indexed">
              <Badge variant="secondary">
                {health?.documents_count ?? 0} / {health?.indexed_chunks ?? 0}
              </Badge>
            </SettingsRow>
          </SettingsSection>

          <SettingsSection title="Chat & notifications" description="Personalize the chat experience.">
            <SettingsRow
              label="Show timestamps"
              description="Display the time each message was sent."
            >
              <Switch checked={showTimestamps} onCheckedChange={setShowTimestamps} />
            </SettingsRow>
            <SettingsRow
              label="Enable notifications"
              description="Toast confirmations for uploads, deletes, and index rebuilds. Errors always show."
            >
              <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
            </SettingsRow>
          </SettingsSection>

          <SettingsSection title="Appearance" description="Personalize how TechCore IT looks.">
            <SettingsRow label="Theme">
              <div className="flex items-center gap-1 rounded-lg border border-border p-1">
                {(
                  [
                    { key: "light", icon: Sun, label: "Light" },
                    { key: "dark", icon: Moon, label: "Dark" },
                    { key: "system", icon: Laptop, label: "System" },
                  ] as const
                ).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTheme(key)}
                    aria-label={label}
                    aria-pressed={theme === key}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      theme === key
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </SettingsRow>
          </SettingsSection>

          <SettingsSection
            title="System"
            description="Live connection status for the backend and LLM provider."
          >
            <SettingsRow label="Backend API">
              <StatusBadge ok={online} okLabel="Connected" badLabel="Unreachable" />
            </SettingsRow>
            <SettingsRow label="Vector store">
              <StatusBadge
                ok={!!health?.vectorstore_ready}
                okLabel="FAISS ready"
                badLabel="Not built"
              />
            </SettingsRow>
            <SettingsRow label="Gemini API key">
              <StatusBadge
                ok={!!health?.gemini_api_key_configured}
                okLabel="Configured"
                badLabel="Not configured"
              />
            </SettingsRow>
            <SettingsRow label="Backend uptime">
              <Badge variant="secondary">
                {health ? formatDuration(health.uptime_seconds) : "…"}
              </Badge>
            </SettingsRow>
          </SettingsSection>

          <SettingsSection title="Danger zone" description="These actions cannot be undone.">
            <SettingsRow
              label="Clear conversation history"
              description="Deletes all locally stored chats on this device."
            >
              <Button variant="destructive" onClick={() => setConfirmClear(true)}>
                Clear history
              </Button>
            </SettingsRow>
          </SettingsSection>
        </>
      )}

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all conversation history?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every chat stored on this device. The Knowledge Base itself
              is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                clearHistory();
                notify.success("Conversation history cleared");
              }}
            >
              Clear history
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusBadge({
  ok,
  okLabel,
  badLabel,
}: {
  ok: boolean;
  okLabel: string;
  badLabel: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      )}
    >
      <span className={cn("mr-1 size-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-destructive")} />
      {ok ? okLabel : badLabel}
    </Badge>
  );
}
