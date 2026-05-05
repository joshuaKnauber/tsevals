import type { DatabaseSync } from "node:sqlite";

export interface Migration {
  id: string;
  up: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: "001_initial",
    up: `
      CREATE TABLE runs (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        duration_ms INTEGER NOT NULL
      );
      CREATE TABLE eval_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        eval_name TEXT NOT NULL,
        input TEXT NOT NULL,
        output TEXT NOT NULL,
        expected TEXT,
        scores TEXT NOT NULL,
        duration_ms REAL NOT NULL
      );
      CREATE INDEX idx_results_run ON eval_results(run_id);
      CREATE INDEX idx_results_eval ON eval_results(eval_name);
      CREATE INDEX idx_runs_started ON runs(started_at);
    `,
  },
  {
    id: "002_run_note",
    up: `ALTER TABLE runs ADD COLUMN note TEXT;`,
  },
];

export function applyMigrations(db: DatabaseSync): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set<string>(
    (db.prepare("SELECT id FROM schema_migrations").all() as { id: string }[]).map(
      (r) => r.id,
    ),
  );

  const insertApplied = db.prepare(
    "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
  );

  const newlyApplied: string[] = [];
  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    db.exec("BEGIN");
    try {
      db.exec(m.up);
      insertApplied.run(m.id, new Date().toISOString());
      db.exec("COMMIT");
      newlyApplied.push(m.id);
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
  return newlyApplied;
}
