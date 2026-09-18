/**
 * Deployment-wide retrieval settings and question analytics.
 *
 * The Python backend persists analytics to vectorstore/analytics.json. A
 * serverless function has no writable disk and no shared process, so this is
 * in-memory per instance: counts are real but reset when an instance is
 * recycled, and are not shared across concurrent instances. Documented in the
 * README rather than faked with invented numbers.
 */

import type { RecentActivity } from "@/lib/types";

const RECENT_ACTIVITY_LIMIT = 20;

interface ServerState {
  settings: { top_k: number; strict_mode: boolean };
  totalQuestions: number;
  recentActivity: RecentActivity[];
}

// Stashed on globalThis so it survives module re-evaluation between requests
// on the same warm instance.
const globalState = globalThis as unknown as { __itSupportState?: ServerState };

function state(): ServerState {
  if (!globalState.__itSupportState) {
    globalState.__itSupportState = {
      settings: { top_k: 3, strict_mode: true },
      totalQuestions: 0,
      recentActivity: [],
    };
  }
  return globalState.__itSupportState;
}

export function getSettings() {
  return { ...state().settings };
}

export function updateSettings(update: { top_k?: number; strict_mode?: boolean }) {
  const current = state();
  if (typeof update.top_k === "number") {
    current.settings.top_k = Math.max(1, Math.min(8, Math.round(update.top_k)));
  }
  if (typeof update.strict_mode === "boolean") {
    current.settings.strict_mode = update.strict_mode;
  }
  return { ...current.settings };
}

export function recordQuestion(question: string, sourceCount: number) {
  const current = state();
  current.totalQuestions += 1;
  current.recentActivity.unshift({
    question,
    source_count: sourceCount,
    timestamp: new Date().toISOString(),
  });
  current.recentActivity = current.recentActivity.slice(0, RECENT_ACTIVITY_LIMIT);
}

export function getAnalyticsState() {
  const current = state();
  return {
    totalQuestions: current.totalQuestions,
    recentActivity: [...current.recentActivity],
  };
}
