import { isVersion, meanOfEval, type EvalRunEntry } from "../lib.js";

const VIEW_W = 800;
const VIEW_H = 140;
const PAD_T = 12;
const PAD_R = 12;
const PAD_B = 24;
const PAD_L = 28;

export function ScoreChart({ entries }: { entries: EvalRunEntry[] }) {
  if (entries.length === 0) return null;

  const chronological = [...entries].reverse();
  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = VIEW_H - PAD_T - PAD_B;

  const xs = chronological.map((_, i) =>
    chronological.length === 1
      ? innerW / 2
      : (i / (chronological.length - 1)) * innerW,
  );
  const ys = chronological.map(
    (e) => innerH - Math.max(0, Math.min(1, meanOfEval(e.evalArtifact))) * innerH,
  );

  const points = xs.map((x, i) => `${PAD_L + x},${PAD_T + ys[i]!}`).join(" ");

  return (
    <div className="w-full bg-elevated rounded-lg px-4 py-3">
      <svg
        className="w-full h-[140px] block font-mono"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
      >
        <line
          x1={PAD_L}
          y1={PAD_T}
          x2={VIEW_W - PAD_R}
          y2={PAD_T}
          className="stroke-hairline"
          strokeWidth="1"
        />
        <line
          x1={PAD_L}
          y1={PAD_T + innerH / 2}
          x2={VIEW_W - PAD_R}
          y2={PAD_T + innerH / 2}
          className="stroke-hairline"
          strokeWidth="1"
        />
        <line
          x1={PAD_L}
          y1={PAD_T + innerH}
          x2={VIEW_W - PAD_R}
          y2={PAD_T + innerH}
          className="stroke-hairline"
          strokeWidth="1"
        />

        <text x={PAD_L - 6} y={PAD_T + 4} className="fill-faint" fontSize="9" textAnchor="end">
          1.0
        </text>
        <text
          x={PAD_L - 6}
          y={PAD_T + innerH / 2 + 4}
          className="fill-faint"
          fontSize="9"
          textAnchor="end"
        >
          0.5
        </text>
        <text
          x={PAD_L - 6}
          y={PAD_T + innerH + 4}
          className="fill-faint"
          fontSize="9"
          textAnchor="end"
        >
          0.0
        </text>

        {chronological.length > 1 && (
          <polyline points={points} className="stroke-faint fill-none" strokeWidth="1.25" />
        )}

        {chronological.map((entry, i) => {
          const version = isVersion(entry.run);
          return (
            <g key={entry.run.runId}>
              {version && (
                <line
                  x1={PAD_L + xs[i]!}
                  y1={PAD_T}
                  x2={PAD_L + xs[i]!}
                  y2={PAD_T + innerH}
                  className="stroke-selected"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
              )}
              <circle
                cx={PAD_L + xs[i]!}
                cy={PAD_T + ys[i]!}
                r={version ? 4 : 2.5}
                className={
                  version
                    ? "fill-fg stroke-fg"
                    : "fill-elevated stroke-faint"
                }
                strokeWidth="1.25"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
