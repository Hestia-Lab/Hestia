# @hestia/mcp

An **MCP server** that makes the live **Privashh L3** privacy network (a Base‑settled OP‑Stack
L3 — chain `55666`, backend at [shh.gg](https://shh.gg)) callable by AI agents as tool calls.
It wraps [`@privashh/sdk`](https://www.npmjs.com/package/@privashh/sdk) and the network's wallet
backend, so any MCP‑capable agent (Claude Desktop, Claude Code, …) can read pool state, prepare
deposits, and run gasless withdrawals from the fixed‑denomination Privacy Pool.

## Model: read + prepare, no key custody

The server **never holds a private key**.

- **Reads** are live (config, pool state, association status).
- **Deposits** are returned as an **unsigned transaction** — the caller signs and sends it from
  their own wallet. The note's `nullifier`/`secret` are returned once; **save them**, they are
  the only way to withdraw and are not stored.
- **Withdrawals** are proved locally (Groth16) and submitted **gaslessly through the network
  relayer**. The proof binds `recipient`, `relayer`, and `fee`, so the relayer cannot redirect
  funds or inflate the fee — it can only refuse to serve.

It is **zero‑config**: chain id, RPC, contract addresses, relayer, denomination, and circuit
artifact locations are all discovered at runtime from `GET /api/config`.

## Tools

| Tool | Input | Returns |
| --- | --- | --- |
| `privashh_get_config` | — | network id, RPC, contracts, relayer (+ fee bps), denomination |
| `privashh_get_pool` | — | deposit count, Merkle state root, denomination |
| `privashh_get_association` | `commitment` | inclusion path of a commitment in the association set |
| `privashh_prepare_deposit` | `nullifier?`, `secret?` | note secrets + **unsigned** `deposit` tx |
| `privashh_withdraw` | `nullifier`, `secret`, `recipient`, `fee?`, `submit?` | relayer `txHash` (or the payload when `submit:false`) |

## Run

```bash
pnpm --filter @hestia/mcp build
hestia-mcp            # stdio transport (local agents)
hestia-mcp --http     # stateless Streamable HTTP on :3399 (POST /mcp)
```

### Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "privashh": { "command": "hestia-mcp" }
  }
}
```

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `PRIVASHH_BASE_URL` | `https://shh.gg` | network backend origin (point at a local devnet to test) |
| `PRIVASHH_CACHE_DIR` | `<tmp>/privashh-mcp/circuits` | where the proving wasm/zkey are cached |
| `PORT` | `3399` | HTTP port when run with `--http` |

> ⚠️ **Testnet only.** Privashh L3 ships with a single‑contributor (development) trusted setup
> — it must not secure real funds until a multi‑party ceremony and audit are complete.
