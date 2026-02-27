/**
 * Note encryption (SPEC §3.3): X25519 ECDH + HKDF-SHA256 + ChaCha20-Poly1305.
 *
 * Sealed-box style: the sender uses a fresh ephemeral keypair, so it needs only the
 * recipient's public `VK`. The ciphertext is `ephemeralPub(32) ‖ aead`. Off-circuit —
 * encryption is never proven, so it need not be snark-friendly.
 */
import { x25519 } from "@noble/curves/ed25519.js";
import { chacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { concatBytes, randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { bigIntToBytes32BE, bytesToBigIntBE } from "./field.js";

/** The decryptable payload of a note (owner is implied — it is the recipient's own SK). */
export interface NotePlaintext {
  value: bigint;
  token: bigint;
  label: bigint;
  randomness: bigint;
}

const PLAINTEXT_BYTES = 128; // 4 × 32-byte big-endian field elements
const HKDF_INFO = utf8ToBytes("hestia-note-v1");

function serialize(p: NotePlaintext): Uint8Array {
  return concatBytes(
    bigIntToBytes32BE(p.value),
    bigIntToBytes32BE(p.token),
    bigIntToBytes32BE(p.label),
    bigIntToBytes32BE(p.randomness),
  );
}

function deserialize(b: Uint8Array): NotePlaintext {
  return {
    value: bytesToBigIntBE(b.subarray(0, 32)),
    token: bytesToBigIntBE(b.subarray(32, 64)),
    label: bytesToBigIntBE(b.subarray(64, 96)),
    randomness: bytesToBigIntBE(b.subarray(96, 128)),
  };
}

/** Derive a single-use key+nonce from the shared secret, bound to both public keys. */
function deriveKeyNonce(shared: Uint8Array, ephemeralPub: Uint8Array, recipientPub: Uint8Array) {
  const salt = concatBytes(ephemeralPub, recipientPub);
  const out = hkdf(sha256, shared, salt, HKDF_INFO, 44); // 32-byte key + 12-byte nonce
  return { key: out.subarray(0, 32), nonce: out.subarray(32, 44) };
}

/** Encrypt a note to the recipient's `VK`. Returns `ephemeralPub ‖ ciphertext`. */
export function encryptNote(recipientVK: Uint8Array, plaintext: NotePlaintext): Uint8Array {
  const ephemeralSecret = randomBytes(32);
  const ephemeralPub = x25519.getPublicKey(ephemeralSecret);
  const shared = x25519.getSharedSecret(ephemeralSecret, recipientVK);
  const { key, nonce } = deriveKeyNonce(shared, ephemeralPub, recipientVK);
  const ciphertext = chacha20poly1305(key, nonce).encrypt(serialize(plaintext));
  return concatBytes(ephemeralPub, ciphertext);
}

/**
 * Try to decrypt a note blob with the recipient's viewing secret `vk`.
 * Returns the plaintext if the AEAD tag verifies (the note is ours), else `null`.
 */
export function decryptNote(vk: Uint8Array, blob: Uint8Array): NotePlaintext | null {
  if (blob.length < 32 + 16) return null;
  const ephemeralPub = blob.subarray(0, 32);
  const ciphertext = blob.subarray(32);
  const recipientVK = x25519.getPublicKey(vk);
  const shared = x25519.getSharedSecret(vk, ephemeralPub);
  const { key, nonce } = deriveKeyNonce(shared, ephemeralPub, recipientVK);
  try {
    const pt = chacha20poly1305(key, nonce).decrypt(ciphertext);
    if (pt.length !== PLAINTEXT_BYTES) return null;
    return deserialize(pt);
  } catch {
    return null;
  }
}
