#!/usr/bin/env node

const command = process.argv[2];

switch (command) {
  case "run":
    console.log("typed-evals: run (not implemented)");
    break;
  case "ui":
    console.log("typed-evals: ui (not implemented)");
    break;
  case undefined:
  case "help":
  case "--help":
  case "-h":
    console.log("usage: typed-evals <run | ui>");
    break;
  default:
    console.error(`unknown command: ${command}`);
    process.exit(1);
}
