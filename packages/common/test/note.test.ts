import { describe, expect, it } from "vitest";
import {
  addressToField,
  commitment,
  deriveKeysFromSeed,
  FIELD_MODULUS,
  labelFromLeafIndex,
  nullifier,
  USDC_ADDRESS,
} from "../src/index.js";
import { COMMITMENT_FIXED, FIXED_NOTE, FIXED_SEED_7, LABEL_0, NULLIFIER_FIXED, SK_7 } from "./fixtures.js";

describe("note", () => {
  it("commitment & nullifier match frozen fixtures", async () => {
    const keys = await deriveKeysFromSeed(FIXED_SEED_7);
    expect(keys.SK).toBe(SK_7);

    const label = await labelFromLeafIndex(0);
    expect(label).toBe(LABEL_0);

    const note = {
      value: FIXED_NOTE.value,
      token: addressToField(USDC_ADDRESS.baseSepolia),
      owner: keys.SK,
      label,
      randomness: FIXED_NOTE.randomness,
    };
    const c = await commitment(note);
    expect(c).toBe(COMMITMENT_FIXED);
    expect(await nullifier(c, 0, keys.sk)).toBe(NULLIFIER_FIXED);
  });

  it("rejects out-of-field inputs", async () => {
    await expect(
      commitment({ value: FIELD_MODULUS, token: 0n, owner: 0n, label: 0n, randomness: 0n }),
    ).rejects.toThrow();
  });

  it("addressToField rejects malformed addresses", () => {
    expect(() => addressToField("0x1234")).toThrow();
    expect(addressToField(USDC_ADDRESS.base)).toBeGreaterThan(0n);
  });
});
