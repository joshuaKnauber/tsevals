import { useMemo } from "react";
import { NoteEditor } from "../components/NoteEditor.js";
import { ScoreChart } from "../components/ScoreChart.js";
import {
  findPreviousVersion,
  isVersion,
  meanOfEval,
  scoreClass,
  scorerMeans,
  type EvalRunEntry,
  type EvalSummary,
} from "../lib.js";
import { navigate } from "../router.js";
import { useLocalStorage } from "../useLocalStorage.js";

type Filter = "all" | "versions";

const SCORE_COLOR: Record<string, string> = {
  good: "text-fg",
  mid: "text-warning",
  bad: "text-error",
};

const DOT_COLOR: Record<string, string> = {
  good: "bg-faint",
  mid: "bg-warning",
  bad: "bg-error",
};

export function EvalOverview({
  summary,
  onChange,
}: {
  summary: EvalSummary;
  onChange: () => void;
}) {
  const [filter, setFilter] = useLocalStorage<Filter>(
    "typed-evals.overview.filter",
    "all",
  );
  const stats = useMemo(() => summarize(summary), [summary]);

  if (summary.entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted">
        <p>no runs for {summary.name}</p>
      </div>
    );
  }

  const filteredEntries: EvalRunEntry[] =
    filter === "versions"
      ? summary.entries.filter((e) => isVersion(e.run))
      : summary.entries;

  const allScorerNames = collectScorerNames(summary);

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4 flex items-end justify-between gap-8 flex-wrap">
        <div>
          <h1 className="m-0 mb-1.5 text-[22px] font-medium tracking-tight">
            {summary.name}
          </h1>
          <div className="font-mono text-[11.5px] text-muted tracking-tight">
            {summary.entries.length} run
            {summary.entries.length === 1 ? "" : "s"} ·{" "}
            {summary.versionCount} version
            {summary.versionCount === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex gap-8">
          <Stat label="avg" value={stats.avg.toFixed(2)} cls={scoreClass(stats.avg)} />
          <Stat
            label="latest"
            value={stats.latest.toFixed(2)}
            cls={scoreClass(stats.latest)}
          />
          {stats.latestVsVersion !== null &&
            Math.abs(stats.latestVsVersion) > 0.001 && (
              <Stat
                label="Δ vs prev version"
                value={`${stats.latestVsVersion > 0 ? "+" : ""}${stats.latestVsVersion.toFixed(2)}`}
                cls={stats.latestVsVersion < 0 ? "bad" : "neutral"}
              />
            )}
        </div>
      </header>

      <ScoreChart entries={filteredEntries} />

      <div className="flex items-center justify-between gap-3 mt-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {filteredEntries.length} {filter === "versions" ? "version" : "run"}
          {filteredEntries.length === 1 ? "" : "s"}
        </span>
        <FilterToggle value={filter} onChange={setFilter} />
      </div>

      {filteredEntries.length === 0 ? (
        <div className="text-muted text-[13px] py-8 text-center bg-elevated rounded-lg">
          no versions yet — add a note to a run to mark it as one
        </div>
      ) : (
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            <th className="w-6 text-left px-3 py-2 font-medium text-muted text-[10.5px] uppercase tracking-wider border-b border-hairline"></th>
            <th className="text-left px-3 py-2 font-medium text-muted text-[10.5px] uppercase tracking-wider border-b border-hairline">
              time
            </th>
            <th className="text-left px-3 py-2 font-medium text-muted text-[10.5px] uppercase tracking-wider border-b border-hairline">
              note
            </th>
            <th className="text-right px-3 py-2 font-medium text-muted text-[10.5px] uppercase tracking-wider border-b border-hairline">
              score
            </th>
            <th className="text-right px-3 py-2 font-medium text-muted text-[10.5px] uppercase tracking-wider border-b border-hairline">
              Δ ver
            </th>
            {allScorerNames.length > 1 && (
              <th className="text-left px-3 py-2 font-medium text-muted text-[10.5px] uppercase tracking-wider border-b border-hairline">
                scorers
              </th>
            )}
            <th className="text-right px-3 py-2 font-medium text-muted text-[10.5px] uppercase tracking-wider border-b border-hairline">
              rows
            </th>
            <th className="text-right px-3 py-2 font-medium text-muted text-[10.5px] uppercase tracking-wider border-b border-hairline">
              dur
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredEntries.map((entry, i) => {
            const score = meanOfEval(entry.evalArtifact);
            const idxInAll = summary.entries.indexOf(entry);
            const prevVersion = findPreviousVersion(summary.entries, idxInAll);
            const delta =
              prevVersion !== null
                ? score - meanOfEval(prevVersion.evalArtifact)
                : null;
            const perScorer = scorerMeans(entry.evalArtifact);
            const cls = scoreClass(score);
            return (
              <tr
                key={entry.run.runId}
                className="cursor-pointer transition-colors duration-75 hover:[&_td]:bg-elevated group"
                onClick={() =>
                  navigate({
                    kind: "run",
                    runId: entry.run.runId,
                    evalName: summary.name,
                  })
                }
              >
                <td className="px-3 py-2.5 align-middle border-b border-hairline">
                  {isVersion(entry.run) && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-fg" />
                  )}
                </td>
                <td className="px-3 py-2.5 align-middle border-b border-hairline font-mono">
                  {shortTime(entry.run.startedAt)}
                </td>
                <td
                  className="px-3 py-2.5 align-middle border-b border-hairline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <NoteEditor run={entry.run} onChange={onChange} />
                </td>
                <td
                  className={`px-3 py-2.5 align-middle border-b border-hairline font-mono text-right tabular-nums ${SCORE_COLOR[cls]}`}
                >
                  {score.toFixed(2)}
                </td>
                <td className="px-3 py-2.5 align-middle border-b border-hairline font-mono text-right tabular-nums">
                  {delta !== null && Math.abs(delta) > 0.001 ? (
                    <span className={delta < 0 ? "text-error" : "text-muted"}>
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                {allScorerNames.length > 1 && (
                  <td className="px-3 py-2.5 align-middle border-b border-hairline">
                    <div className="flex gap-2 flex-wrap">
                      {allScorerNames.map((name) => {
                        const v = perScorer[name];
                        const c = v === undefined ? "good" : scoreClass(v);
                        return (
                          <span
                            key={name}
                            className="inline-flex items-center gap-1 text-[11px] text-muted tabular-nums"
                          >
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full ${DOT_COLOR[c]}`}
                            />
                            <span className="font-mono">
                              {v === undefined ? "—" : v.toFixed(2)}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </td>
                )}
                <td className="px-3 py-2.5 align-middle border-b border-hairline font-mono text-right tabular-nums text-muted">
                  {entry.evalArtifact.results.length}
                </td>
                <td className="px-3 py-2.5 align-middle border-b border-hairline font-mono text-right tabular-nums text-muted">
                  {entry.run.durationMs}ms
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      )}
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
    <div className="inline-flex bg-elevated rounded-md p-0.5 text-[11px]">
      <button
        className={`bg-transparent border-0 px-2.5 py-1 rounded cursor-pointer text-[11px] font-medium transition-colors duration-75 ${
          value === "all" ? "bg-selected text-fg" : "text-muted hover:text-fg"
        }`}
        onClick={() => onChange("all")}
      >
        all
      </button>
      <button
        className={`bg-transparent border-0 px-2.5 py-1 rounded cursor-pointer text-[11px] font-medium transition-colors duration-75 ${
          value === "versions"
            ? "bg-selected text-fg"
            : "text-muted hover:text-fg"
        }`}
        onClick={() => onChange("versions")}
      >
        versions only
      </button>
    </div>
  );
}

function Stat({
  label,
  value,
  cls,
}: {
  label: string;
  value: string;
  cls: string;
}) {
  const colorClass =
    cls === "bad"
      ? "text-error"
      : cls === "mid"
        ? "text-warning"
        : "text-fg";
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-muted mb-1 font-medium">
        {label}
      </div>
      <div
        className={`text-[18px] font-medium tracking-tight tabular-nums font-mono ${colorClass}`}
      >
        {value}
      </div>
    </div>
  );
}

function summarize(summary: EvalSummary) {
  const allScores = summary.entries.flatMap((e) =>
    e.evalArtifact.results.flatMap((r) =>
      Object.values(r.scores).map((s) => s.score),
    ),
  );
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
      if (
        isVersion(candidate.run) &&
        candidate.run.runId !== latestEntry.run.runId
      ) {
        latestVsVersion = latest - meanOfEval(candidate.evalArtifact);
        break;
      }
    }
  }

  return { avg, latest, latestVsVersion };
}

function collectScorerNames(summary: EvalSummary): string[] {
  const set = new Set<string>();
  for (const entry of summary.entries) {
    for (const result of entry.evalArtifact.results) {
      for (const name of Object.keys(result.scores)) set.add(name);
    }
  }
  return Array.from(set).sort();
}

function shortTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} ${d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
