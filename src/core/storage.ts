import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { applyMigrations } from "./migrations.js";
import type { EvalArtifact, RunArtifact } from "./types.js";

interface RunRow {
  id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  note: string | null;
}

interface ResultRow {
  eval_name: string;
  input: string;
  output: string;
  expected: string | null;
  scores: string;
  duration_ms: number;
}

export class SqliteStorage {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    applyMigrations(this.db);
  }

  saveRun(artifact: RunArtifact): void {
    const insertRun = this.db.prepare(
      "INSERT INTO runs (id, started_at, finished_at, duration_ms, note) VALUES (?, ?, ?, ?, ?)",
    );
    const insertResult = this.db.prepare(
      "INSERT INTO eval_results (run_id, eval_name, input, output, expected, scores, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );

    this.db.exec("BEGIN");
    try {
      insertRun.run(
        artifact.runId,
        artifact.startedAt,
        artifact.finishedAt,
        artifact.durationMs,
        artifact.note ?? null,
      );
      for (const evalArtifact of artifact.evals) {
        for (const result of evalArtifact.results) {
          insertResult.run(
            artifact.runId,
            evalArtifact.name,
            JSON.stringify(result.input),
            JSON.stringify(result.output),
            result.expected !== undefined ? JSON.stringify(result.expected) : null,
            JSON.stringify(result.scores),
            result.durationMs,
          );
        }
      }
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  setNote(runId: string, note: string | null): void {
    this.db
      .prepare("UPDATE runs SET note = ? WHERE id = ?")
      .run(note, runId);
  }

  getRuns(): RunArtifact[] {
    const runs = this.db
      .prepare(
        "SELECT id, started_at, finished_at, duration_ms, note FROM runs ORDER BY started_at DESC",
      )
      .all() as unknown as RunRow[];

    const resultsForRun = this.db.prepare(
      "SELECT eval_name, input, output, expected, scores, duration_ms FROM eval_results WHERE run_id = ? ORDER BY id",
    );

    return runs.map((r) => {
      const rows = resultsForRun.all(r.id) as unknown as ResultRow[];
      const evalsByName = new Map<string, EvalArtifact>();

      for (const row of rows) {
        let bucket = evalsByName.get(row.eval_name);
        if (!bucket) {
          bucket = { name: row.eval_name, results: [] };
          evalsByName.set(row.eval_name, bucket);
        }
        bucket.results.push({
          evalName: row.eval_name,
          input: JSON.parse(row.input),
          output: JSON.parse(row.output),
          expected: row.expected !== null ? JSON.parse(row.expected) : undefined,
          scores: JSON.parse(row.scores) as Record<string, number>,
          durationMs: row.duration_ms,
        });
      }

      return {
        runId: r.id,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
        durationMs: r.duration_ms,
        evals: Array.from(evalsByName.values()),
        note: r.note,
      };
    });
  }

  close(): void {
    this.db.close();
  }
}

export function defaultDbPath(cwd: string = process.cwd()): string {
  return join(cwd, ".typed-evals", "runs.db");
}
