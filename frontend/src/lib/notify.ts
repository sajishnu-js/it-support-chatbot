import { toast } from "sonner";

import { useUiPrefsStore } from "@/lib/store/ui-prefs-store";

/** Wraps sonner so the Settings → Notifications toggle actually gates non-critical
 * toasts. Errors always surface — they need attention regardless of the preference. */
export const notify = {
  success: (message: string, opts?: Parameters<typeof toast.success>[1]) => {
    if (useUiPrefsStore.getState().notificationsEnabled) {
      toast.success(message, opts);
    }
  },
  error: (message: string, opts?: Parameters<typeof toast.error>[1]) => {
    toast.error(message, opts);
  },
};
