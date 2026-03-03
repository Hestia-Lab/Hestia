/**
 * Frozen conformance vectors. These pin the exact encodings of the protocol.
 * The circuits (P2) and contracts (P3) MUST reproduce every value here — if any
 * of these changes, the on-chain commitment/nullifier/Merkle math has diverged.
 *
 * Regenerate (after a deliberate, reviewed change) with `pnpm --filter @hestia/common fixtures`.
 */

/** A fixed 32-byte seed (all 0x07) used across the fixtures. */
export const FIXED_SEED_7 = new Uint8Array(32).fill(7);

/** deriveKeysFromSeed(FIXED_SEED_7).SK */
export const SK_7 =
  8735306054926286665320667716248939294890945477428866318513866912521155034218n;

/** First 4 bytes of the derived X25519 public viewing key (VK). */
export const VK_7_PREFIX = [140, 233, 117, 43];

/** labelFromLeafIndex(0) = poseidon([0]) */
export const LABEL_0 =
  19014214495641488759237505126948346942972912379615652741039992445865937985820n;

/**
 * commitment({ value: 1_000_000, token: USDC(baseSepolia), owner: SK_7, label: LABEL_0, randomness: 12345 })
 */
export const COMMITMENT_FIXED =
  9152441458335379777787960014398893267669350046364461180425247781037444832192n;

/** nullifier(COMMITMENT_FIXED, leafIndex=0, sk=SK_7's sk) */
export const NULLIFIER_FIXED =
  21254660070312892225788160217438172667903325227482824467416696950239602984663n;

/** Root of an empty depth-32 tree (ZERO_VALUE = 0). */
export const EMPTY_ROOT_32 =
  21443572485391568159800782191812935835534334817699172242223315142338162256601n;

/** Root after inserting [COMMITMENT_FIXED, 111, 222] into a depth-32 tree. */
export const ROOT_AFTER_3 =
  11618927440053568898380639301824616197959519824639868298383077096496084375088n;

/** The fixed note used to derive COMMITMENT_FIXED / NULLIFIER_FIXED. */
export const FIXED_NOTE = {
  value: 1000000n,
  randomness: 12345n,
} as const;
