/** Minimal ambient types for snarkjs (ships no types). Only what the harness uses. */
declare module "snarkjs" {
  export type Groth16Proof = Record<string, unknown>;
  export const groth16: {
    fullProve(
      input: unknown,
      wasmPath: string,
      zkeyPath: string,
    ): Promise<{ proof: Groth16Proof; publicSignals: string[] }>;
    verify(vkey: unknown, publicSignals: string[], proof: Groth16Proof): Promise<boolean>;
    exportSolidityCallData(proof: Groth16Proof, publicSignals: string[]): Promise<string>;
  };
}
