import { defineConfig } from "vitest/config";

// Groth16 proving takes a few seconds per proof; give tests room.
export default defineConfig({
  test: {
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
