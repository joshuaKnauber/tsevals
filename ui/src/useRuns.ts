import { useCallback, useEffect, useState } from "react";
import type { RunArtifact } from "../../src/core/types.js";

export function useRuns(): [RunArtifact[] | null, () => void] {
  const [runs, setRuns] = useState<RunArtifact[] | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((data: RunArtifact[]) => setRuns(data));
  }, [tick]);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  return [runs, refetch];
}
