#!/usr/bin/env node
import { watch } from "node:fs/promises";
import { defineCommand, runMain } from "citty";
import { startVitest } from "vitest/node";
import { EvalReporter } from "./core/reporter.js";
import { defaultDbPath, SqliteStorage } from "./core/storage.js";
import { startUiServer } from "./ui/server.js";

interface RunOptions {
  pattern?: string;
  note?: string;
  watch?: boolean;
}

async function runOnce(options: RunOptions = {}): Promise<number> {
  const ctx = await startVitest("test", [], {
    watch: options.watch ?? false,
    include: ["**/*.eval.?(c|m)[jt]s?(x)"],
    exclude: ["node_modules", "dist"],
    reporters: ["default", new EvalReporter({ note: options.note })],
    ...(options.pattern ? { testNamePattern: options.pattern } : {}),
  });

  if (!ctx) return 1;
  if (options.watch) return 0;

  const failed = ctx.state.getCountOfFailedTests();
  await ctx.close();
  return failed === 0 ? 0 : 1;
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
  },
  async run({ args }) {
    const code = await runOnce({
      pattern: args.pattern,
      note: args.note,
      watch: args.watch,
    });
    if (!args.watch) process.exit(code);
  },
});

const uiCommand = defineCommand({
  meta: { name: "ui", description: "Start the UI server" },
  args: {
    port: { type: "string", description: "Port", default: "3939" },
  },
  async run({ args }) {
    await startUiServer({ port: Number(args.port) });
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
    const storage = new SqliteStorage(defaultDbPath(cwd));
    const existingRuns = storage.getRuns().length;
    storage.close();

    await startUiServer({ port: Number(args.port) });

    if (existingRuns === 0) {
      console.log("typed-evals: no runs yet — populating once.");
      await runOnce();
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
          await runOnce();
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
    ui: uiCommand,
    dev: devCommand,
  },
});

runMain(main);
