"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getHealth } from "@/lib/api";
import type { HealthStatus } from "@/lib/types";

const POLL_INTERVAL_MS = 30_000;

export function useHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const result = await getHealth();
      if (mounted.current) {
        setHealth(result);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) {
        setHealth(null);
        setError(err instanceof Error ? err.message : "Unable to reach the backend.");
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [refresh]);

  return { health, error, loading, online: !error && !!health, refresh };
}
