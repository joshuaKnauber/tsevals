import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Reporter, TestCase } from "vitest/node";
import type { TestAnnotation } from "@vitest/runner";
import {
  EVAL_RESULT_SUBMITTED,
  type EvalResultSubmittedPayload,
} from "./types.js";

export interface EvalReporterOptions {
  outputDir?: string;
}

export interface RunArtifact {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  evals: EvalArtifact[];
}

export interface EvalArtifact {
  name: string;
  results: EvalResultSubmittedPayload[];
}

export class EvalReporter implements Reporter {
  private readonly outputDir: string;
  private startedAtMs = 0;
  private startedAtIso = "";
  private readonly resultsByEval = new Map<string, EvalResultSubmittedPayload[]>();

  constructor(options: EvalReporterOptions = {}) {
    this.outputDir = options.outputDir ?? join(process.cwd(), ".typed-evals", "runs");
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

  async onTestRunEnd(): Promise<void> {
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
    };

    await mkdir(this.outputDir, { recursive: true });
    const filepath = join(this.outputDir, `${runId}.json`);
    await writeFile(filepath, JSON.stringify(artifact, null, 2));
    console.log(`\ntyped-evals: wrote ${filepath}`);
  }
}
