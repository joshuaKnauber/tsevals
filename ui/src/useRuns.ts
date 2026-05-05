import { useCallback, useEffect, useState } from "react";
import type { RunArtifact } from "../../src/core/types.js";

const POLL_INTERVAL_MS = 2000;

export function useRuns(): [RunArtifact[] | null, () => void] {
  const [runs, setRuns] = useState<RunArtifact[] | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/runs")
      .then((r) => r.json())
      .then((data: RunArtifact[]) => {
        if (!cancelled) setRuns(data);
      })
      .catch(() => {
        // ignore — server might be reloading
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) refetch();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refetch]);

  return [runs, refetch];
}
