#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { startVitest } from "vitest/node";
import { EvalReporter } from "./core/reporter.js";
import { startUiServer } from "./ui/server.js";

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
    note: {
      type: "string",
      description: "Tag this run as a version with a note",
    },
  },
  async run({ args }) {
    const ctx = await startVitest("test", [], {
      watch: args.watch,
      include: ["**/*.eval.?(c|m)[jt]s?(x)"],
      exclude: ["node_modules", "dist"],
      reporters: ["default", new EvalReporter({ note: args.note })],
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
    description: "Start the UI server",
  },
  args: {
    port: {
      type: "string",
      description: "Port to serve on",
      default: "3939",
    },
  },
  async run({ args }) {
    await startUiServer({ port: Number(args.port) });
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
