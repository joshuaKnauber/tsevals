import { Fragment, useState } from "react";
import type {
  EvalArtifact,
  RunArtifact,
  ScoreEntry,
} from "../../../src/core/types.js";
import { NoteEditor } from "../components/NoteEditor.js";
import {
  formatTime,
  meanOfEval,
  scoreClass,
  scorerMeans,
  stringify,
} from "../lib.js";
import { navigate } from "../router.js";

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

interface ExpandedKey {
  rowIdx: number;
  scorerName: string;
}

export function RunDetail({
  run,
  evalArtifact,
  onChange,
}: {
  run: RunArtifact;
  evalArtifact: EvalArtifact;
  onChange: () => void;
}) {
  const score = meanOfEval(evalArtifact);
  const perScorer = scorerMeans(evalArtifact);
  const scorerNames = Object.keys(perScorer).sort();
  const [expanded, setExpanded] = useState<ExpandedKey | null>(null);

  const isExpanded = (rowIdx: number, scorerName: string) =>
    expanded?.rowIdx === rowIdx && expanded?.scorerName === scorerName;

  const toggle = (rowIdx: number, scorerName: string) => {
    setExpanded((curr) =>
      curr?.rowIdx === rowIdx && curr?.scorerName === scorerName
        ? null
        : { rowIdx, scorerName },
    );
  };

  const totalCols = 3 + scorerNames.length + 1;

  return (
    <div className="flex flex-col gap-6">
      <button
        className="bg-transparent border-0 text-muted font-sans text-[12px] font-medium cursor-pointer py-1 pr-2 pl-1 rounded self-start -mb-2 transition-colors duration-75 hover:bg-elevated hover:text-fg"
        onClick={() =>
          navigate({ kind: "overview", evalName: evalArtifact.name })
        }
      >
        ← back to {evalArtifact.name}
      </button>

      <header className="flex items-end justify-between gap-8 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="m-0 mb-1.5 text-[22px] font-medium tracking-tight">
            {evalArtifact.name}
          </h1>
          <div className="font-mono text-[11.5px] text-muted tracking-tight">
            {formatTime(run.startedAt)} · {run.runId}
          </div>
          <div className="mt-2 max-w-md">
            <NoteEditor run={run} onChange={onChange} />
          </div>
        </div>
        <div className="flex gap-8">
          <Stat label="score" value={score.toFixed(2)} cls={scoreClass(score)} />
          <Stat
            label="rows"
            value={String(evalArtifact.results.length)}
            cls="good"
          />
          <Stat label="duration" value={`${run.durationMs}ms`} cls="good" />
        </div>
      </header>

      {scorerNames.length > 0 && (
        <div className="flex gap-3 flex-wrap text-[12px]">
          {scorerNames.map((name) => {
            const v = perScorer[name]!;
            const c = scoreClass(v);
            return (
              <div
                key={name}
                className="inline-flex items-center gap-2 bg-elevated px-3 py-1.5 rounded-md"
              >
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${DOT_COLOR[c]}`}
                />
                <span className="text-muted">{name}</span>
                <span
                  className={`font-mono tabular-nums font-medium ${SCORE_COLOR[c]}`}
                >
                  {v.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            <ColHead>input</ColHead>
            <ColHead>output</ColHead>
            <ColHead>expected</ColHead>
            {scorerNames.map((name) => (
              <ColHead key={name} align="right">
                {name}
              </ColHead>
            ))}
            <ColHead align="right">dur</ColHead>
          </tr>
        </thead>
        <tbody>
          {evalArtifact.results.map((result, i) => {
            const expandedScorer =
              expanded?.rowIdx === i ? expanded.scorerName : null;
            const expandedEntry = expandedScorer
              ? result.scores[expandedScorer]
              : undefined;

            return (
              <Fragment key={i}>
                <tr className="hover:[&_td]:bg-elevated transition-colors">
                  <Cell>
                    <pre className="m-0 font-mono text-[12px] leading-snug whitespace-pre-wrap break-words max-w-[40ch]">
                      {stringify(result.input)}
                    </pre>
                  </Cell>
                  <Cell>
                    <pre className="m-0 font-mono text-[12px] leading-snug whitespace-pre-wrap break-words max-w-[40ch]">
                      {stringify(result.output)}
                    </pre>
                  </Cell>
                  <Cell muted>
                    <pre className="m-0 font-mono text-[12px] leading-snug whitespace-pre-wrap break-words max-w-[40ch]">
                      {stringify(result.expected)}
                    </pre>
                  </Cell>
                  {scorerNames.map((name) => {
                    const entry = result.scores[name];
                    if (entry === undefined) {
                      return (
                        <Cell key={name} align="right" muted>
                          —
                        </Cell>
                      );
                    }
                    return (
                      <ScoreCell
                        key={name}
                        entry={entry}
                        isExpanded={isExpanded(i, name)}
                        onToggle={() => toggle(i, name)}
                      />
                    );
                  })}
                  <Cell align="right" muted>
                    <span className="font-mono text-[11.5px] tabular-nums">
                      {result.durationMs.toFixed(2)}ms
                    </span>
                  </Cell>
                </tr>
                {expandedScorer && expandedEntry && (
                  <tr>
                    <td
                      colSpan={totalCols}
                      className="px-3 py-3 border-b border-hairline bg-elevated/50"
                    >
                      <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                        <span className="text-[10.5px] uppercase tracking-wider text-muted font-medium">
                          {expandedScorer}
                        </span>
                        <span className="font-mono text-[11.5px] text-muted tabular-nums">
                          mean {expandedEntry.score.toFixed(3)}
                        </span>
                        {expandedEntry.trials && (
                          <span className="font-mono text-[11.5px] text-muted tabular-nums">
                            stddev {stddev(expandedEntry.trials).toFixed(3)}
                          </span>
                        )}
                      </div>
                      {expandedEntry.trials && (
                        <TrialsView trials={expandedEntry.trials} />
                      )}
                      {expandedEntry.metadata !== undefined &&
                        expandedEntry.metadata !== null && (
                          <div className={expandedEntry.trials ? "mt-3" : ""}>
                            <MetadataView data={expandedEntry.metadata} />
                          </div>
                        )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ScoreCell({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: ScoreEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const c = scoreClass(entry.score);
  const hasMeta = entry.metadata !== undefined && entry.metadata !== null;
  const hasTrials = Array.isArray(entry.trials) && entry.trials.length > 1;
  const expandable = hasMeta || hasTrials;

  return (
    <td className="px-3 py-3 align-top border-b border-hairline text-right">
      <button
        type="button"
        className={`inline-flex items-center justify-end gap-1.5 bg-transparent border-0 p-0 font-sans text-[12.5px] ${
          expandable ? "cursor-pointer hover:text-fg" : "cursor-default"
        }`}
        onClick={() => expandable && onToggle()}
        disabled={!expandable}
      >
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${DOT_COLOR[c]}`}
        />
        <span className={`font-mono tabular-nums ${SCORE_COLOR[c]}`}>
          {entry.score.toFixed(2)}
        </span>
        {hasTrials && (
          <span className="text-faint text-[10px] font-mono">
            ×{entry.trials!.length}
          </span>
        )}
        {expandable && (
          <span className="text-faint text-[10px]">
            {isExpanded ? "▾" : "▸"}
          </span>
        )}
      </button>
    </td>
  );
}

function TrialsView({ trials }: { trials: number[] }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {trials.map((value, i) => {
        const c = scoreClass(value);
        return (
          <span
            key={i}
            className="inline-flex items-center gap-1 bg-canvas border border-hairline rounded px-2 py-1 text-[11px] tabular-nums"
          >
            <span className="text-faint font-mono text-[10px]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              className={`inline-block w-1 h-1 rounded-full ${DOT_COLOR[c]}`}
            />
            <span className={`font-mono ${SCORE_COLOR[c]}`}>
              {value.toFixed(2)}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function MetadataView({ data }: { data: unknown }) {
  if (typeof data === "string") {
    return <p className="m-0 text-[12.5px] leading-relaxed">{data}</p>;
  }
  if (
    typeof data === "object" &&
    data !== null &&
    !Array.isArray(data)
  ) {
    const entries = Object.entries(data as Record<string, unknown>);
    return (
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 m-0 text-[12.5px]">
        {entries.map(([k, v]) => (
          <Fragment key={k}>
            <dt className="text-muted font-mono text-[11.5px] uppercase tracking-wider self-baseline">
              {k}
            </dt>
            <dd className="m-0 leading-relaxed break-words">
              <MetadataValue value={v} />
            </dd>
          </Fragment>
        ))}
      </dl>
    );
  }
  return (
    <pre className="m-0 font-mono text-[12px] leading-snug whitespace-pre-wrap break-words">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function MetadataValue({ value }: { value: unknown }) {
  if (value === null) return <span className="text-faint">null</span>;
  if (typeof value === "string") return <span>{value}</span>;
  if (typeof value === "number" || typeof value === "boolean") {
    return (
      <span className="font-mono tabular-nums">{String(value)}</span>
    );
  }
  return (
    <pre className="m-0 font-mono text-[11.5px] leading-snug whitespace-pre-wrap break-words">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function ColHead({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-2 font-medium text-muted text-[10.5px] uppercase tracking-wider border-b border-hairline ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Cell({
  children,
  align = "left",
  muted = false,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  muted?: boolean;
}) {
  return (
    <td
      className={`px-3 py-3 align-top border-b border-hairline ${
        align === "right" ? "text-right" : ""
      } ${muted ? "text-muted" : ""}`}
    >
      {children}
    </td>
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
