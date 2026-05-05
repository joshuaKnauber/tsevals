import { defaultDbPath, SqliteStorage } from "../core/storage.js";
import type {
  EvalArtifact,
  RunArtifact,
} from "../core/types.js";

export function isVersion(run: RunArtifact): boolean {
  return typeof run.note === "string" && run.note.trim() !== "";
}

export function resolveRun(
  runs: RunArtifact[],
  ref: string,
): RunArtifact | null {
  if (ref === "latest") return runs[0] ?? null;
  if (ref === "prev-version") {
    const latestId = runs[0]?.runId;
    return (
      runs.find((r) => isVersion(r) && r.runId !== latestId) ?? null
    );
  }
  return runs.find((r) => r.runId === ref) ?? null;
}

export function loadRuns(dbPath?: string): RunArtifact[] {
  const storage = new SqliteStorage(dbPath ?? defaultDbPath());
  try {
    return storage.getRuns();
  } finally {
    storage.close();
  }
}

export interface ScorerSummary {
  score: number;
  rowCount: number;
}

export interface EvalSummary {
  name: string;
  rowCount: number;
  score: number;
  scorers: Record<string, number>;
}

export interface RunSummary {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  note: string | null;
  score: number;
  evals: EvalSummary[];
}

export function summarizeEval(evalArtifact: EvalArtifact): EvalSummary {
  const sums = new Map<string, { sum: number; count: number }>();
  let allSum = 0;
  let allCount = 0;
  for (const result of evalArtifact.results) {
    for (const [name, entry] of Object.entries(result.scores)) {
      const acc = sums.get(name) ?? { sum: 0, count: 0 };
      acc.sum += entry.score;
      acc.count += 1;
      sums.set(name, acc);
      allSum += entry.score;
      allCount += 1;
    }
  }
  const scorers: Record<string, number> = {};
  for (const [name, { sum, count }] of sums) {
    scorers[name] = count > 0 ? sum / count : 0;
  }
  return {
    name: evalArtifact.name,
    rowCount: evalArtifact.results.length,
    score: allCount > 0 ? allSum / allCount : 0,
    scorers,
  };
}

export function summarizeRun(run: RunArtifact): RunSummary {
  const evals = run.evals.map(summarizeEval);
  const allScores = run.evals.flatMap((e) =>
    e.results.flatMap((r) => Object.values(r.scores).map((s) => s.score)),
  );
  const score = allScores.length
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length
    : 0;
  return {
    runId: run.runId,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    durationMs: run.durationMs,
    note: run.note ?? null,
    score,
    evals,
  };
}

export interface ScorerDiff {
  from: number;
  to: number;
  delta: number;
}

export interface EvalDiff {
  name: string;
  rowCount: { from: number; to: number };
  fromScore: number;
  toScore: number;
  delta: number;
  scorers: Record<string, ScorerDiff>;
}

export interface RunDiff {
  from: { runId: string; note: string | null; startedAt: string };
  to: { runId: string; note: string | null; startedAt: string };
  scoreDelta: number;
  evals: EvalDiff[];
  hasRegression: boolean;
}

export function diffRuns(from: RunArtifact, to: RunArtifact): RunDiff {
  const fromSummary = summarizeRun(from);
  const toSummary = summarizeRun(to);
  const fromByName = new Map(fromSummary.evals.map((e) => [e.name, e]));
  const toByName = new Map(toSummary.evals.map((e) => [e.name, e]));
  const evalNames = new Set([...fromByName.keys(), ...toByName.keys()]);

  let regressed = false;
  const evals: EvalDiff[] = [];
  for (const name of evalNames) {
    const f = fromByName.get(name);
    const t = toByName.get(name);
    const fromScore = f?.score ?? 0;
    const toScore = t?.score ?? 0;
    const scorerNames = new Set([
      ...Object.keys(f?.scorers ?? {}),
      ...Object.keys(t?.scorers ?? {}),
    ]);
    const scorers: Record<string, ScorerDiff> = {};
    for (const sn of scorerNames) {
      const fv = f?.scorers[sn] ?? 0;
      const tv = t?.scorers[sn] ?? 0;
      const delta = tv - fv;
      scorers[sn] = { from: fv, to: tv, delta };
      if (delta < -0.001) regressed = true;
    }
    const evalDelta = toScore - fromScore;
    if (evalDelta < -0.001) regressed = true;
    evals.push({
      name,
      rowCount: { from: f?.rowCount ?? 0, to: t?.rowCount ?? 0 },
      fromScore,
      toScore,
      delta: evalDelta,
      scorers,
    });
  }

  return {
    from: { runId: from.runId, note: from.note ?? null, startedAt: from.startedAt },
    to: { runId: to.runId, note: to.note ?? null, startedAt: to.startedAt },
    scoreDelta: toSummary.score - fromSummary.score,
    evals,
    hasRegression: regressed,
  };
}
