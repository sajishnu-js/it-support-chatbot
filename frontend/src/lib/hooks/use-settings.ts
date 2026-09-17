"use client";

import { useCallback, useEffect, useState } from "react";

import { getSettings, updateSettings } from "@/lib/api";
import type { RagSettings } from "@/lib/types";

export function useRagSettings() {
  const [settings, setSettings] = useState<RagSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getSettings();
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (update: Partial<RagSettings>) => {
    setSaving(true);
    setSettings((prev) => (prev ? { ...prev, ...update } : prev));
    try {
      const data = await updateSettings(update);
      setSettings(data);
      return data;
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, loading, saving, error, save };
}
