import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: ["node_modules", "dist", "**/*.eval.?(c|m)[jt]s?(x)"],
  },
  resolve: {
    alias: {
      "tsevals": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
    },
  },
});
