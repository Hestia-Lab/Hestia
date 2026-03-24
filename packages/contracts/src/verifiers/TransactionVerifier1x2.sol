// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract TransactionVerifier1x2 {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 9154094274666768982312354352918175451903758240781257028906376665233753509345;
    uint256 constant alphay  = 1650848507074358124210270584574464136377335519707437119911801044178813218285;
    uint256 constant betax1  = 8213264996652860706428896058994834237433965056759752017663111822291834425466;
    uint256 constant betax2  = 1171942536286386757115991869945607747371884756803343755235634617570252873623;
    uint256 constant betay1  = 14698800384368542666398701314872857071531212505414007762106629014005984215463;
    uint256 constant betay2  = 21675566656379293015903262321884809007608645268209467445606194339917785116595;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 20232460920462887293702770221651340028006367133738221841088750336142010344011;
    uint256 constant deltax2 = 9560301074083575068692344834101942967194805474979964419024110134550799306972;
    uint256 constant deltay1 = 13834453755523453727304034990660930560705586481624753498132268385508272759625;
    uint256 constant deltay2 = 14485184752447361790497727232606293185036321970948918875299767275554353839394;

    
    uint256 constant IC0x = 11745103471593148939483641776017434784545687061805804771547915217859437211311;
    uint256 constant IC0y = 16570090804731334751156598682334216521422318453846332215741277452360179821323;
    
    uint256 constant IC1x = 8326424300677913065592996425672240509609850405912390685779126803768812523939;
    uint256 constant IC1y = 12623731785201939824667646998229247782685481756685742812365835591183949572417;
    
    uint256 constant IC2x = 12601854527002719110692849618510055372428780538622228492843329412473959743193;
    uint256 constant IC2y = 11299227267263984138032447121490930517820620113467794062449973852800192309628;
    
    uint256 constant IC3x = 15294707779242597113077500140627880397019174925419488682484777865900878834508;
    uint256 constant IC3y = 15001287708824321100696619532976519938993353589725310613657516439374160330573;
    
    uint256 constant IC4x = 2816195709901063895658884976645294865746289640051358407461036481453178444979;
    uint256 constant IC4y = 159473146337495490535702639080937032258954706462873698867644420164334489492;
    
    uint256 constant IC5x = 490117507449176995433299184798312813113033860422053549686596846093288438173;
    uint256 constant IC5y = 21731448265868363779222567379236306555897391604356744854185572703423704933707;
    
    uint256 constant IC6x = 16234531133845604056590731385475891741248840761183356102746965765615602192105;
    uint256 constant IC6y = 11890743709702330340686493981881050635974143841452454684668600402585879829882;
    
    uint256 constant IC7x = 21572002854803696477469313862803055740648921168099757631493885424851758739603;
    uint256 constant IC7y = 12555193979700939005338130132567626053916854676757702851136139469450393913838;
    
    uint256 constant IC8x = 14692673478229344460638687318926521340777155038345567245910226427622032655612;
    uint256 constant IC8y = 14129613684476668323812568335398615933901722178103239316014849802962550244867;
    
    uint256 constant IC9x = 13647310737167503705641087964592009179319756449017609581166346935555453892080;
    uint256 constant IC9y = 7548496839995938017246906099340645601048093725034456084391501568439207882793;
    
    uint256 constant IC10x = 4500849693442712531792966134175818326549798551798652402003657043605824306656;
    uint256 constant IC10y = 6732424279940731691323474332387330341446695824158116872752037701782438831178;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[10] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
