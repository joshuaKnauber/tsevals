import type { Reporter, TestCase } from "vitest/node";
import type { TestAnnotation } from "@vitest/runner";
import { SqliteStorage, defaultDbPath } from "./storage.js";
import {
  EVAL_RESULT_SUBMITTED,
  type EvalResultSubmittedPayload,
  type RunArtifact,
} from "./types.js";

export interface EvalReporterOptions {
  dbPath?: string;
  note?: string;
  quiet?: boolean;
}

export class EvalReporter implements Reporter {
  private readonly dbPath: string;
  private readonly note: string | null;
  private readonly quiet: boolean;
  private startedAtMs = 0;
  private startedAtIso = "";
  private readonly resultsByEval = new Map<string, EvalResultSubmittedPayload[]>();
  public lastRunId: string | null = null;

  constructor(options: EvalReporterOptions = {}) {
    this.dbPath = options.dbPath ?? defaultDbPath();
    this.note = options.note?.trim() ? options.note.trim() : null;
    this.quiet = options.quiet ?? false;
  }

  onTestRunStart(): void {
    this.startedAtMs = Date.now();
    this.startedAtIso = new Date(this.startedAtMs).toISOString();
    this.resultsByEval.clear();
  }

  onTestCaseAnnotate(_testCase: TestCase, annotation: TestAnnotation): void {
    if (annotation.type !== EVAL_RESULT_SUBMITTED) return;
    const body = annotation.attachment?.body;
    if (typeof body !== "string") return;

    let payload: EvalResultSubmittedPayload;
    try {
      payload = JSON.parse(body) as EvalResultSubmittedPayload;
    } catch {
      return;
    }

    const list = this.resultsByEval.get(payload.evalName) ?? [];
    list.push(payload);
    this.resultsByEval.set(payload.evalName, list);
  }

  onTestRunEnd(): void {
    const finishedAtMs = Date.now();
    const runId = this.startedAtIso.replace(/[:.]/g, "-");
    const artifact: RunArtifact = {
      runId,
      startedAt: this.startedAtIso,
      finishedAt: new Date(finishedAtMs).toISOString(),
      durationMs: finishedAtMs - this.startedAtMs,
      evals: Array.from(this.resultsByEval.entries()).map(([name, results]) => ({
        name,
        results,
      })),
      note: this.note,
    };

    const storage = new SqliteStorage(this.dbPath);
    try {
      storage.saveRun(artifact);
    } finally {
      storage.close();
    }
    this.lastRunId = runId;
    if (!this.quiet) {
      const noteSuffix = this.note ? ` (version: ${this.note})` : "";
      console.log(`\ntsevals: saved run ${runId}${noteSuffix}`);
    }
  }
}
