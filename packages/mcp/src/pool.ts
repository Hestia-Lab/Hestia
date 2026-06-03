/**
 * Privacy Pool glue over `@privashh/sdk`, built around the live network's "read + prepare"
 * model — this server never holds a key:
 *   • deposits are returned as an UNSIGNED transaction for the caller's wallet to sign;
 *   • withdrawals are proved locally and submitted gaslessly through the network relayer
 *     (the proof binds recipient/relayer/fee, so the relayer cannot redirect or inflate them).
 */
import { Interface, getAddress, isAddress } from "ethers";
import { LEVELS, MerkleTree, PoolNote, toFixedHex } from "@privashh/sdk";
import { generatePoolWithdraw } from "@privashh/sdk/node";

import { BASE_URL, getConfig } from "./config.js";
import { ensureArtifact } from "./artifacts.js";

const POOL_ABI = new Interface(["function deposit(bytes32 commitment) payable"]);

interface LeavesResponse {
  count: number;
  leaves: { commitment: string; leafIndex: number }[];
}

/** Fetch all deposit commitments and rebuild the trees the withdrawal circuit needs. */
async function loadTrees(): Promise<{ stateTree: MerkleTree; associationTree: MerkleTree; count: number }> {
  const res = await fetch(`${BASE_URL}/api/pool/leaves`);
  if (!res.ok) throw new Error(`GET ${BASE_URL}/api/pool/leaves failed: ${res.status}`);
  const { leaves } = (await res.json()) as LeavesResponse;
  const ordered = [...leaves].sort((x, y) => x.leafIndex - y.leafIndex).map((l) => BigInt(l.commitment));
  const stateTree = await MerkleTree.create(ordered, LEVELS);
  // Open-pool profile: the Association Set Provider currently approves every deposit, so the
  // association tree is built from the same leaves. (A policy-filtered ASP would publish a
  // subset; this stays correct as long as `associationRoot` matches the on-chain ASP root.)
  const associationTree = await MerkleTree.create(ordered, LEVELS);
  return { stateTree, associationTree, count: ordered.length };
}

/** Live pool snapshot: number of deposits, current state root, denomination. */
export async function getPoolState(): Promise<{ count: number; root: string; denomination: string }> {
  const cfg = await getConfig();
  const { stateTree, count } = await loadTrees();
  return { count, root: toFixedHex(stateTree.root()), denomination: cfg.denomination };
}

/** Inclusion path of a commitment in the current association set (compliance status). */
export async function getAssociation(commitment: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/api/association/${commitment}`);
  const body = await res.json();
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `association lookup failed: ${res.status}`);
  return body;
}

export interface PreparedDeposit {
  commitment: string;
  note: { nullifier: string; secret: string };
  transaction: { to: string; value: string; data: string; chainId: number };
  denomination: string;
  warning: string;
}

/**
 * Build a note and the unsigned `deposit(commitment)` transaction. The caller signs and sends
 * it from their own wallet (value = the fixed denomination). The returned note secrets are the
 * ONLY thing needed to withdraw later — losing them means losing the funds.
 */
export async function prepareDeposit(opts: { nullifier?: string; secret?: string } = {}): Promise<PreparedDeposit> {
  const cfg = await getConfig();
  const note = new PoolNote(
    opts.nullifier != null ? BigInt(opts.nullifier) : undefined,
    opts.secret != null ? BigInt(opts.secret) : undefined,
  );
  const commitment = await note.commitment();
  const data = POOL_ABI.encodeFunctionData("deposit", [toFixedHex(commitment)]);

  return {
    commitment: toFixedHex(commitment),
    note: { nullifier: note.nullifier.toString(), secret: note.secret.toString() },
    transaction: { to: cfg.contracts.privacyPool, value: cfg.denomination, data, chainId: cfg.chainId },
    denomination: cfg.denomination,
    warning:
      "SAVE note.nullifier and note.secret now — they are the only way to withdraw, and this " +
      "server does not store them. Send the transaction from a wallet on chain " +
      `${cfg.chainId} with value exactly ${cfg.denomination} wei.`,
  };
}

export interface WithdrawArgs {
  nullifier: string;
  secret: string;
  recipient: string;
  /** Relayer fee in wei (decimal). Defaults to the relayer's advertised minimum. */
  fee?: string;
  /** When false, return the relayer-ready payload instead of submitting it. */
  submit?: boolean;
}

/** Build a hex coordinate the on-chain verifier / relayer expects (32-byte left-padded). */
const hx = (v: bigint): string => toFixedHex(v);

export async function withdraw(args: WithdrawArgs): Promise<unknown> {
  if (!isAddress(args.recipient)) throw new Error(`recipient is not a valid address: ${args.recipient}`);
  const recipient = getAddress(args.recipient);
  const cfg = await getConfig();

  const denom = BigInt(cfg.denomination);
  const minFee = (denom * BigInt(cfg.relayer.feeBps)) / 10000n;
  const fee = args.fee != null ? BigInt(args.fee) : minFee;
  if (fee < minFee) throw new Error(`fee ${fee} is below the relayer minimum ${minFee} wei`);
  if (fee > denom) throw new Error(`fee ${fee} exceeds the pool denomination ${denom} wei`);

  const note = new PoolNote(BigInt(args.nullifier), BigInt(args.secret));
  const { stateTree, associationTree } = await loadTrees();
  const commitment = await note.commitment();
  if (stateTree.indexOf(commitment) < 0) {
    throw new Error("this note is not in the pool — it was never deposited, or the deposit is not yet indexed");
  }

  const [wasmPath, zkeyPath] = await Promise.all([
    ensureArtifact(cfg.circuits.poolWithdraw.wasm),
    ensureArtifact(cfg.circuits.poolWithdraw.zkey),
  ]);

  const { proof, stateRoot, associationRoot, nullifierHash } = await generatePoolWithdraw({
    note,
    stateTree,
    associationTree,
    recipient: BigInt(recipient),
    relayer: BigInt(cfg.relayer.address), // MUST match the relayer that submits it
    fee,
    refund: 0n, // relayer only serves refund-free withdrawals
    wasmPath,
    zkeyPath,
  });

  const payload = {
    a: [hx(proof.a[0]), hx(proof.a[1])],
    b: [
      [hx(proof.b[0][0]), hx(proof.b[0][1])],
      [hx(proof.b[1][0]), hx(proof.b[1][1])],
    ],
    c: [hx(proof.c[0]), hx(proof.c[1])],
    stateRoot: hx(stateRoot),
    associationRoot: hx(associationRoot),
    nullifierHash: hx(nullifierHash),
    recipient,
    fee: fee.toString(),
    refund: "0",
  };

  const payout = (denom - fee).toString();

  if (args.submit === false) {
    return {
      submitted: false,
      payout,
      fee: fee.toString(),
      recipient,
      relayerPayload: payload,
      hint: `POST this payload to ${BASE_URL}/api/relayer/withdraw to execute the gasless withdrawal.`,
    };
  }

  const res = await fetch(`${BASE_URL}/api/relayer/withdraw`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as { txHash?: string; relayer?: string; error?: string };
  if (!res.ok) throw new Error(body.error ?? `relayer rejected the withdrawal: ${res.status}`);

  return { submitted: true, txHash: body.txHash, relayer: body.relayer, recipient, fee: fee.toString(), payout };
}
