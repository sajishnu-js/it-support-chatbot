"use client";

import { useEffect } from "react";

import { useChatStore } from "@/lib/store/chat-store";
import { useUiPrefsStore } from "@/lib/store/ui-prefs-store";

/** Triggers zustand-persist rehydration after mount for every skipHydration store,
 * so the first client render matches the server instead of racing ahead of hydration. */
export function StoreHydrator() {
  useEffect(() => {
    void useChatStore.persist.rehydrate();
    void useUiPrefsStore.persist.rehydrate();
  }, []);

  return null;
}
