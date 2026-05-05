import type { Eval, EvalResult } from "./types.js";

export async function runEval<TInput, TOutput>(
  evaluation: Eval<TInput, TOutput>,
): Promise<EvalResult> {
  const start = performance.now();
  const data = await evaluation.data();
  const scores: number[] = [];

  for (const item of data) {
    const output = await evaluation.task(item.input);
    for (const scorer of evaluation.scorers) {
      const score = await scorer({
        input: item.input,
        output,
        expected: item.expected,
      });
      scores.push(score);
    }
  }

  return {
    name: evaluation.name,
    scores,
    durationMs: performance.now() - start,
  };
}
