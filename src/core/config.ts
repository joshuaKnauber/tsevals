import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface TypedEvalsConfig {
  /**
   * Path to the SQLite database file used for run history.
   * Relative paths are resolved from the config file's directory
   * (or the cwd if loaded without a config).
   */
  dbPath?: string;
  /**
   * Glob pattern(s) used to discover eval files.
   * Defaults to `**\/*.eval.?(c|m)[jt]s?(x)`.
   */
  include?: string | string[];
}

export const DEFAULT_INCLUDE = ["**/*.eval.?(c|m)[jt]s?(x)"];

const CONFIG_FILES = [
  "tsevals.config.ts",
  "tsevals.config.mts",
  "tsevals.config.mjs",
  "tsevals.config.js",
  "tsevals.config.json",
];

export function defineConfig(config: TypedEvalsConfig): TypedEvalsConfig {
  return config;
}

export interface LoadedConfig {
  config: TypedEvalsConfig;
  path: string | null;
}

export async function loadConfig(
  cwd: string = process.cwd(),
): Promise<LoadedConfig> {
  for (const name of CONFIG_FILES) {
    const filepath = join(cwd, name);
    if (!existsSync(filepath)) continue;

    if (name.endsWith(".json")) {
      const raw = await readFile(filepath, "utf-8");
      return { config: JSON.parse(raw) as TypedEvalsConfig, path: filepath };
    }

    if (name.endsWith(".mjs") || name.endsWith(".js")) {
      const mod = (await import(pathToFileURL(filepath).href)) as {
        default?: TypedEvalsConfig;
      };
      return { config: mod.default ?? {}, path: filepath };
    }

    const { createJiti } = await import("jiti");
    const jiti = createJiti(import.meta.url, { interopDefault: true });
    const mod = (await jiti.import(filepath)) as TypedEvalsConfig;
    return { config: mod ?? {}, path: filepath };
  }

  return { config: {}, path: null };
}

export function resolveDbPath(
  loaded: LoadedConfig,
  cwd: string = process.cwd(),
): string {
  if (loaded.config.dbPath) {
    if (isAbsolute(loaded.config.dbPath)) return loaded.config.dbPath;
    const base = loaded.path ? resolve(loaded.path, "..") : cwd;
    return resolve(base, loaded.config.dbPath);
  }
  return join(cwd, ".tsevals", "runs.db");
}

export function resolveInclude(loaded: LoadedConfig): string[] {
  const value = loaded.config.include;
  if (value === undefined) return [...DEFAULT_INCLUDE];
  return Array.isArray(value) ? [...value] : [value];
}
