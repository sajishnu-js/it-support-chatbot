import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiPrefsState {
  notificationsEnabled: boolean;
  showTimestamps: boolean;
  setNotificationsEnabled: (value: boolean) => void;
  setShowTimestamps: (value: boolean) => void;
}

export const useUiPrefsStore = create<UiPrefsState>()(
  persist(
    (set) => ({
      notificationsEnabled: true,
      showTimestamps: true,
      setNotificationsEnabled: (value) => set({ notificationsEnabled: value }),
      setShowTimestamps: (value) => set({ showTimestamps: value }),
    }),
    { name: "it-support-ui-prefs", skipHydration: true }
  )
);
