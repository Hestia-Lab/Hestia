import { describe, expect, it } from "vitest";
import { decodeMetaAddress, deriveKeysFromSeed, encodeMetaAddress } from "../src/index.js";
import { FIXED_SEED_7 } from "./fixtures.js";

describe("meta-address", () => {
  it("round-trips through bech32m", async () => {
    const k = await deriveKeysFromSeed(FIXED_SEED_7);
    const addr = encodeMetaAddress({ chain: "baseSepolia", SK: k.SK, VK: k.VK });
    expect(addr.startsWith("hestia1")).toBe(true);

    const decoded = decodeMetaAddress(addr);
    expect(decoded.chain).toBe("baseSepolia");
    expect(decoded.SK).toBe(k.SK);
    expect(Array.from(decoded.VK)).toEqual(Array.from(k.VK));
  });

  it("rejects a corrupted address (checksum)", async () => {
    const k = await deriveKeysFromSeed(FIXED_SEED_7);
    const addr = encodeMetaAddress({ chain: "base", SK: k.SK, VK: k.VK });
    expect(() => decodeMetaAddress(addr.slice(0, -2) + "qq")).toThrow();
  });
});
