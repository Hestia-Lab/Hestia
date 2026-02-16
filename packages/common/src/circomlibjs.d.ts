/** Minimal ambient types for circomlibjs (ships no types). Only what we use. */
declare module "circomlibjs" {
  interface PoseidonField {
    toObject(x: unknown): bigint;
    e(x: bigint | number | string): unknown;
  }
  interface PoseidonFn {
    (inputs: ReadonlyArray<bigint | number | string>): unknown;
    F: PoseidonField;
  }
  export function buildPoseidon(): Promise<PoseidonFn>;
}
