// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./utils/Base.sol";
import {IPoseidon1, IPoseidon2, IPoseidon5} from "../src/interfaces/IPoseidon.sol";

// On-chain Poseidon must equal circomlib, the common package, and the circuits — these are
// the canonical reference vectors. If they hold, commitments and the Merkle tree computed
// on-chain are byte-identical to what the SDK and circuits produce.
contract PoseidonTest is Base {
    function test_Poseidon1_matchesCircomlib() public {
        address p = deployPoseidon("PoseidonT2");
        assertEq(
            IPoseidon1(p).poseidon([uint256(1)]),
            18586133768512220936620570745912940619677854269274689475585506675881198879027
        );
    }

    function test_Poseidon2_matchesCircomlib() public {
        address p = deployPoseidon("PoseidonT3");
        assertEq(
            IPoseidon2(p).poseidon([uint256(1), uint256(2)]),
            7853200120776062878684798364095072458815029376092732009249414926327459813530
        );
    }

    function test_Poseidon5_matchesCircomlib() public {
        address p = deployPoseidon("PoseidonT6");
        assertEq(
            IPoseidon5(p).poseidon([uint256(1), uint256(2), uint256(3), uint256(4), uint256(5)]),
            6183221330272524995739186171720101788151706631170188140075976616310159254464
        );
    }
}
