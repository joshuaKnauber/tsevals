import { describe, test } from "vitest";
import {
  EVAL_RESULT_STARTED,
  EVAL_RESULT_SUBMITTED,
  type Eval,
  type EvalResultStartedPayload,
  type EvalResultSubmittedPayload,
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

function registerVitestTests<TInput, TOutput>(
  config: Eval<TInput, TOutput>,
): void {
  describe(config.name, async () => {
    const data = await config.data();
    for (const item of data) {
      const label =
        typeof item.input === "string" ? item.input : JSON.stringify(item.input);

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
        const output = await config.task(item.input);
        const durationMs = performance.now() - startedAt;
        const scores = await Promise.all(
          config.scorers.map((s) =>
            s({ input: item.input, output, expected: item.expected }),
          ),
        );

        const submittedPayload: EvalResultSubmittedPayload = {
          evalName: config.name,
          input: item.input,
          output,
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
