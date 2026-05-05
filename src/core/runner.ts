import { normalizeScore, type Eval, type EvalResult } from "./types.js";

export async function runEval<TInput, TOutput>(
  evaluation: Eval<TInput, TOutput>,
): Promise<EvalResult> {
  const start = performance.now();
  const data = await evaluation.data();
  const trialCount = Math.max(1, evaluation.trialCount ?? 1);
  const scoresByName = new Map<string, number[]>();

  for (const item of data) {
    for (let trial = 0; trial < trialCount; trial++) {
      const output = await evaluation.task(item.input);
      for (const [name, scorer] of Object.entries(evaluation.scorers)) {
        const result = normalizeScore(
          await scorer({
            input: item.input,
            output,
            expected: item.expected,
          }),
        );
        const arr = scoresByName.get(name) ?? [];
        arr.push(result.score);
        scoresByName.set(name, arr);
      }
    }
  }

  const scores: Record<string, number> = {};
  for (const [name, values] of scoresByName) {
    scores[name] = values.reduce((a, b) => a + b, 0) / values.length;
  }

  return {
    name: evaluation.name,
    scores,
    durationMs: performance.now() - start,
  };
}
