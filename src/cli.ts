#!/usr/bin/env node
import { startVitest } from "vitest/node";

const args = process.argv.slice(2);
const command = args[0];

function printUsage(): void {
  console.log(`usage:
  typed-evals run [pattern] [--watch]   run evals (optionally filter by name)
  typed-evals ui                        start the UI (not implemented)`);
}

async function runCommand(rest: string[]): Promise<void> {
  const watch = rest.includes("--watch");
  const positional = rest.filter((a) => !a.startsWith("--"));
  const testNamePattern = positional[0];

  const ctx = await startVitest("test", [], {
    watch,
    include: ["**/*.eval.?(c|m)[jt]s?(x)"],
    exclude: ["node_modules", "dist"],
    ...(testNamePattern ? { testNamePattern } : {}),
  });

  if (!ctx) {
    process.exit(1);
  }

  if (!watch) {
    const failed = ctx.state.getCountOfFailedTests();
    await ctx.close();
    process.exit(failed === 0 ? 0 : 1);
  }
}

switch (command) {
  case "run":
    await runCommand(args.slice(1));
    break;
  case "ui":
    console.log("typed-evals: ui (not implemented)");
    break;
  case undefined:
  case "help":
  case "--help":
  case "-h":
    printUsage();
    break;
  default:
    console.error(`unknown command: ${command}`);
    process.exit(1);
}
