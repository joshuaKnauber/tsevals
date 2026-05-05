import type {
  EvalArtifact,
  RunArtifact,
} from "../../src/core/types.js";

export interface EvalRunEntry {
  run: RunArtifact;
  evalArtifact: EvalArtifact;
}

export interface EvalSummary {
  name: string;
  entries: EvalRunEntry[];
  versionCount: number;
}

export function isVersion(run: RunArtifact): boolean {
  return typeof run.note === "string" && run.note.trim() !== "";
}

export function groupByEval(runs: RunArtifact[]): EvalSummary[] {
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
  return Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function meanOfEval(evalArtifact: EvalArtifact): number {
  const all = evalArtifact.results.flatMap((r) =>
    Object.values(r.scores).map((s) => s.score),
  );
  return all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
}

export function meanOfEntries(entries: EvalRunEntry[]): number {
  const all = entries.flatMap((e) =>
    e.evalArtifact.results.flatMap((r) =>
      Object.values(r.scores).map((s) => s.score),
    ),
  );
  return all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
}

export function scorerMeans(evalArtifact: EvalArtifact): Record<string, number> {
  const sums = new Map<string, { sum: number; count: number }>();
  for (const result of evalArtifact.results) {
    for (const [name, entry] of Object.entries(result.scores)) {
      const acc = sums.get(name) ?? { sum: 0, count: 0 };
      acc.sum += entry.score;
      acc.count += 1;
      sums.set(name, acc);
    }
  }
  const out: Record<string, number> = {};
  for (const [name, { sum, count }] of sums) {
    out[name] = count > 0 ? sum / count : 0;
  }
  return out;
}

export function findPreviousVersion(
  entries: EvalRunEntry[],
  fromIndex: number,
): EvalRunEntry | null {
  for (let i = fromIndex + 1; i < entries.length; i++) {
    if (isVersion(entries[i]!.run)) return entries[i]!;
  }
  return null;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function stringify(value: unknown): string {
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export function scoreClass(value: number): string {
  if (value >= 0.8) return "good";
  if (value >= 0.5) return "mid";
  return "bad";
}
