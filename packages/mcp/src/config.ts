/**
 * Runtime discovery of the live Privashh L3 (shh) network. Everything — chain id, RPC,
 * contract addresses, relayer, denomination, circuit artifact paths — is served by the
 * network's wallet backend at `GET /api/config`, so the server needs zero hard-coded
 * deployment values. Override the origin with `PRIVASHH_BASE_URL` (e.g. a local devnet).
 */

export interface NetworkConfig {
  network: string;
  chainId: number;
  rpcUrl: string;
  profile: string;
  /** Pool denomination in wei, as a decimal string (e.g. "100000000000000000" = 0.1 ETH). */
  denomination: string;
  contracts: {
    privacyPool: string;
    shieldedPool: string;
    associationSetProvider: string;
    hasher: string;
  };
  circuits: {
    poolWithdraw: { wasm: string; zkey: string };
    transaction2x2?: { wasm: string; zkey: string };
  };
  relayer: { address: string; feeBps: number };
}

/** Base origin of the network backend (no trailing slash). */
export const BASE_URL = (process.env.PRIVASHH_BASE_URL ?? "https://shh.gg").replace(/\/+$/, "");

let cached: Promise<NetworkConfig> | undefined;

/** Fetch and memoize the live network config. */
export function getConfig(): Promise<NetworkConfig> {
  cached ??= (async () => {
    const res = await fetch(`${BASE_URL}/api/config`);
    if (!res.ok) throw new Error(`GET ${BASE_URL}/api/config failed: ${res.status} ${res.statusText}`);
    return (await res.json()) as NetworkConfig;
  })();
  return cached;
}

/** Resolve a backend-relative path (e.g. "/circuits/poolWithdraw.wasm") to an absolute URL. */
export function absoluteUrl(pathOrUrl: string): string {
  return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${BASE_URL}${pathOrUrl}`;
}
