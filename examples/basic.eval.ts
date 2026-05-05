import { defineEval, runEval } from "typed-evals";

const basic = defineEval({
  name: "basic",
  data: () => [
    { input: "hello", expected: "hello" },
    { input: "world", expected: "world" },
  ],
  task: (input) => input,
  scorers: [
    ({ output, expected }) => (output === expected ? 1 : 0),
  ],
});

const result = await runEval(basic);
console.log(result);
