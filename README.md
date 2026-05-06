# tsevals

TypeScript evals for LLM apps. Define evals with a typed API, run them through vitest, store every run in SQLite, browse them in a UI, diff them from the CLI.

## What's included

- `defineEval` — typed API for datasets, tasks, named scorers
- A vitest reporter that captures per-row results to SQLite as evals run
- A React UI with score-over-time charts and per-row inspection
- A CLI: `run`, `dev`, `ui`, `show`, `diff`, `list` — all read-side commands emit JSON
- Versioning: tag a run with a note (`--note "switched to haiku-4.5"`) and deltas are computed against the previous tagged version

## Install

```bash
npm install --save-dev tsevals vitest
```

> [!NOTE]
> Requires **Node 22+** (uses the built-in `node:sqlite` module).
> `vitest` is a peer dependency.

## Quick start

Create an eval file ending in `.eval.ts` and `export default` an eval definition:

```ts
// examples/sentiment.eval.ts
import { defineEval } from "tsevals";

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
npx tsevals run
```

Open the UI:

```bash
npx tsevals dev   # watcher + UI on http://localhost:3939
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

- **Named scorers**: `scorers` is a record, so each scorer has a stable identity across runs (used for per-scorer deltas).
- **Scorer return**: `number` or `{ score: number, metadata?: unknown }`. Metadata is stored per row and shown in the UI on click.
- **Data is a function**: lazy, async-capable.
- **`trialCount`**: optional integer. Re-runs the full task+scorers pipeline N times per row and averages the score. Use when the task or scorers carry sampling noise (LLM-as-judge, `temperature > 0`). Per-trial values are stored alongside the mean and surfaced in the UI.

### Convention

- Files matching `**/*.eval.{ts,tsx,mts,...}` are picked up by `tsevals run`.
- Each file exports an eval as `default`.
- Eval files coexist with regular `*.test.ts` — vitest's normal test runner ignores `.eval.ts` files.

## CLI

```
tsevals run    [pattern] [--watch] [--note "..."] [--json]
tsevals dev    [--port]
tsevals ui     [--port]
tsevals show   <id|latest|prev-version> [--full]
tsevals diff   <from> [to=latest]
tsevals list   [--limit N] [--versions]
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
tsevals run --json | jq '.score'                        # post-change score
tsevals diff prev-version || revert_changes              # auto-revert on regression
tsevals show latest --full | jq '.evals[].results[]'     # inspect rows
```

A skill for AI coding agents ships at [`skills/tsevals/SKILL.md`](./skills/tsevals/SKILL.md). Point your agent (Claude Code, Cursor, etc.) at it for the iteration workflow — when to tag versions, how to inspect regressions, useful jq snippets.

CLI exit codes:

- `run` — `0` if all rows passed, `1` if any failed
- `diff` — `0` if no scorer regressed (delta > `-0.001`), `1` otherwise
- `show` — `0` on success, `2` if the ref is not found

## CI: gating on regression

Use `diff` against a named version to fail the build on regression:

```bash
# after a green run on main:
tsevals run --note "release-2.4"

# in PR CI:
tsevals diff release-2.4
# exit 0 = no scorer regressed
# exit 1 = at least one scorer dropped
```

`prev-version` works the same way against whatever the latest tagged run happens to be.

> [!NOTE]
> LLM-based scorers carry sampling noise. Use `trialCount` on the eval definition (see [API](#api)) to average across multiple trials before relying on a single delta.

## Config

Optional. Drop a `tsevals.config.{ts,mts,mjs,js,json}` in your project root.

```ts
// tsevals.config.ts
import { defineConfig } from "tsevals";

export default defineConfig({
  dbPath: ".tsevals/runs.db",
});
```

Currently supported keys:

| Key | Default | Notes |
|---|---|---|
| `dbPath` | `.tsevals/runs.db` | Where the SQLite history is stored. Relative paths resolve from the config file's directory. |

`.ts` configs are loaded via [jiti](https://github.com/unjs/jiti) so you can use TypeScript syntax without a build step. `.mjs` / `.js` use native ESM import; `.json` is parsed directly.

## How runs work

Each run produces a row in `.tsevals/runs.db` (SQLite, schema-migrated automatically):

- A `runs` row: id, started/finished timestamps, duration, optional `note`
- A `eval_results` row per (data row × eval), with input/output/expected/scores/duration

A run with a non-empty `note` is a **version**. The UI's score chart and `diff prev-version` use versions as the comparison baseline.

Tag at runtime with `--note "..."`, or after the fact via the inline note editor on each run in the UI.

## Storage

- Database: `.tsevals/runs.db` in the working directory (gitignored by default)
- Backed by `node:sqlite` (Node 22+ built-in, zero native deps)
- Schema migrations are versioned and applied on first connection per process; re-running them is a no-op
- Inspect directly: `sqlite3 .tsevals/runs.db`

## Thanks

The `defineEval` shape and the vitest-reporter approach are heavily inspired by [evalite](https://github.com/mattpocock/evalite). Go check it out.