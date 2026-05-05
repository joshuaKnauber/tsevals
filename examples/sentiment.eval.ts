import { defineEval } from "typed-evals";

type Sentiment = "positive" | "negative" | "neutral";

const POSITIVE_WORDS = [
  "love",
  "great",
  "amazing",
  "best",
  "wonderful",
  "happy",
  "fantastic",
  "excellent",
];
const NEGATIVE_WORDS = [
  "hate",
  "terrible",
  "worst",
  "bad",
  "awful",
  "sad",
  "horrible",
  "disappointing",
];

function classify(text: string): Sentiment {
  const lower = text.toLowerCase();
  const positive = POSITIVE_WORDS.some((w) => lower.includes(w));
  const negative = NEGATIVE_WORDS.some((w) => lower.includes(w));
  if (positive && !negative) return "positive";
  if (negative && !positive) return "negative";
  return "neutral";
}

const sentiment = defineEval<string, Sentiment>({
  name: "sentiment",
  data: () => [
    { input: "I love this product, it's amazing!", expected: "positive" },
    { input: "Worst purchase ever, total waste of money.", expected: "negative" },
    { input: "It's fine, I guess.", expected: "neutral" },
    { input: "Not bad at all, surprisingly good.", expected: "positive" },
    { input: "Could be better, could be worse.", expected: "neutral" },
    { input: "Absolutely terrible experience.", expected: "negative" },
    { input: "I'm so happy with this!", expected: "positive" },
    { input: "Meh, didn't blow my mind.", expected: "neutral" },
    { input: "This is the best thing I've ever bought!", expected: "positive" },
    { input: "I hate everything about it.", expected: "negative" },
    { input: "Fast shipping, decent quality.", expected: "positive" },
    { input: "Not the worst thing I've owned.", expected: "neutral" },
  ],
  task: async (input) => {
    await new Promise((resolve) =>
      setTimeout(resolve, 5 + Math.random() * 25),
    );
    return classify(input);
  },
  scorers: {
    exactMatch: ({ output, expected }) => (output === expected ? 1 : 0),
    llmJudge: ({ output, expected }) => {
      const base = output === expected ? 0.85 : 0.35;
      const noise = (Math.random() - 0.5) * 0.3;
      return Math.max(0, Math.min(1, base + noise));
    },
  },
});

export default sentiment;
