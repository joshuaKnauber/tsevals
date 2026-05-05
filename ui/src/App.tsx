import { useEffect, useState } from "react";
import type { RunArtifact } from "../../src/core/types.js";

export function App() {
  const [runs, setRuns] = useState<RunArtifact[] | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((data: RunArtifact[]) => {
        setRuns(data);
        if (data[0]) setSelectedRunId(data[0].runId);
      });
  }, []);

  if (runs === null) {
    return <div className="empty">loading…</div>;
  }

  if (runs.length === 0) {
    return (
      <div className="empty">
        <p>no runs yet.</p>
        <p>
          run <code>npx typed-evals run</code> first.
        </p>
      </div>
    );
  }

  const selectedRun = runs.find((r) => r.runId === selectedRunId) ?? runs[0]!;

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>typed-evals</h1>
        <ul className="runs-list">
          {runs.map((run) => (
            <li
              key={run.runId}
              className={run.runId === selectedRun.runId ? "selected" : ""}
              onClick={() => setSelectedRunId(run.runId)}
            >
              <div className="run-time">{formatTime(run.startedAt)}</div>
              <div className="run-meta">
                {run.evals.length} eval{run.evals.length === 1 ? "" : "s"} ·{" "}
                {run.durationMs}ms
              </div>
            </li>
          ))}
        </ul>
      </aside>
      <main className="detail">
        <RunDetail run={selectedRun} />
      </main>
    </div>
  );
}

function RunDetail({ run }: { run: RunArtifact }) {
  return (
    <div>
      <header className="run-header">
        <div className="run-id">{run.runId}</div>
        <div className="run-stats">
          {new Date(run.startedAt).toLocaleString()} · {run.durationMs}ms
        </div>
      </header>
      {run.evals.map((evalArtifact) => (
        <section key={evalArtifact.name} className="eval-section">
          <h2>{evalArtifact.name}</h2>
          <table>
            <thead>
              <tr>
                <th>input</th>
                <th>output</th>
                <th>expected</th>
                <th>scores</th>
                <th>duration</th>
              </tr>
            </thead>
            <tbody>
              {evalArtifact.results.map((result, i) => (
                <tr key={i}>
                  <td>
                    <pre>{stringify(result.input)}</pre>
                  </td>
                  <td>
                    <pre>{stringify(result.output)}</pre>
                  </td>
                  <td>
                    <pre>{stringify(result.expected)}</pre>
                  </td>
                  <td>
                    {Object.entries(result.scores).map(([name, value]) => (
                      <div key={name} className="score">
                        <span className="score-name">{name}</span>
                        <span className={scoreClass(value)}>{value.toFixed(2)}</span>
                      </div>
                    ))}
                  </td>
                  <td className="duration">{result.durationMs.toFixed(2)}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stringify(value: unknown): string {
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function scoreClass(value: number): string {
  if (value >= 0.8) return "score-good";
  if (value >= 0.5) return "score-mid";
  return "score-bad";
}
