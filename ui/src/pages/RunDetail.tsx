import type {
  EvalArtifact,
  RunArtifact,
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
          <Stat
            label="score"
            value={score.toFixed(2)}
            cls={scoreClass(score)}
          />
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
          {evalArtifact.results.map((result, i) => (
            <tr
              key={i}
              className="hover:[&_td]:bg-elevated transition-colors"
            >
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
                const v = result.scores[name];
                if (v === undefined) {
                  return (
                    <Cell key={name} align="right" muted>
                      —
                    </Cell>
                  );
                }
                const c = scoreClass(v);
                return (
                  <Cell key={name} align="right">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full ${DOT_COLOR[c]}`}
                      />
                      <span
                        className={`font-mono tabular-nums ${SCORE_COLOR[c]}`}
                      >
                        {v.toFixed(2)}
                      </span>
                    </div>
                  </Cell>
                );
              })}
              <Cell align="right" muted>
                <span className="font-mono text-[11.5px] tabular-nums">
                  {result.durationMs.toFixed(2)}ms
                </span>
              </Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
