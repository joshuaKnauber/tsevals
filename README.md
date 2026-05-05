# typed-evals

A TypeScript-first eval framework for LLM apps. Define evals, run them through vitest, track regressions and improvements across iterations.

> [!WARNING]
> v0.0.1. The name `typed-evals` is a placeholder. APIs may change. Not yet published to npm.

## What it does

Building agents and prompts is iterative — you tweak a prompt, change a model, restructure a tool call, and you want to know whether things got better or worse. typed-evals is for that loop:

- A **typed API** (`defineEval`) for declaring datasets, tasks, and named scorers
- A **vitest-based runner** so evals run alongside your tests with parallelism, file discovery, and watch mode for free
- A **SQLite history** of every run so you can compare any two
- A **React UI** with score-trend charts, version markers, and per-row inspection
- An **agent-friendly CLI** that emits JSON, scriptable for autonomous iteration loops

The differentiator is the comparison story: tag intentional iterations as **versions** (with a note like `"switched to claude-haiku-4.5"`), and every delta the UI and CLI show you is computed against the previous version, not the previous noise run.

## Install

```bash
npm install --save-dev typed-evals vitest
```

> [!NOTE]
> Requires **Node 22+** (uses the built-in `node:sqlite` module).
> `vitest` is a peer dependency.

## Quick start

Create an eval file ending in `.eval.ts` and `export default` an eval definition:

```ts
// examples/sentiment.eval.ts
import { defineEval } from "typed-evals";

export default defineEval<string, "positive" | "negative" | "neutral">({
  name: "sentiment",
  data: () => [
    { input: "I love this!",                 expected: "positive" },
    { input: "Worst purchase ever.",          expected: "negative" },
    { input: "It's fine, I guess.",           expected: "neutral"  },
  ],
  task: async (input) => {
    // your model / agent / pipeline
    return await classifySentiment(input);
  },
  scorers: {
    exactMatch: ({ output, expected }) => (output === expected ? 1 : 0),
    llmJudge: async ({ output, expected }) => ({
      score: await judge(output, expected),
      metadata: { rationale: "..." },
    }),
  },
});
```

Run them:

```bash
npx typed-evals run
```

Open the UI:

```bash
npx typed-evals dev   # watcher + UI on http://localhost:3939
```

## API

### `defineEval(config)`

```ts
defineEval<TInput, TOutput>({
  name: string,
  data: () => DataItem<TInput, TOutput>[] | Promise<...>,
  task: (input: TInput) => TOutput | Promise<TOutput>,
  scorers: Record<string, Scorer<TInput, TOutput>>,
})
```

- **Named scorers**: `scorers` is a record (not an array), so each scorer has a stable identity across runs — necessary for "scorer X regressed" deltas.
- **Scorer return shape**: a scorer can return either a `number` or `{ score: number, metadata?: unknown }`. Metadata (e.g. an LLM judge's rationale) is preserved per row and surfaced in the UI on click.
- **Data is a function**: lazy, can be async, can read files / call APIs.

### Convention

- Files matching `**/*.eval.{ts,tsx,mts,...}` are picked up by `typed-evals run`.
- Each file exports an eval as `default`.
- Eval files coexist with regular `*.test.ts` — vitest's normal test runner ignores `.eval.ts` files.

## CLI

```
typed-evals run    [pattern] [--watch] [--note "..."] [--json]
typed-evals dev    [--port]
typed-evals ui     [--port]
typed-evals show   <id|latest|prev-version> [--full]
typed-evals diff   <from> [to=latest]
typed-evals list   [--limit N] [--versions]
```

| Command | Description |
|---|---|
| `run` | Run all evals (or a name regex). Saves a row to SQLite. |
| `run --watch` | Vitest watch mode — re-runs on file change. |
| `run --note "..."` | Tag this run as a **version** with a description. |
| `run --json` | Emit a structured run summary to stdout (no TTY noise). |
| `dev` | UI server + file watcher + auto-rerun + live UI polling. |
| `ui` | UI server only (production / inspect-only). |
| `show <ref>` | Print a run as JSON. `--full` includes per-row data. |
| `diff <from> [to]` | Per-eval and per-scorer score deltas. **Exits 1 on regression.** |
| `list` | Recent runs as JSON. `--versions` for tagged-only. |

Refs `latest` and `prev-version` work everywhere a runId is accepted.

## Use with agents

Every read-style command emits JSON, exit codes are meaningful, and the loop is scriptable:

```bash
typed-evals run --json | jq '.score'                        # post-change score
typed-evals diff prev-version || revert_changes              # auto-revert on regression
typed-evals show latest --full | jq '.evals[].results[]'     # inspect rows
```

**A skill for AI coding agents** ships with this package at [`skills/typed-evals/SKILL.md`](./skills/typed-evals/SKILL.md). Point your agent (Claude Code, Cursor, etc.) at it and the agent learns the iteration workflow — when to tag versions, how to read regressions, which jq snippets to reach for. The skill triggers on requests like "improve my prompt", "fix the regression", or "iterate on this eval" when typed-evals is present in the project.

CLI exit codes:

- `run` — `0` if all rows passed, `1` if any failed
- `diff` — `0` if no scorer regressed (delta > `-0.001`), `1` otherwise
- `show` — `0` on success, `2` if the ref is not found

## Config

Optional. Drop a `typed-evals.config.{ts,mts,mjs,js,json}` in your project root.

```ts
// typed-evals.config.ts
import { defineConfig } from "typed-evals";

export default defineConfig({
  dbPath: ".typed-evals/runs.db",
});
```

Currently supported keys:

| Key | Default | Notes |
|---|---|---|
| `dbPath` | `.typed-evals/runs.db` | Where the SQLite history is stored. Relative paths resolve from the config file's directory. |

`.ts` configs are loaded via [jiti](https://github.com/unjs/jiti) so you can use TypeScript syntax without a build step. `.mjs` / `.js` use native ESM import; `.json` is parsed directly.

## How runs work

Each run produces a row in `.typed-evals/runs.db` (SQLite, schema-migrated automatically):

- A `runs` row: id, started/finished timestamps, duration, optional `note`
- A `eval_results` row per (data row × eval), with input/output/expected/scores/duration

A run with a non-empty `note` is a **version**. The UI defaults the score chart and Δ-vs-prev-version calculations to versions, so day-to-day noise runs don't drown out your actual iterations.

You can tag a run after the fact in the UI (inline note editor on each run), or at runtime via `--note "..."`.

## Storage

- Database: `.typed-evals/runs.db` in the working directory (gitignored by default)
- Backed by `node:sqlite` (Node 22+ built-in, zero native deps)
- Schema migrations are versioned and applied on first connection per process; re-running them is a no-op
- Inspect directly: `sqlite3 .typed-evals/runs.db`

## What's missing (yet)

This is v0.0.1 — explicit non-goals so far:

- No score-threshold gating (`--threshold 0.85` is on the roadmap)
- No trial-count / variance handling for non-deterministic scorers (`trialCount`)
- No cross-run row alignment by input hash (planned for the diff view)
- No trace / token-cost integration (looking at this through a separate observability tool)

PRs and issues welcome once the name and shape stabilize.
