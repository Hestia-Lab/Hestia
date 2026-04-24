/** Event + function ABIs for the indexer and relayer (viem human-readable form). */
import { parseAbi } from "viem";

export const poolAbi = parseAbi([
  // leaf sources — both carry (commitment, leafIndex, encryptedNote)
  "event Shield(uint256 indexed commitment, uint256 leafIndex, uint256 label, address token, uint256 amount, bytes encryptedNote)",
  "event Commitment(uint256 indexed commitment, uint256 leafIndex, bytes encryptedNote)",
  "event Nullified(uint256 indexed nullifier)",
  "event Unshield(address indexed token, address indexed recipient, uint256 amount, address relayer, uint256 fee)",
  // relayer entrypoints
  "struct TransactData { uint256 root; uint256 associationRoot; uint256 withdrawAmount; address token; address recipient; uint256 feeAmount; address relayer; }",
  "function shield(address token, uint256 amount, uint256 ownerSK, uint256 randomness, bytes encryptedNote) payable returns (uint256 leafIndex, uint256 commitment)",
  "function transact1x2(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[1] nullifiers, uint256[2] outCommitments, TransactData d, bytes[2] encryptedNotes)",
  "function transact2x2(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[2] nullifiers, uint256[2] outCommitments, TransactData d, bytes[2] encryptedNotes)",
  "function getLastRoot() view returns (uint256)",
  "function nextLeafIndex() view returns (uint256)",
]);

export const registryAbi = parseAbi([
  "event RootPublished(address indexed asp, uint256 indexed root, string uri)",
  "event RootRevoked(address indexed by, uint256 indexed root)",
  "function isValidRoot(uint256 root) view returns (bool)",
]);
