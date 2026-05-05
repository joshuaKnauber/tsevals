#!/usr/bin/env node
import { watch } from "node:fs/promises";
import { defineCommand, runMain } from "citty";
import { startVitest } from "vitest/node";
import {
  diffRuns,
  isVersion,
  loadRuns,
  resolveRun,
  summarizeRun,
  type RunSummary,
} from "./cli/inspect.js";
import { loadConfig, resolveDbPath } from "./core/config.js";
import { EvalReporter } from "./core/reporter.js";
import { SqliteStorage } from "./core/storage.js";
import { startUiServer } from "./ui/server.js";

async function getDbPath(): Promise<string> {
  const loaded = await loadConfig(process.cwd());
  return resolveDbPath(loaded, process.cwd());
}

interface RunOptions {
  pattern?: string;
  note?: string;
  watch?: boolean;
  json?: boolean;
  dbPath?: string;
}

async function runOnce(
  options: RunOptions = {},
): Promise<{ code: number; runId: string | null }> {
  const reporter = new EvalReporter({
    note: options.note,
    quiet: options.json,
    dbPath: options.dbPath,
  });
  const ctx = await startVitest("test", [], {
    watch: options.watch ?? false,
    include: ["**/*.eval.?(c|m)[jt]s?(x)"],
    exclude: ["node_modules", "dist"],
    reporters: options.json ? [reporter] : ["default", reporter],
    silent: options.json ? true : undefined,
    ...(options.pattern ? { testNamePattern: options.pattern } : {}),
  });

  if (!ctx) return { code: 1, runId: null };
  if (options.watch) return { code: 0, runId: null };

  const failed = ctx.state.getCountOfFailedTests();
  await ctx.close();
  return {
    code: failed === 0 ? 0 : 1,
    runId: reporter.lastRunId,
  };
}

const runCommand = defineCommand({
  meta: { name: "run", description: "Run evals" },
  args: {
    pattern: {
      type: "positional",
      required: false,
      description: "Filter evals by name regex",
    },
    watch: {
      type: "boolean",
      description: "Run in watch mode (vitest)",
      default: false,
    },
    note: {
      type: "string",
      description: "Tag this run as a version with a note",
    },
    json: {
      type: "boolean",
      description: "Emit run summary as JSON to stdout (suppresses TTY output)",
      default: false,
    },
  },
  async run({ args }) {
    const dbPath = await getDbPath();
    const result = await runOnce({
      pattern: args.pattern,
      note: args.note,
      watch: args.watch,
      json: args.json,
      dbPath,
    });

    if (args.json && result.runId) {
      const run = loadRuns(dbPath).find((r) => r.runId === result.runId);
      if (run) {
        const summary: RunSummary & { ok: boolean } = {
          ok: result.code === 0,
          ...summarizeRun(run),
        };
        process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
      }
    }

    if (!args.watch) process.exit(result.code);
  },
});

const showCommand = defineCommand({
  meta: {
    name: "show",
    description: "Print a run as JSON (id, 'latest', or 'prev-version')",
  },
  args: {
    ref: {
      type: "positional",
      required: true,
      description: "Run id or 'latest' or 'prev-version'",
    },
    full: {
      type: "boolean",
      description: "Include per-row data (default is summary only)",
      default: false,
    },
  },
  async run({ args }) {
    const dbPath = await getDbPath();
    const runs = loadRuns(dbPath);
    const run = resolveRun(runs, args.ref);
    if (!run) {
      process.stderr.write(`run not found: ${args.ref}\n`);
      process.exit(2);
    }
    const out = args.full ? run : summarizeRun(run);
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  },
});

const diffCommand = defineCommand({
  meta: {
    name: "diff",
    description:
      "Score deltas between two runs. Exits non-zero on regression.",
  },
  args: {
    from: {
      type: "positional",
      required: true,
      description: "Baseline (id, 'latest', or 'prev-version')",
    },
    to: {
      type: "positional",
      required: false,
      description: "Comparison run (default: 'latest')",
    },
  },
  async run({ args }) {
    const dbPath = await getDbPath();
    const runs = loadRuns(dbPath);
    const from = resolveRun(runs, args.from);
    const to = resolveRun(runs, args.to ?? "latest");
    if (!from) {
      process.stderr.write(`run not found: ${args.from}\n`);
      process.exit(2);
    }
    if (!to) {
      process.stderr.write(`run not found: ${args.to ?? "latest"}\n`);
      process.exit(2);
    }
    const diff = diffRuns(from, to);
    process.stdout.write(JSON.stringify(diff, null, 2) + "\n");
    process.exit(diff.hasRegression ? 1 : 0);
  },
});

const listCommand = defineCommand({
  meta: { name: "list", description: "List recent runs as JSON" },
  args: {
    limit: {
      type: "string",
      description: "Max runs to return",
      default: "20",
    },
    versions: {
      type: "boolean",
      description: "Only versioned runs (with notes)",
      default: false,
    },
  },
  async run({ args }) {
    const dbPath = await getDbPath();
    const limit = Number(args.limit);
    let runs = loadRuns(dbPath);
    if (args.versions) runs = runs.filter(isVersion);
    runs = runs.slice(0, Number.isFinite(limit) ? limit : 20);
    const out = runs.map((r) => ({
      runId: r.runId,
      startedAt: r.startedAt,
      durationMs: r.durationMs,
      note: r.note ?? null,
      evalCount: r.evals.length,
      score: summarizeRun(r).score,
    }));
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  },
});

const uiCommand = defineCommand({
  meta: { name: "ui", description: "Start the UI server" },
  args: {
    port: { type: "string", description: "Port", default: "3939" },
  },
  async run({ args }) {
    const dbPath = await getDbPath();
    await startUiServer({ port: Number(args.port), dbPath });
  },
});

const devCommand = defineCommand({
  meta: {
    name: "dev",
    description: "Watch eval files + serve UI; re-run on save",
  },
  args: {
    port: { type: "string", description: "UI port", default: "3939" },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const dbPath = await getDbPath();
    const storage = new SqliteStorage(dbPath);
    const existingRuns = storage.getRuns().length;
    storage.close();

    await startUiServer({ port: Number(args.port), dbPath });

    if (existingRuns === 0) {
      console.log("typed-evals: no runs yet — populating once.");
      await runOnce({ dbPath });
    } else {
      console.log(
        `typed-evals: ${existingRuns} existing run${existingRuns === 1 ? "" : "s"} — watching for changes.`,
      );
    }

    let running = false;
    let queued = false;
    let timer: NodeJS.Timeout | null = null;

    async function trigger() {
      if (running) {
        queued = true;
        return;
      }
      running = true;
      try {
        do {
          queued = false;
          console.log("typed-evals: running…");
          await runOnce({ dbPath });
        } while (queued);
      } catch (err) {
        console.error("typed-evals: run failed:", err);
      } finally {
        running = false;
      }
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(trigger, 150);
    }

    const evalFile = /\.eval\.(c|m)?[jt]sx?$/;
    const ignore = /(^|\/)(node_modules|dist|dist-ui|\.typed-evals|\.git)(\/|$)/;

    try {
      const watcher = watch(cwd, { recursive: true });
      for await (const event of watcher) {
        const name = event.filename ?? "";
        if (ignore.test(name)) continue;
        if (!evalFile.test(name)) continue;
        schedule();
      }
    } catch (err) {
      console.error("typed-evals: watcher error:", err);
      process.exit(1);
    }
  },
});

const main = defineCommand({
  meta: {
    name: "typed-evals",
    version: "0.0.1",
    description: "TypeScript evals: run, inspect, compare.",
  },
  subCommands: {
    run: runCommand,
    show: showCommand,
    diff: diffCommand,
    list: listCommand,
    ui: uiCommand,
    dev: devCommand,
  },
});

runMain(main);
