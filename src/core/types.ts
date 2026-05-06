export interface ScoreEntry {
  score: number;
  metadata?: unknown;
  trials?: number[];
}

export type ScorerResult = number | ScoreEntry;

export type Scorer<TInput, TOutput> = (args: {
  input: TInput;
  output: TOutput;
  expected?: TOutput;
}) => ScorerResult | Promise<ScorerResult>;

export interface DataItem<TInput, TOutput> {
  input: TInput;
  expected?: TOutput;
}

export interface Eval<TInput, TOutput> {
  name: string;
  data: () => DataItem<TInput, TOutput>[] | Promise<DataItem<TInput, TOutput>[]>;
  task: (input: TInput) => TOutput | Promise<TOutput>;
  scorers: Record<string, Scorer<TInput, TOutput>>;
  /**
   * Run the full task+scorers pipeline this many times per data row, then
   * average the score per scorer. Defaults to 1. Use this when the task or
   * scorers carry sampling noise (e.g. LLM calls with temperature > 0,
   * LLM-as-judge scorers).
   */
  trialCount?: number;
}

export interface EvalResult {
  name: string;
  scores: Record<string, number>;
  durationMs: number;
}

export const EVAL_RESULT_STARTED = "tsevals:result-started" as const;
export const EVAL_RESULT_SUBMITTED = "tsevals:result-submitted" as const;

export interface EvalResultStartedPayload {
  evalName: string;
  input: unknown;
  expected?: unknown;
}

export interface EvalResultSubmittedPayload {
  evalName: string;
  input: unknown;
  output: unknown;
  expected?: unknown;
  scores: Record<string, ScoreEntry>;
  durationMs: number;
}

export function normalizeScore(result: ScorerResult): ScoreEntry {
  return typeof result === "number" ? { score: result } : result;
}

export interface EvalArtifact {
  name: string;
  results: EvalResultSubmittedPayload[];
}

export interface RunArtifact {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  evals: EvalArtifact[];
  note?: string | null;
}
