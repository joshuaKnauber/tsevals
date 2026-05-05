export type Scorer<TInput, TOutput> = (args: {
  input: TInput;
  output: TOutput;
  expected?: TOutput;
}) => number | Promise<number>;

export interface DataItem<TInput, TOutput> {
  input: TInput;
  expected?: TOutput;
}

export interface Eval<TInput, TOutput> {
  name: string;
  data: () => DataItem<TInput, TOutput>[] | Promise<DataItem<TInput, TOutput>[]>;
  task: (input: TInput) => TOutput | Promise<TOutput>;
  scorers: Scorer<TInput, TOutput>[];
}

export interface EvalResult {
  name: string;
  scores: number[];
  durationMs: number;
}
