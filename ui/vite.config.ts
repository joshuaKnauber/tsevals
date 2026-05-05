import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { getRuns, setRunNote } from "../src/ui/api.js";

const NOTE_PATH = /^\/([^/]+)\/note$/;

const apiPlugin: Plugin = {
  name: "typed-evals-api",
  configureServer(server) {
    server.middlewares.use("/api/runs", async (req, res, next) => {
      const subpath = req.url ?? "/";

      if (subpath === "/" && req.method === "GET") {
        const runs = await getRuns(process.cwd());
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(runs));
        return;
      }

      const noteMatch = subpath.match(NOTE_PATH);
      if (noteMatch && req.method === "POST") {
        const runId = decodeURIComponent(noteMatch[1]!);
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as {
            note?: unknown;
          };
          const note =
            typeof body.note === "string" && body.note.trim()
              ? body.note.trim()
              : null;
          await setRunNote(runId, note, process.cwd());
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
        return;
      }

      next();
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
