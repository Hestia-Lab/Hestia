import { describe, expect, it } from "vitest";
import { poseidon } from "../src/index.js";

describe("poseidon (circomlib conformance)", () => {
  // These are the canonical circomlib Poseidon reference vectors. If circomlibjs ever
  // diverges from the circom `Poseidon` template, these break — and so would on-chain math.
  it("matches the canonical reference vectors", async () => {
    expect(await poseidon([1n])).toBe(
      18586133768512220936620570745912940619677854269274689475585506675881198879027n,
    );
    expect(await poseidon([1n, 2n])).toBe(
      7853200120776062878684798364095072458815029376092732009249414926327459813530n,
    );
  });

  it("is deterministic and order-sensitive", async () => {
    expect(await poseidon([3n, 4n])).toBe(await poseidon([3n, 4n]));
    expect(await poseidon([3n, 4n])).not.toBe(await poseidon([4n, 3n]));
  });
});
