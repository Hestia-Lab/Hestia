/**
 * Relayer: submits a client-built transact proof on-chain so the withdrawal address has no
 * gas-funding history (SPEC §7). The relayer is reimbursed in-token via the proof-bound
 * feeAmount; it cannot alter recipient/amount/fee (they are bound into the proof).
 */
import type { Address, WalletClient } from "viem";
import { poolAbi } from "./abi.js";
import type { Hex } from "./store.js";

export interface ProofPoints {
  a: readonly [bigint, bigint];
  b: readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
  c: readonly [bigint, bigint];
}

export interface TransactData {
  root: bigint;
  associationRoot: bigint;
  withdrawAmount: bigint;
  token: Address;
  recipient: Address;
  feeAmount: bigint;
  relayer: Address;
}

export interface RelayRequest1x2 {
  proof: ProofPoints;
  nullifiers: readonly [bigint];
  outCommitments: readonly [bigint, bigint];
  data: TransactData;
  encryptedNotes: readonly [Hex, Hex];
}

export interface RelayRequest2x2 {
  proof: ProofPoints;
  nullifiers: readonly [bigint, bigint];
  outCommitments: readonly [bigint, bigint];
  data: TransactData;
  encryptedNotes: readonly [Hex, Hex];
}

function requireAccount(wallet: WalletClient) {
  if (!wallet.account) throw new Error("relayer wallet has no account");
  return wallet.account;
}

export function relayTransact1x2(wallet: WalletClient, pool: Address, r: RelayRequest1x2): Promise<Hex> {
  return wallet.writeContract({
    address: pool,
    abi: poolAbi,
    functionName: "transact1x2",
    args: [r.proof.a, r.proof.b, r.proof.c, r.nullifiers, r.outCommitments, r.data, r.encryptedNotes],
    account: requireAccount(wallet),
    chain: wallet.chain,
  });
}

export function relayTransact2x2(wallet: WalletClient, pool: Address, r: RelayRequest2x2): Promise<Hex> {
  return wallet.writeContract({
    address: pool,
    abi: poolAbi,
    functionName: "transact2x2",
    args: [r.proof.a, r.proof.b, r.proof.c, r.nullifiers, r.outCommitments, r.data, r.encryptedNotes],
    account: requireAccount(wallet),
    chain: wallet.chain,
  });
}
