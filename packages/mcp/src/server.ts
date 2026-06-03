/**
 * MCP server exposing the live Privashh L3 Privacy Pool (shh.gg) to AI agents.
 *
 * Five tools, all "read + prepare" — the server never holds a private key:
 *   privashh_get_config       discover the live network (chain, contracts, relayer, denomination)
 *   privashh_get_pool         pool snapshot (deposit count + state root)
 *   privashh_get_association  a commitment's inclusion path in the association set (compliance)
 *   privashh_prepare_deposit  build a note + UNSIGNED deposit tx for the caller's wallet to sign
 *   privashh_withdraw         prove locally + submit a gasless withdrawal via the relayer
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { getConfig } from "./config.js";
import { getAssociation, getPoolState, prepareDeposit, withdraw } from "./pool.js";

const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const fail = (e: unknown) => ({
  isError: true,
  content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
});

export function createServer(): McpServer {
  const server = new McpServer({ name: "privashh-mcp", version: "0.1.0" });

  server.registerTool(
    "privashh_get_config",
    {
      title: "Get network config",
      description:
        "Discover the live Privashh L3 network: chain id, RPC URL, Privacy Pool / ASP / hasher " +
        "contract addresses, the relayer address + fee (basis points), and the pool denomination.",
    },
    async () => {
      try {
        return ok(await getConfig());
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "privashh_get_pool",
    {
      title: "Get pool state",
      description:
        "Snapshot of the Privacy Pool: number of deposits indexed, the current Merkle state root, " +
        "and the fixed denomination (wei) every deposit/withdrawal uses.",
    },
    async () => {
      try {
        return ok(await getPoolState());
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "privashh_get_association",
    {
      title: "Get association status",
      description:
        "Look up a deposit commitment's inclusion path in the current association set (the " +
        "compliance-approved subset a withdrawal must prove membership in). Returns 404 if the " +
        "commitment is not in the set.",
      inputSchema: {
        commitment: z.string().describe("Deposit commitment, 0x-prefixed bytes32 hex."),
      },
    },
    async ({ commitment }) => {
      try {
        return ok(await getAssociation(commitment));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "privashh_prepare_deposit",
    {
      title: "Prepare a deposit",
      description:
        "Create a Privacy Pool note and return an UNSIGNED deposit transaction for the caller's " +
        "wallet to sign and send (value = the fixed denomination). Returns the note's nullifier " +
        "and secret — SAVE THEM, they are the only way to withdraw and are not stored here. " +
        "Pass an existing nullifier/secret to reproduce a note's commitment.",
      inputSchema: {
        nullifier: z.string().optional().describe("Optional existing note nullifier (decimal or 0x hex)."),
        secret: z.string().optional().describe("Optional existing note secret (decimal or 0x hex)."),
      },
    },
    async ({ nullifier, secret }) => {
      try {
        return ok(await prepareDeposit({ nullifier, secret }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "privashh_withdraw",
    {
      title: "Withdraw (gasless)",
      description:
        "Withdraw a deposited note to any recipient. Generates the zero-knowledge proof locally " +
        "and submits it gaslessly through the network relayer — no key or gas needed from the " +
        "caller. The proof binds recipient + relayer + fee, so they cannot be altered. The " +
        "recipient receives (denomination − fee). Set submit=false to get the relayer-ready " +
        "payload without sending it.",
      inputSchema: {
        nullifier: z.string().describe("The note's nullifier (from prepare_deposit)."),
        secret: z.string().describe("The note's secret (from prepare_deposit)."),
        recipient: z.string().describe("Address to receive the funds (0x, checksummed or not)."),
        fee: z
          .string()
          .optional()
          .describe("Relayer fee in wei (decimal). Defaults to the relayer's advertised minimum."),
        submit: z
          .boolean()
          .optional()
          .describe("Submit via the relayer (default true). false returns the payload only."),
      },
    },
    async ({ nullifier, secret, recipient, fee, submit }) => {
      try {
        return ok(await withdraw({ nullifier, secret, recipient, fee, submit }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  return server;
}
