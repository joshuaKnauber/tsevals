import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { getRuns } from "../src/ui/api.js";

const apiPlugin: Plugin = {
  name: "typed-evals-api",
  configureServer(server) {
    server.middlewares.use("/api/runs", async (req, res, next) => {
      if (req.method !== "GET") return next();
      const runs = await getRuns(process.cwd());
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(runs));
    });
  },
};

export default defineConfig({
  root: __dirname,
  plugins: [react(), apiPlugin],
  build: {
    outDir: "../dist-ui",
    emptyOutDir: true,
  },
  server: {
    port: 3939,
  },
});
