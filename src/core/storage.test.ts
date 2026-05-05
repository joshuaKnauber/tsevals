import { describe, expect, test } from "vitest";
import { SqliteStorage } from "./storage.js";
import type { RunArtifact } from "./types.js";

function baseArtifact(): RunArtifact {
  return {
    runId: "run-1",
    startedAt: "2026-05-05T10:00:00.000Z",
    finishedAt: "2026-05-05T10:00:01.000Z",
    durationMs: 1000,
    note: "v1: baseline",
    evals: [
      {
        name: "sentiment",
        results: [
          {
            evalName: "sentiment",
            input: "hello world",
            output: "positive",
            expected: "positive",
            scores: {
              exactMatch: { score: 1 },
              llmJudge: {
                score: 0.85,
                metadata: {
                  rationale: "Output matches.",
                  confidence: 0.9,
                  nested: { foo: "bar" },
                },
              },
            },
            durationMs: 12.5,
          },
          {
            evalName: "sentiment",
            input: { text: "structured", complexity: "high" },
            output: { label: "neutral", confidence: 0.7 },
            expected: undefined,
            scores: {
              exactMatch: { score: 0 },
            },
            durationMs: 8.0,
          },
        ],
      },
    ],
  };
}

describe("SqliteStorage", () => {
  test("round-trip preserves all fields including metadata, undefined expected, complex shapes", () => {
    const storage = new SqliteStorage(":memory:");
    const artifact = baseArtifact();
    storage.saveRun(artifact);
    const runs = storage.getRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toEqual(artifact);
    storage.close();
  });

  test("setNote updates an existing run's note", () => {
    const storage = new SqliteStorage(":memory:");
    const artifact: RunArtifact = { ...baseArtifact(), note: null };
    storage.saveRun(artifact);
    storage.setNote(artifact.runId, "tagged later");
    const runs = storage.getRuns();
    expect(runs[0]?.note).toBe("tagged later");
    storage.close();
  });

  test("setNote with null clears an existing note", () => {
    const storage = new SqliteStorage(":memory:");
    storage.saveRun(baseArtifact());
    storage.setNote("run-1", null);
    const runs = storage.getRuns();
    expect(runs[0]?.note).toBeNull();
    storage.close();
  });

  test("multiple runs returned newest-first", () => {
    const storage = new SqliteStorage(":memory:");
    storage.saveRun({
      ...baseArtifact(),
      runId: "old",
      startedAt: "2026-05-01T00:00:00.000Z",
    });
    storage.saveRun({
      ...baseArtifact(),
      runId: "new",
      startedAt: "2026-05-05T00:00:00.000Z",
    });
    const runs = storage.getRuns();
    expect(runs.map((r) => r.runId)).toEqual(["new", "old"]);
    storage.close();
  });

  test("saveRun is transactional — partial failure leaves no run", () => {
    const storage = new SqliteStorage(":memory:");
    const artifact = baseArtifact();
    storage.saveRun(artifact);
    expect(() => storage.saveRun(artifact)).toThrow();
    const runs = storage.getRuns();
    expect(runs).toHaveLength(1);
    storage.close();
  });
});
