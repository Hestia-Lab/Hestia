// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MerkleTreeWithHistory} from "./MerkleTreeWithHistory.sol";
import {IPoseidon1, IPoseidon5} from "./interfaces/IPoseidon.sol";
import {ITransactionVerifier1x2, ITransactionVerifier2x2} from "./interfaces/IVerifier.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {AssociationSetRegistry} from "./AssociationSetRegistry.sol";

// Hestia shielded pool (SPEC §5). Non-custodial: no role can move user funds.
//  - shield:   proof-less deposit of ETH/USDC; the contract derives label + commitment.
//  - transact: a Groth16 join-split (1x2 / 2x2) that spends notes, optionally withdrawing
//              ETH/USDC to a public recipient and paying a relayer fee — bound into the proof.
contract HestiaPool is MerkleTreeWithHistory {
    // BN254 scalar field modulus; note fields must be canonical elements.
    uint256 internal constant FIELD_MODULUS =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Value range checked in-circuit (< 2^248).
    uint256 internal constant MAX_VALUE = 1 << 248;
    // Sentinel token address for native ETH.
    address public constant NATIVE_ETH = address(0);

    IPoseidon1 public immutable labelHasher; // poseidon([leafIndex])
    IPoseidon5 public immutable commitmentHasher; // poseidon([value, token, owner, label, randomness])
    ITransactionVerifier1x2 public immutable verifier1x2;
    ITransactionVerifier2x2 public immutable verifier2x2;
    AssociationSetRegistry public immutable associations;
    IERC20 public immutable usdc;

    mapping(uint256 => bool) public nullifierSpent;

    uint256 private _lock = 1;

    // Shared, non-proof transaction parameters (the 7 public inputs).
    struct TransactData {
        uint256 root;
        uint256 associationRoot;
        uint256 withdrawAmount;
        address token;
        address recipient;
        uint256 feeAmount;
        address relayer;
    }

    event Shield(
        uint256 indexed commitment,
        uint256 leafIndex,
        uint256 label,
        address token,
        uint256 amount,
        bytes encryptedNote
    );
    event Commitment(uint256 indexed commitment, uint256 leafIndex, bytes encryptedNote);
    event Nullified(uint256 indexed nullifier);
    event Unshield(address indexed token, address indexed recipient, uint256 amount, address relayer, uint256 fee);

    error Reentrant();
    error UnsupportedToken();
    error BadAmount();
    error NotFieldElement();
    error WrongEthValue();
    error UnknownRoot();
    error InvalidAssociationRoot();
    error NullifierAlreadyUsed();
    error InvalidProof();
    error TransferFailed();

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrant();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(
        uint256 levels,
        address poseidon2,
        address poseidon1,
        address poseidon5,
        address verifier1x2_,
        address verifier2x2_,
        address associations_,
        address usdc_
    ) MerkleTreeWithHistory(levels, poseidon2) {
        labelHasher = IPoseidon1(poseidon1);
        commitmentHasher = IPoseidon5(poseidon5);
        verifier1x2 = ITransactionVerifier1x2(verifier1x2_);
        verifier2x2 = ITransactionVerifier2x2(verifier2x2_);
        associations = AssociationSetRegistry(associations_);
        usdc = IERC20(usdc_);
    }

    // -------------------------------------------------------------------------
    // Shield (deposit) — proof-less. A deposit is public; privacy begins on spend.
    // -------------------------------------------------------------------------
    function shield(
        address token,
        uint256 amount,
        uint256 ownerSK,
        uint256 randomness,
        bytes calldata encryptedNote
    ) external payable nonReentrant returns (uint256 leafIndex, uint256 commitment) {
        if (token != NATIVE_ETH && token != address(usdc)) revert UnsupportedToken();
        if (amount == 0 || amount >= MAX_VALUE) revert BadAmount();
        if (ownerSK >= FIELD_MODULUS || randomness >= FIELD_MODULUS) revert NotFieldElement();

        if (token == NATIVE_ETH) {
            if (msg.value != amount) revert WrongEthValue();
        } else {
            if (msg.value != 0) revert WrongEthValue();
            _pullERC20(token, msg.sender, amount);
        }

        leafIndex = nextLeafIndex;
        uint256 label = labelHasher.poseidon([leafIndex]);
        uint256 tokenField = uint256(uint160(token));
        commitment = commitmentHasher.poseidon([amount, tokenField, ownerSK, label, randomness]);

        _insert(commitment);
        emit Shield(commitment, leafIndex, label, token, amount, encryptedNote);
    }
    function _pullERC20(address token, address from, uint256 amount) private {
        (bool ok, bytes memory data) =
            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, address(this), amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
