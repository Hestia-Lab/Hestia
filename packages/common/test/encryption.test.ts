import { describe, expect, it } from "vitest";
import { decryptNote, deriveKeysFromSeed, encryptNote } from "../src/index.js";
import { FIXED_SEED_7 } from "./fixtures.js";

const plaintext = { value: 1000000n, token: 5n, label: 7n, randomness: 999n };

describe("note encryption", () => {
  it("round-trips for the correct viewing key", async () => {
    const k = await deriveKeysFromSeed(FIXED_SEED_7);
    const blob = encryptNote(k.VK, plaintext);
    expect(decryptNote(k.vk, blob)).toEqual(plaintext);
  });

  it("is non-deterministic (fresh ephemeral key per call)", async () => {
    const k = await deriveKeysFromSeed(FIXED_SEED_7);
    expect(encryptNote(k.VK, plaintext)).not.toEqual(encryptNote(k.VK, plaintext));
  });

  it("returns null for the wrong viewing key", async () => {
    const k = await deriveKeysFromSeed(FIXED_SEED_7);
    const other = await deriveKeysFromSeed(new Uint8Array(32).fill(9));
    expect(decryptNote(other.vk, encryptNote(k.VK, plaintext))).toBeNull();
  });

  it("returns null on a tampered ciphertext", async () => {
    const k = await deriveKeysFromSeed(FIXED_SEED_7);
    const blob = encryptNote(k.VK, plaintext);
    blob[blob.length - 1] ^= 0x01;
    expect(decryptNote(k.vk, blob)).toBeNull();
  });
});
