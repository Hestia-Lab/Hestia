import { describe, expect, it } from "vitest";
import { deriveKeysFromSeed, deriveKeysFromSignature } from "../src/index.js";
import { FIXED_SEED_7, SK_7, VK_7_PREFIX } from "./fixtures.js";

describe("keys", () => {
  it("derivation is deterministic and matches fixtures", async () => {
    const a = await deriveKeysFromSeed(FIXED_SEED_7);
    const b = await deriveKeysFromSeed(FIXED_SEED_7);
    expect(a.sk).toBe(b.sk);
    expect(a.SK).toBe(SK_7);
    expect(a.vk).toEqual(b.vk);
    expect(Array.from(a.VK.slice(0, 4))).toEqual(VK_7_PREFIX);
    expect(a.VK.length).toBe(32);
  });

  it("different seeds yield different keys", async () => {
    const a = await deriveKeysFromSeed(new Uint8Array(32).fill(1));
    const b = await deriveKeysFromSeed(new Uint8Array(32).fill(2));
    expect(a.SK).not.toBe(b.SK);
  });

  it("rejects a non-32-byte seed", async () => {
    await expect(deriveKeysFromSeed(new Uint8Array(31))).rejects.toThrow();
  });

  it("derives from a signature", async () => {
    const k = await deriveKeysFromSignature(new Uint8Array(65).fill(7));
    expect(typeof k.SK).toBe("bigint");
    expect(k.VK.length).toBe(32);
  });
});
