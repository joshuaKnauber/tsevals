import { SqliteStorage, defaultDbPath } from "../core/storage.js";
import type { RunArtifact } from "../core/types.js";

export async function getRuns(dbPath?: string): Promise<RunArtifact[]> {
  const storage = new SqliteStorage(dbPath ?? defaultDbPath());
  try {
    return storage.getRuns();
  } finally {
    storage.close();
  }
}

export async function setRunNote(
  runId: string,
  note: string | null,
  dbPath?: string,
): Promise<void> {
  const storage = new SqliteStorage(dbPath ?? defaultDbPath());
  try {
    storage.setNote(runId, note);
  } finally {
    storage.close();
  }
}
