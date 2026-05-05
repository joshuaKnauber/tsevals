import type { Eval, EvalResult } from "./types.js";

export async function runEval<TInput, TOutput>(
  _evaluation: Eval<TInput, TOutput>,
): Promise<EvalResult> {
  throw new Error("runner not implemented");
}
