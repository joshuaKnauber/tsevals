import { useEffect, useMemo, useState } from "react";
import type {
  EvalArtifact,
  EvalResultSubmittedPayload,
  RunArtifact,
} from "../../src/core/types.js";
import { useRuns } from "./useRuns.js";

type Filter = "all" | "versions";

interface EvalRunEntry {
  run: RunArtifact;
  evalArtifact: EvalArtifact;
}

interface EvalSummary {
  name: string;
  entries: EvalRunEntry[];
  versionCount: number;
}

function isVersion(run: RunArtifact): boolean {
  return typeof run.note === "string" && run.note.trim() !== "";
}

export function App() {
  const [runs, refetch] = useRuns();
  const [selectedEval, setSelectedEval] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const evals = useMemo(() => groupByEval(runs ?? []), [runs]);

  if (runs === null) {
    return <div className="empty">loading…</div>;
  }

  if (evals.length === 0) {
    return (
      <div className="empty">
        <p>no evals yet</p>
        <p>
          run <code>npx typed-evals run</code> to populate.
        </p>
      </div>
    );
  }

  const visibleEvals = evals.map((e) => ({
    ...e,
    entries:
      filter === "versions"
        ? e.entries.filter((entry) => isVersion(entry.run))
        : e.entries,
  }));

  const selected =
    visibleEvals.find((e) => e.name === selectedEval && e.entries.length > 0) ??
    visibleEvals.find((e) => e.entries.length > 0) ??
    visibleEvals[0]!;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">typed-evals</span>
          <FilterToggle value={filter} onChange={setFilter} />
        </div>
        <ul className="list">
          {visibleEvals.map((e) => (
            <li
              key={e.name}
              className={e.name === selected.name ? "selected" : ""}
              onClick={() => setSelectedEval(e.name)}
            >
              <div className="row-main">
                <span className="row-title">{e.name}</span>
                <span className="row-trail mono">
                  {e.entries.length
                    ? meanOfEntries(e.entries).toFixed(2)
                    : "—"}
                </span>
              </div>
              <div className="row-meta mono">
                {filter === "versions"
                  ? `${e.entries.length} version${e.entries.length === 1 ? "" : "s"}`
                  : `${e.entries.length} run${e.entries.length === 1 ? "" : "s"} · ${e.versionCount} version${e.versionCount === 1 ? "" : "s"}`}
              </div>
            </li>
          ))}
        </ul>
      </aside>
      <main className="detail">
        {selected.entries.length === 0 ? (
          <div className="empty">
            <p>no {filter === "versions" ? "versions" : "runs"} for {selected.name}</p>
            <p className="dim">
              {filter === "versions"
                ? "tag a run with a note to mark it as a version"
                : "run typed-evals to populate"}
            </p>
          </div>
        ) : (
          <EvalDetail summary={selected} onChange={refetch} />
        )}
      </main>
    </div>
  );
}

function FilterToggle({
  value,
  onChange,
}: {
  value: Filter;
  onChange: (v: Filter) => void;
}) {
  return (
    <div className="filter">
      <button
        className={value === "all" ? "active" : ""}
        onClick={() => onChange("all")}
      >
        all
      </button>
      <button
        className={value === "versions" ? "active" : ""}
        onClick={() => onChange("versions")}
      >
        versions
      </button>
    </div>
  );
}

function EvalDetail({
  summary,
  onChange,
}: {
  summary: EvalSummary;
  onChange: () => void;
}) {
  const stats = useMemo(() => summarizeEval(summary), [summary]);

  return (
    <div>
      <header className="detail-header">
        <div>
          <h1 className="detail-title">{summary.name}</h1>
          <div className="detail-id">
            {summary.entries.length} run
            {summary.entries.length === 1 ? "" : "s"} · {stats.totalRows} rows
            total
          </div>
        </div>
        <div className="stats">
          <div>
            <div className="stat-label">avg</div>
            <div className={`stat-value ${scoreClass(stats.avg)}`}>
              {stats.avg.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="stat-label">latest</div>
            <div className={`stat-value ${scoreClass(stats.latest)}`}>
              {stats.latest.toFixed(2)}
            </div>
          </div>
          {stats.latestVsVersion !== null &&
            Math.abs(stats.latestVsVersion) > 0.001 && (
              <div>
                <div className="stat-label">Δ vs prev version</div>
                <div
                  className={`stat-value ${stats.latestVsVersion < 0 ? "bad" : ""}`}
                >
                  {stats.latestVsVersion > 0 ? "+" : ""}
                  {stats.latestVsVersion.toFixed(2)}
                </div>
              </div>
            )}
        </div>
      </header>

      {summary.entries.map((entry, i) => {
        const score = meanOfEval(entry.evalArtifact);
        const prevVersion = findPreviousVersion(summary.entries, i);
        const delta =
          prevVersion !== null
            ? score - meanOfEval(prevVersion.evalArtifact)
            : null;
        return (
          <RunBlock
            key={entry.run.runId}
            entry={entry}
            score={score}
            delta={delta}
            onChange={onChange}
          />
        );
      })}
    </div>
  );
}

function RunBlock({
  entry,
  score,
  delta,
  onChange,
}: {
  entry: EvalRunEntry;
  score: number;
  delta: number | null;
  onChange: () => void;
}) {
  const { run, evalArtifact } = entry;
  return (
    <section className={`eval-section ${isVersion(run) ? "is-version" : ""}`}>
      <h2>
        <div className="run-block-title">
          <span>{formatTime(run.startedAt)}</span>
          <NoteEditor run={run} onChange={onChange} />
        </div>
        <span className="meta">
          <span className={`mono ${scoreClass(score)}`}>{score.toFixed(2)}</span>
          {delta !== null && Math.abs(delta) > 0.001 && (
            <span className={`mono ${delta < 0 ? "bad" : "dim"}`}>
              {delta > 0 ? "+" : ""}
              {delta.toFixed(2)}
            </span>
          )}
          <span className="mono">{evalArtifact.results.length} rows</span>
          <span className="mono">{run.durationMs}ms</span>
        </span>
      </h2>
      <table>
        <thead>
          <tr>
            <th>input</th>
            <th>output</th>
            <th>expected</th>
            <th>scores</th>
            <th style={{ textAlign: "right" }}>dur</th>
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
              <td className="dim">
                <pre>{stringify(result.expected)}</pre>
              </td>
              <td>
                <div className="scores">
                  {Object.entries(result.scores).map(([name, value]) => (
                    <div className="score" key={name}>
                      <span className={`score-dot ${scoreClass(value)}`} />
                      <span className="score-name">{name}</span>
                      <span className={`score-value ${scoreClass(value)}`}>
                        {value.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </td>
              <td className="duration">{result.durationMs.toFixed(2)}ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function NoteEditor({
  run,
  onChange,
}: {
  run: RunArtifact;
  onChange: () => void;
}) {
  const [value, setValue] = useState(run.note ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(run.note ?? "");
  }, [run.note]);

  const persist = async (next: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(run.runId)}/note`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: next }),
      });
      if (!res.ok) throw new Error("failed");
      onChange();
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      type="text"
      className={`note-input ${isVersion(run) ? "has-note" : ""}`}
      placeholder="+ note to mark as version"
      value={value}
      disabled={saving}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== (run.note ?? "")) persist(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setValue(run.note ?? "");
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function findPreviousVersion(
  entries: EvalRunEntry[],
  fromIndex: number,
): EvalRunEntry | null {
  for (let i = fromIndex + 1; i < entries.length; i++) {
    if (isVersion(entries[i]!.run)) return entries[i]!;
  }
  return null;
}

function groupByEval(runs: RunArtifact[]): EvalSummary[] {
  const byName = new Map<string, EvalSummary>();
  for (const run of runs) {
    for (const evalArtifact of run.evals) {
      let summary = byName.get(evalArtifact.name);
      if (!summary) {
        summary = { name: evalArtifact.name, entries: [], versionCount: 0 };
        byName.set(evalArtifact.name, summary);
      }
      summary.entries.push({ run, evalArtifact });
      if (isVersion(run)) summary.versionCount += 1;
    }
  }
  for (const summary of byName.values()) {
    summary.entries.sort((a, b) =>
      b.run.startedAt.localeCompare(a.run.startedAt),
    );
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function summarizeEval(summary: EvalSummary) {
  const allResults: EvalResultSubmittedPayload[] = summary.entries.flatMap(
    (e) => e.evalArtifact.results,
  );
  const allScores = allResults.flatMap((r) => Object.values(r.scores));
  const avg = allScores.length
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length
    : 0;

  const latestEntry = summary.entries[0];
  const latest = latestEntry ? meanOfEval(latestEntry.evalArtifact) : 0;

  let latestVsVersion: number | null = null;
  if (latestEntry) {
    const startIdx = isVersion(latestEntry.run) ? 1 : 0;
    for (let i = startIdx; i < summary.entries.length; i++) {
      const candidate = summary.entries[i]!;
      if (isVersion(candidate.run) && candidate.run.runId !== latestEntry.run.runId) {
        latestVsVersion = latest - meanOfEval(candidate.evalArtifact);
        break;
      }
    }
  }

  return {
    avg,
    latest,
    latestVsVersion,
    totalRows: allResults.length,
  };
}

function meanOfEntries(entries: EvalRunEntry[]): number {
  const all = entries.flatMap((e) =>
    e.evalArtifact.results.flatMap((r) => Object.values(r.scores)),
  );
  return all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
}

function meanOfEval(evalArtifact: EvalArtifact): number {
  const all = evalArtifact.results.flatMap((r) => Object.values(r.scores));
  return all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
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
  if (value >= 0.8) return "good";
  if (value >= 0.5) return "mid";
  return "bad";
}
