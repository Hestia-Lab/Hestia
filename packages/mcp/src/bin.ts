#!/usr/bin/env node
/**
 * CLI entry for the Privashh L3 MCP server.
 *   hestia-mcp            → stdio transport (for Claude Desktop / Claude Code / local agents)
 *   hestia-mcp --http [p] → stateless Streamable HTTP on port p (default 3399, or $PORT)
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createServer } from "./server.js";

async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // The process now stays alive serving requests over stdio.
}

async function runHttp(port: number): Promise<void> {
  const { createServer: createHttpServer } = await import("node:http");
  const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");

  const httpServer = createHttpServer((req, res) => {
    void (async () => {
      const path = new URL(req.url ?? "/", "http://localhost").pathname;
      if (req.method !== "POST" || path !== "/mcp") {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "POST /mcp only" }));
        return;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      let body: unknown;
      try {
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "invalid JSON body" }));
        return;
      }

      // Stateless: a fresh server + transport per request.
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    })().catch((e) => {
      if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
    });
  });

  httpServer.listen(port, () => {
    // stderr, so stdout stays clean for any stdio co-tenant.
    console.error(`privashh-mcp HTTP listening on http://127.0.0.1:${port}/mcp`);
  });
}

const args = process.argv.slice(2);
const httpFlag = args.indexOf("--http");

if (httpFlag !== -1) {
  const parsed = Number(args[httpFlag + 1] ?? process.env.PORT ?? 3399);
  void runHttp(Number.isFinite(parsed) ? parsed : 3399).catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  void runStdio().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
