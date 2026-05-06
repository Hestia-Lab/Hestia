/**
 * Minimal HTTP API for the route service (SPEC §7) — no frontend framework, just node:http.
 * Wires the indexer (polling), the read handlers, and the relayer behind /api/v1/*.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { type Address, createWalletClient, http as viemHttp } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import { loadChainConfig, makePublicClient } from "./chain.js";
import { Indexer } from "./indexer.js";
import { HestiaStore } from "./store.js";
import { associationStatus, health, notesScan, nullifierStatus, poolState, treeProof } from "./handlers.js";
import { relayTransact1x2, relayTransact2x2 } from "./relayer.js";

const big = z.string().regex(/^(0x[0-9a-fA-F]+|\d+)$/);
const pair = z.tuple([big, big]);
const addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

const relaySchema = z.object({
  arity: z.enum(["1x2", "2x2"]),
  proof: z.object({ a: pair, b: z.tuple([pair, pair]), c: pair }),
  nullifiers: z.array(big).min(1).max(2),
  outCommitments: pair,
  data: z.object({
    root: big,
    associationRoot: big,
    withdrawAmount: big,
    token: addr,
    recipient: addr,
    feeAmount: big,
    relayer: addr,
  }),
  encryptedNotes: z.tuple([z.string(), z.string()]),
});

function json(res: ServerResponse, code: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(code, { "content-type": "application/json" });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

export interface ServerOptions {
  port?: number;
  pollMs?: number;
  relayerKey?: `0x${string}`;
}

export async function startServer(opts: ServerOptions = {}) {
  const cfg = loadChainConfig();
  const publicClient = makePublicClient(cfg);
  const store = await HestiaStore.create();
  const indexer = new Indexer(publicClient, cfg.poolAddress, cfg.registryAddress, store);
  await indexer.sync();
  const poll = setInterval(() => {
    indexer.sync().catch((e) => console.error("[indexer] sync failed:", e));
  }, opts.pollMs ?? 4000);

  const relayerKey = opts.relayerKey ?? (process.env.HESTIA_RELAYER_KEY as `0x${string}` | undefined);
  const wallet = relayerKey
    ? createWalletClient({ account: privateKeyToAccount(relayerKey), chain: cfg.chain, transport: viemHttp(cfg.rpcUrl) })
    : undefined;

  const server = createServer((req, res) => {
    route(req, res, store, cfg.poolAddress, wallet).catch((e) => json(res, 500, { error: String(e) }));
  });
  const port = opts.port ?? Number(process.env.PORT ?? 8787);
  await new Promise<void>((resolve) => server.listen(port, resolve));
  console.log(`hestia route listening on :${port} (chain=${cfg.chain.name})`);

  return { server, stop: () => { clearInterval(poll); server.close(); } };
}

async function route(
  req: IncomingMessage,
  res: ServerResponse,
  store: HestiaStore,
  pool: Address,
  wallet: ReturnType<typeof createWalletClient> | undefined,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const p = url.pathname;
  const q = url.searchParams;

  if (req.method === "GET") {
    if (p === "/api/v1/health") return json(res, 200, health(store));
    if (p === "/api/v1/pool/state") return json(res, 200, poolState(store));
    if (p === "/api/v1/tree/proof") return json(res, 200, treeProof(store, Number(q.get("leaf"))));
    if (p === "/api/v1/notes/scan") return json(res, 200, notesScan(store, BigInt(q.get("since") ?? "0")));
    if (p === "/api/v1/association/status") return json(res, 200, associationStatus(store, BigInt(q.get("root") ?? "0")));
    if (p === "/api/v1/nullifier/status") return json(res, 200, nullifierStatus(store, BigInt(q.get("nullifier") ?? "0")));
  }

  json(res, 404, { error: "not found" });
}

