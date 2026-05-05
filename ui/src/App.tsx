import { useMemo } from "react";
import type { RunArtifact } from "../../src/core/types.js";
import { Sidebar } from "./components/Sidebar.js";
import { groupByEval } from "./lib.js";
import { EvalOverview } from "./pages/EvalOverview.js";
import { RunDetail } from "./pages/RunDetail.js";
import { useRoute } from "./router.js";
import { useRuns } from "./useRuns.js";

export function App() {
  const [runs, refetch] = useRuns();
  const route = useRoute();
  const evals = useMemo(() => groupByEval(runs ?? []), [runs]);

  if (runs === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted">
        loading…
      </div>
    );
  }

  if (evals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted gap-2">
        <p>no evals yet</p>
        <p>
          run{" "}
          <code className="bg-elevated px-2 py-1 rounded font-mono text-[12.5px]">
            npx typed-evals run
          </code>{" "}
          to populate.
        </p>
      </div>
    );
  }

  if (route.kind === "run") {
    const run = findRun(runs, route.runId);
    if (!run) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted">
          <p>
            run not found:{" "}
            <code className="font-mono text-[12.5px]">{route.runId}</code>
          </p>
        </div>
      );
    }
    const evalArtifact =
      (route.evalName
        ? run.evals.find((e) => e.name === route.evalName)
        : undefined) ?? run.evals[0];
    if (!evalArtifact) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted">
          <p>this run has no evals</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-[280px_1fr] h-screen">
        <Sidebar evals={evals} selectedEval={evalArtifact.name} />
        <main className="overflow-y-auto px-12 py-10">
          <RunDetail
            run={run}
            evalArtifact={evalArtifact}
            onChange={refetch}
          />
        </main>
      </div>
    );
  }

  const selected =
    evals.find((e) => e.name === route.evalName) ?? evals[0]!;

  return (
    <div className="grid grid-cols-[280px_1fr] h-screen">
      <Sidebar evals={evals} selectedEval={selected.name} />
      <main className="overflow-y-auto px-12 py-10">
        <EvalOverview summary={selected} onChange={refetch} />
      </main>
    </div>
  );
}

function findRun(runs: RunArtifact[], runId: string): RunArtifact | null {
  return runs.find((r) => r.runId === runId) ?? null;
}
