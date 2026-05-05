import type { Eval } from "./types.js";

export function defineEval<TInput, TOutput>(
  config: Eval<TInput, TOutput>,
): Eval<TInput, TOutput> {
  return config;
}
