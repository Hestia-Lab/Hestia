/** The note (UTXO): commitment, nullifier, and label per SPEC §3.2. */
import { poseidon } from "./poseidon.js";
import { assertField, randomFieldElement } from "./field.js";

/**
 * A spendable note. All fields are canonical BN254 field elements.
 * `owner` is the recipient's public spending key `SK = poseidon([sk])`.
 */
export interface Note {
  value: bigint;
  token: bigint;
  owner: bigint;
  label: bigint;
  randomness: bigint;
}

/** Poseidon arities — frozen; the circuits and contracts must use these exactly. */
export const COMMITMENT_ARITY = 5;
export const NULLIFIER_ARITY = 3;

/** commitment = poseidon([value, token, owner, label, randomness]) — field order is canonical. */
export async function commitment(note: Note): Promise<bigint> {
  assertField(note.value, "value");
  assertField(note.token, "token");
  assertField(note.owner, "owner");
  assertField(note.label, "label");
  assertField(note.randomness, "randomness");
  return poseidon([note.value, note.token, note.owner, note.label, note.randomness]);
}

/** nullifier = poseidon([commitment, leafIndex, sk]) — published on spend, binds the note position. */
export async function nullifier(
  commitmentHash: bigint,
  leafIndex: number | bigint,
  sk: bigint,
): Promise<bigint> {
  return poseidon([assertField(commitmentHash, "commitment"), BigInt(leafIndex), assertField(sk, "sk")]);
}

/** A shield deposit's label is derived from its leaf index (SPEC §3.2, §5). */
export async function labelFromLeafIndex(leafIndex: number | bigint): Promise<bigint> {
  return poseidon([BigInt(leafIndex)]);
}

/** Build a note, filling `randomness` with a fresh field element if omitted. */
export function newNote(fields: Omit<Note, "randomness"> & { randomness?: bigint }): Note {
  return { ...fields, randomness: fields.randomness ?? randomFieldElement() };
}
