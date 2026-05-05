import { describe, test } from "vitest";
import {
  EVAL_RESULT_STARTED,
  EVAL_RESULT_SUBMITTED,
  normalizeScore,
  type Eval,
  type EvalResultStartedPayload,
  type EvalResultSubmittedPayload,
  type ScoreEntry,
} from "./types.js";

function isInsideVitest(): boolean {
  if (typeof globalThis === "undefined") return false;
  return "__vitest_worker__" in (globalThis as Record<string, unknown>);
}

export function defineEval<TInput, TOutput>(
  config: Eval<TInput, TOutput>,
): Eval<TInput, TOutput> {
  if (isInsideVitest()) {
    registerVitestTests(config);
  }
  return config;
}

function aggregateTrialScores<TOutput>(
  trials: { output: TOutput; scores: Record<string, ScoreEntry> }[],
  trialCount: number,
): Record<string, ScoreEntry> {
  const scorerNames = new Set<string>();
  for (const t of trials) for (const k of Object.keys(t.scores)) scorerNames.add(k);

  const result: Record<string, ScoreEntry> = {};
  for (const name of scorerNames) {
    const values = trials.map((t) => t.scores[name]?.score ?? 0);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (trialCount > 1) {
      result[name] = { score: mean, trials: values };
    } else {
      const entry = trials[0]?.scores[name];
      result[name] =
        entry?.metadata !== undefined
          ? { score: mean, metadata: entry.metadata }
          : { score: mean };
    }
  }
  return result;
}

function registerVitestTests<TInput, TOutput>(
  config: Eval<TInput, TOutput>,
): void {
  describe(config.name, async () => {
    const data = await config.data();
    for (const item of data) {
      const label =
        typeof item.input === "string" ? item.input : JSON.stringify(item.input);

      const trialCount = Math.max(1, config.trialCount ?? 1);

      test(label, async ({ annotate }) => {
        const startedPayload: EvalResultStartedPayload = {
          evalName: config.name,
          input: item.input,
          expected: item.expected,
        };
        await annotate("result-started", EVAL_RESULT_STARTED, {
          contentType: "application/json",
          body: JSON.stringify(startedPayload),
        });

        const startedAt = performance.now();
        const trialResults: { output: TOutput; scores: Record<string, ScoreEntry> }[] = [];

        for (let trial = 0; trial < trialCount; trial++) {
          const output = await config.task(item.input);
          const scoreEntries = await Promise.all(
            Object.entries(config.scorers).map(
              async ([name, scorer]) =>
                [
                  name,
                  normalizeScore(
                    await scorer({
                      input: item.input,
                      output,
                      expected: item.expected,
                    }),
                  ),
                ] as const,
            ),
          );
          trialResults.push({
            output,
            scores: Object.fromEntries(scoreEntries),
          });
        }

        const durationMs = performance.now() - startedAt;
        const scores = aggregateTrialScores(trialResults, trialCount);
        const representativeOutput = trialResults[trialResults.length - 1]!.output;

        const submittedPayload: EvalResultSubmittedPayload = {
          evalName: config.name,
          input: item.input,
          output: representativeOutput,
          expected: item.expected,
          scores,
          durationMs,
        };
        await annotate("result-submitted", EVAL_RESULT_SUBMITTED, {
          contentType: "application/json",
          body: JSON.stringify(submittedPayload),
        });
      });
    }
  });
}
