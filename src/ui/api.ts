import { SqliteStorage, defaultDbPath } from "../core/storage.js";
import type { RunArtifact } from "../core/types.js";

export async function getRuns(cwd: string = process.cwd()): Promise<RunArtifact[]> {
  const storage = new SqliteStorage(defaultDbPath(cwd));
  try {
    return storage.getRuns();
  } finally {
    storage.close();
  }
}

export async function setRunNote(
  runId: string,
  note: string | null,
  cwd: string = process.cwd(),
): Promise<void> {
  const storage = new SqliteStorage(defaultDbPath(cwd));
  try {
    storage.setNote(runId, note);
  } finally {
    storage.close();
  }
}
