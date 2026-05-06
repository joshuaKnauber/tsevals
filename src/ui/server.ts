import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getRuns, setRunNote } from "./api.js";

export interface UiServerOptions {
  port?: number;
  staticDir?: string;
  cwd?: string;
  dbPath?: string;
}

const NOTE_ROUTE = /^\/api\/runs\/([^/]+)\/note$/;

function resolveStaticDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "..", "dist-ui"),
    join(here, "..", "..", "dist-ui"),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, "index.html"))) return c;
  }
  throw new Error(
    `dist-ui not found. Run: npm run build:ui\nTried:\n  ${candidates.join("\n  ")}`,
  );
}

export async function startUiServer(options: UiServerOptions = {}): Promise<void> {
  const port = options.port ?? 3939;
  const cwd = options.cwd ?? process.cwd();
  const dbPath = options.dbPath;
  const staticDir = options.staticDir ?? resolveStaticDir();

  const server = createServer(async (req, res) => {
    const url = req.url ?? "/";

    if (url === "/api/runs" && req.method === "GET") {
      const runs = await getRuns(dbPath);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(runs));
      return;
    }

    const noteMatch = url.match(NOTE_ROUTE);
    if (noteMatch && req.method === "POST") {
      const runId = decodeURIComponent(noteMatch[1]!);
      try {
        const body = await readJson<{ note: string | null }>(req);
        await setRunNote(runId, normalizeNote(body.note), dbPath);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
      return;
    }

    const file = url === "/" ? "/index.html" : url.split("?")[0]!;
    try {
      const content = await readFile(join(staticDir, file));
      res.writeHead(200, { "content-type": contentTypeFor(file) });
      res.end(content);
      return;
    } catch {
      try {
        const content = await readFile(join(staticDir, "index.html"));
        res.writeHead(200, { "content-type": "text/html" });
        res.end(content);
      } catch {
        notFound(res);
      }
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      console.log(`tsevals: ui at http://localhost:${port}`);
      resolve();
    });
  });
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
}

function normalizeNote(note: unknown): string | null {
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  return trimmed === "" ? null : trimmed;
}

function notFound(res: ServerResponse): void {
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not found");
}

function contentTypeFor(file: string): string {
  if (file.endsWith(".html")) return "text/html";
  if (file.endsWith(".js") || file.endsWith(".mjs")) return "application/javascript";
  if (file.endsWith(".css")) return "text/css";
  if (file.endsWith(".json")) return "application/json";
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}
