/**
 * Agent-tool adapter (SPEC §8): exposes shield / send / unshield / balance as typed tools
 * an LLM agent can call. Shape is framework-neutral (name + JSON-schema params + execute).
 */
import type { Address } from "viem";
import type { Hestia } from "./hestia.js";

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

const tokenParam = {
  token: { type: "string", description: "Token address; use the zero address for native ETH." },
};

export function createHestiaTools(hestia: Hestia): AgentTool[] {
  return [
    {
      name: "hestia_balance",
      description: "Private balance held in the shielded pool for a token.",
      parameters: { type: "object", properties: { ...tokenParam }, required: ["token"] },
      execute: async (a) => {
        await hestia.sync();
        const bal = await hestia.balance(a.token as Address);
        return { token: a.token, balance: bal.toString() };
      },
    },
    {
      name: "hestia_shield",
      description: "Deposit a token into the shielded pool (becomes a private balance).",
      parameters: {
        type: "object",
        properties: { ...tokenParam, amount: { type: "string", description: "Base-unit amount." } },
        required: ["token", "amount"],
      },
      execute: async (a) => ({ txHash: await hestia.shield({ token: a.token as Address, amount: BigInt(a.amount as string) }) }),
    },
    {
      name: "hestia_send",
      description: "Privately transfer a shielded balance to another agent's Hestia meta-address.",
      parameters: {
        type: "object",
        properties: {
          ...tokenParam,
          amount: { type: "string" },
          to: { type: "string", description: "Recipient Hestia meta-address (hestia1...)." },
        },
        required: ["token", "amount", "to"],
      },
      execute: async (a) => {
        await hestia.sync();
        return { txHash: await hestia.send({ token: a.token as Address, amount: BigInt(a.amount as string), to: a.to as string }) };
      },
    },
    {
      name: "hestia_unshield",
      description: "Withdraw a shielded balance to a clean public address (relayer pays gas).",
      parameters: {
        type: "object",
        properties: { ...tokenParam, amount: { type: "string" }, to: { type: "string", description: "Public recipient address." } },
        required: ["token", "amount", "to"],
      },
      execute: async (a) => {
        await hestia.sync();
        return { txHash: await hestia.unshield({ token: a.token as Address, amount: BigInt(a.amount as string), to: a.to as Address }) };
      },
    },
  ];
}
