/**
 * @hestia/route — the convenience layer's core: indexer, in-memory store, relayer, and
 * framework-agnostic API handlers (SPEC §7). A thin Next.js app wraps these as route handlers.
 *
 * Trust-minimized: it indexes public chain state and relays transactions; it cannot steal,
 * forge, or deanonymize beyond what is already public. Agents may self-host.
 */
export const ROUTE_API_VERSION = "v1" as const;

export * from "./store.js";
export * from "./chain.js";
export * from "./indexer.js";
export * from "./relayer.js";
export * from "./handlers.js";
export { startServer, type ServerOptions } from "./server.js";
export { poolAbi, registryAbi } from "./abi.js";
