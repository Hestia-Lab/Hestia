/**
 * Circuit artifact cache. `@privashh/sdk/node`'s Groth16 prover reads the `poolWithdraw`
 * wasm + zkey from the filesystem, so we download them once from the network backend
 * (paths come from `/api/config`) and cache them on disk for reuse.
 */
import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { absoluteUrl } from "./config.js";

const CACHE_DIR = process.env.PRIVASHH_CACHE_DIR ?? join(tmpdir(), "privashh-mcp", "circuits");

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

/**
 * Ensure the artifact at `urlOrPath` (e.g. "/circuits/poolWithdraw.wasm") is on disk and
 * return its local path. Cached by file name; downloads only on first use.
 */
export async function ensureArtifact(urlOrPath: string): Promise<string> {
  const url = absoluteUrl(urlOrPath);
  const name = url.split("/").pop() || "artifact";
  const dest = join(CACHE_DIR, name);
  if (await exists(dest)) return dest;

  await mkdir(CACHE_DIR, { recursive: true });
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download ${url} failed: ${res.status} ${res.statusText}`);
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(dest));
  return dest;
}
