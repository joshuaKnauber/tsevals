#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { startVitest } from "vitest/node";
import { EvalReporter } from "./core/reporter.js";

const runCommand = defineCommand({
  meta: {
    name: "run",
    description: "Run evals",
  },
  args: {
    pattern: {
      type: "positional",
      required: false,
      description: "Filter evals by name pattern",
    },
    watch: {
      type: "boolean",
      description: "Run in watch mode",
      default: false,
    },
  },
  async run({ args }) {
    const ctx = await startVitest("test", [], {
      watch: args.watch,
      include: ["**/*.eval.?(c|m)[jt]s?(x)"],
      exclude: ["node_modules", "dist"],
      reporters: ["default", new EvalReporter()],
      ...(args.pattern ? { testNamePattern: args.pattern } : {}),
    });

    if (!ctx) {
      process.exit(1);
    }

    if (!args.watch) {
      const failed = ctx.state.getCountOfFailedTests();
      await ctx.close();
      process.exit(failed === 0 ? 0 : 1);
    }
  },
});

const uiCommand = defineCommand({
  meta: {
    name: "ui",
    description: "Start the UI (not implemented)",
  },
  run() {
    console.log("typed-evals: ui (not implemented)");
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
  },
});

runMain(main);
