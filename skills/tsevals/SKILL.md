---
name: tsevals
description: Use the tsevals CLI to run, inspect, and diff LLM evals when iterating on agent code, prompts, models, or retrieval. Use this skill whenever the user asks you to improve, optimize, debug, fix, or iterate on an LLM task — especially if `*.eval.ts` files or a `.tsevals/runs.db` exist in the project, even if they don't mention tsevals or evals by name. Triggers include "make my agent better", "improve the prompt", "the score dropped", "why did this regress", "what's failing", "tune this scorer", "iterate on this eval", or any request to change LLM-facing code in a project that already has evals set up.
---

# Working with tsevals

tsevals records every LLM eval run to SQLite and exposes a JSON CLI. Use it to close the loop on iterations: change → run → diff → keep or revert.

## Mental model

- **Every change → run.** `tsevals run --json` is the equivalent of `npm test --json` — always parse stdout to learn the score.
- **Versions are signal; runs are noise.** A run with a `note` is a "version" — an intentional checkpoint. Most runs while iterating should stay untagged. Only tag when you've made a change worth comparing against.
- **`prev-version` is the baseline.** Score deltas are computed against the previous *version*, not the previous run. The natural shape of a session is: version → exploratory runs → version → exploratory runs → version.

## The iteration loop

Use this sequence whenever you're improving an LLM task in a project with tsevals.

1. **Orient.** See what's already been tried:
   ```bash
   tsevals list --versions --limit 10
   ```

2. **Read the eval before changing the agent.** Open every `*.eval.ts` file. You need to know what's being measured (the data, the `task`, the scorers, the expected values). Changing the user's prompt without understanding the eval is how you regress silently.

3. **Establish a baseline if there isn't one.** If `list --versions` is empty, run once and tag it before making any changes:
   ```bash
   tsevals run --note "baseline" --json
   ```

4. **Make a focused change** to the user's code (prompt, model, retrieval, tool definition — whatever they asked you to improve).

5. **Run and capture the score:**
   ```bash
   tsevals run --json | tee /tmp/last-run.json
   jq '.score' /tmp/last-run.json
   ```

6. **Diff against the previous version.** This is the decision point:
   ```bash
   tsevals diff prev-version
   ```
   - Exit 0 = no scorer regressed → safe to keep
   - Exit 1 = at least one scorer dropped by >0.001 → investigate before continuing

7. **Decide.**
   - **Improved + meaningful:** re-run with a note to mark this as the new version: `tsevals run --note "switched to claude-haiku-4.5"`
   - **Improved but minor:** leave the run untagged; keep iterating
   - **Regressed:** read the rationale (next section) before deciding to revert or fix forward

## Debugging a regression

When `diff` exits 1, find the failing rows:

```bash
tsevals show latest --full \
  | jq '.evals[] | {name, failing: [.results[] | select((.scores | to_entries | any(.value.score < 0.5)))]}'
```

If a scorer carries metadata (e.g. an LLM judge's rationale), inspect those — they usually tell you exactly *why* a row scored low:

```bash
tsevals show latest --full \
  | jq '.evals[].results[]
        | select(.scores.llmJudge.score < 0.5)
        | {input, output, rationale: .scores.llmJudge.metadata.rationale}'
```

The rationale is much faster than re-deriving the failure mode by hand.

## Commands at a glance

| Command | When to use |
|---|---|
| `tsevals run --json` | After every change. Prints summary; exit 1 if any test failed. |
| `tsevals run --note "X" --json` | Mark this run as a version. Use sparingly — only intentional checkpoints. |
| `tsevals show latest --full` | Inspect per-row data of the most recent run. |
| `tsevals show <runId>` | Pull a specific run as JSON (summary by default). |
| `tsevals diff prev-version` | Compare `latest` against the most recent version. Exit 1 on regression. |
| `tsevals diff <a> <b>` | Compare any two runs. |
| `tsevals list --versions` | History of intentional iterations. |

`latest` and `prev-version` are accepted anywhere a run id is.

## Useful jq snippets

```bash
# overall score from the latest run
tsevals run --json | jq '.score'

# per-scorer means for one run
tsevals show latest | jq '.evals[] | {name, scorers}'

# which scorers regressed and by how much
tsevals diff prev-version \
  | jq '.evals[].scorers | to_entries[] | select(.value.delta < 0)'

# rows where a specific scorer is failing
tsevals show latest --full \
  | jq '.evals[].results[] | select(.scores.exactMatch.score < 1) | {input, output, expected}'

# latest run's id (e.g. to feed into diff later)
tsevals run --json | jq -r '.runId'
```

## Don'ts

- **Don't tag every run.** Tagging makes the run a "version" used as a baseline by future diffs. Tagging exploratory or fix-up runs pollutes the comparison history.
- **Don't trust a single run if scorers are stochastic.** LLM-as-judge scorers carry noise. If a delta is small (< 0.05) and an LLM is in the scorer, re-run before concluding regression.
- **Don't change the eval to make a regression disappear.** The eval is the contract. Fix the agent, not the test. The exception: if the user explicitly asks you to change the eval (new dataset, new scorer), tag a new version with a note explaining why.
- **Don't run `tsevals dev`.** That's the interactive watcher for humans. From an agent context, use `run --json` directly.
- **Don't reach into `.tsevals/runs.db` with raw SQL** unless something is broken. The CLI covers the common reads and gives you stable JSON shapes.
