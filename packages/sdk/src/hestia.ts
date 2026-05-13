/**
 * Hestia — the single surface an agent uses to move value privately on Base (SPEC §8).
 * Wraps key management, self-indexing, note discovery, coin selection, proof generation,
 * and submission behind shield / send / unshield / balance.
 */
import {
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
  bytesToHex,
  createPublicClient,
  createWalletClient,
  erc20Abi,
  hexToBytes,
  http,
  zeroAddress,
} from "viem";
import {
  type ChainName,
  type Keys,
  type Note,
  addressToField,
  commitment,
  decodeMetaAddress,
  encodeMetaAddress,
  encryptNote,
  decryptNote,
  labelFromLeafIndex,
  NATIVE_ETH,
  nullifier,
  randomFieldElement,
} from "@hestia/common";
import {
  HestiaStore,
  Indexer,
  poolAbi,
  relayTransact1x2,
  type RelayRequest1x2,
  type TransactData,
} from "@hestia/route";
import { type ArtifactsByArity } from "@hestia/circuits";
import { type AssociationProvider } from "./associationSet.js";
import { proveTransactionWitness, type SpendInput } from "./proof.js";

export class InsufficientPrivateBalance extends Error {
  constructor(token: bigint, required: bigint) {
    super(`insufficient private balance for token ${token}: need at least ${required} in a single note`);
    this.name = "InsufficientPrivateBalance";
  }
}

export interface HestiaConfig {
  chain: Chain;
  rpcUrl: string;
  pool: Address;
  registry: Address;
  usdc: Address;
  account: Account | Address; // submitter / relayer / shield funder (pays gas)
  keys: Keys; // shielded identity (spending + viewing)
  association: AssociationProvider;
  artifacts: ArtifactsByArity; // circuit wasm/zkey sources (file paths in node, URLs in browser)
  transport?: Transport; // wallet transport (e.g. custom(window.ethereum) in the browser); default http(rpcUrl)
  metaChain?: ChainName; // chain tag for the shared meta-address (default baseSepolia)
}

interface NoteRecord {
  note: Note;
  leafIndex: number;
  commitment: bigint;
  nullifier: bigint;
  spent: boolean;
}

interface SubmitParams {
  input: SpendInput;
  outputs: [Note, Note];
  encryptedNotes: [Hex, Hex];
  token: Address;
  tokenField: bigint;
  withdrawAmount: bigint;
  recipientAddr: Address;
  fee: bigint;
}

export class Hestia {
  readonly keys: Keys;
  private readonly account: Account | Address;
  private readonly address: Address;
  private readonly chain: Chain;
  private readonly pool: Address;
  private readonly registry: Address;
  private readonly usdc: Address;
  private readonly association: AssociationProvider;
  private readonly artifacts: ArtifactsByArity;
  private readonly metaChain: ChainName;
  private readonly publicClient: PublicClient;
  private readonly wallet: WalletClient;
  private readonly store: HestiaStore;
  private readonly indexer: Indexer;

  private constructor(cfg: HestiaConfig, store: HestiaStore, publicClient: PublicClient, wallet: WalletClient) {
    this.keys = cfg.keys;
    this.account = cfg.account;
    this.address = typeof cfg.account === "string" ? cfg.account : cfg.account.address;
    this.chain = cfg.chain;
    this.pool = cfg.pool;
    this.registry = cfg.registry;
    this.usdc = cfg.usdc;
    this.association = cfg.association;
    this.artifacts = cfg.artifacts;
    this.metaChain = cfg.metaChain ?? "baseSepolia";
    this.publicClient = publicClient;
    this.wallet = wallet;
    this.store = store;
    this.indexer = new Indexer(publicClient, cfg.pool, cfg.registry, store);
  }

  static async create(cfg: HestiaConfig): Promise<Hestia> {
    const publicClient = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpcUrl) });
    const wallet = createWalletClient({ account: cfg.account, chain: cfg.chain, transport: cfg.transport ?? http(cfg.rpcUrl) });
    const store = await HestiaStore.create();
    return new Hestia(cfg, store, publicClient as PublicClient, wallet);
  }

  /** The address others use to pay this agent privately. */
  get metaAddress(): string {
    return encodeMetaAddress({ chain: this.metaChain, SK: this.keys.SK, VK: this.keys.VK });
  }

  /** Hand to an auditor for selective disclosure of this agent's full history (SPEC §6). */
  exportViewingKey(): Hex {
    return bytesToHex(this.keys.vk);
  }

  /** Pull new chain events into the local index. Call before reading balance / spending. */
  async sync(): Promise<void> {
    await this.indexer.sync();
  }

  async balance(token: Address): Promise<bigint> {
    const tf = this.tokenField(token);
    const notes = await this.ownedNotes();
    return notes.filter((r) => !r.spent && r.note.token === tf).reduce((sum, r) => sum + r.note.value, 0n);
  }




  // --- internals ---

  private tokenField(token: Address): bigint {
    return token.toLowerCase() === NATIVE_ETH.toLowerCase() ? 0n : addressToField(token);
  }

  private async ownedNotes(): Promise<NoteRecord[]> {
    const records: NoteRecord[] = [];
    for (const indexed of this.store.notesSince(0n)) {
      const pt = decryptNote(this.keys.vk, hexToBytes(indexed.encryptedNote));
      if (!pt) continue;
      const note: Note = { value: pt.value, token: pt.token, owner: this.keys.SK, label: pt.label, randomness: pt.randomness };
      const c = await commitment(note);
      if (c !== indexed.commitment) continue; // ciphertext decrypted but isn't a note we own
      const nf = await nullifier(c, indexed.leafIndex, this.keys.sk);
      records.push({ note, leafIndex: indexed.leafIndex, commitment: c, nullifier: nf, spent: this.store.isNullified(nf) });
    }
    return records;
  }

  private async selectNote(tokenField: bigint, required: bigint): Promise<SpendInput> {
    const notes = await this.ownedNotes();
    // Single-lineage: one input note per tx (1x2). Pick the smallest note that covers `required`.
    const candidate = notes
      .filter((r) => r.note.token === tokenField && r.note.value >= required)
      .sort((a, b) => (a.note.value < b.note.value ? -1 : 1))[0];
    if (!candidate) throw new InsufficientPrivateBalance(tokenField, required);
    return { note: candidate.note, leafIndex: candidate.leafIndex, merkleProof: this.store.proof(candidate.leafIndex) };
  }

}
