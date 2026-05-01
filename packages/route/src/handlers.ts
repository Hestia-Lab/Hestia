/**
 * Framework-agnostic API logic (SPEC §7). Each returns a JSON-serializable object (bigint ->
 * decimal string) that a Next.js route handler wraps as `Response.json(...)`.
 */
import { TREE_DEPTH } from "@hestia/common";
import type { HestiaStore } from "./store.js";

export function poolState(store: HestiaStore) {
  return {
    root: store.root.toString(),
    leafCount: store.leafCount,
    treeDepth: TREE_DEPTH,
    lastBlock: store.lastBlock.toString(),
  };
}

export function treeProof(store: HestiaStore, leafIndex: number) {
  const p = store.proof(leafIndex);
  return {
    leaf: p.leaf.toString(),
    pathElements: p.pathElements.map((x) => x.toString()),
    pathIndices: p.pathIndices,
    root: p.root.toString(),
  };
}

export function health(store: HestiaStore) {
  return { status: "ok" as const, lastBlock: store.lastBlock.toString(), leafCount: store.leafCount };
}
