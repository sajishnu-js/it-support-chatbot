import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_AGENT_CONFIG } from "@/lib/agent-defaults";
import type { AgentConfig } from "@/lib/types";

interface AgentConfigState extends AgentConfig {
  setRole: (value: string) => void;
  setGuardrails: (value: string) => void;
  setMaxSearches: (value: number) => void;
  reset: () => void;
}

/** Kept in the browser rather than on the server: serverless instances share no
 * state, so a per-deployment config would be neither durable nor per-user. The
 * config travels with each run request instead. */
export const useAgentConfigStore = create<AgentConfigState>()(
  persist(
    (set) => ({
      ...DEFAULT_AGENT_CONFIG,
      setRole: (role) => set({ role }),
      setGuardrails: (guardrails) => set({ guardrails }),
      setMaxSearches: (maxSearches) => set({ maxSearches }),
      reset: () => set({ ...DEFAULT_AGENT_CONFIG }),
    }),
    { name: "it-support-agent-config", skipHydration: true }
  )
);
