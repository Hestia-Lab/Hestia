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

contract TransactionVerifier2x2 {
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
    uint256 constant deltax1 = 12673328163539170716860827858149855244819210181608140460455671952472007597032;
    uint256 constant deltax2 = 9653359161329833853409512561427262874513856631988446393142676671664139266412;
    uint256 constant deltay1 = 3722990759229160734599671657672598863672707570547757670590432682583887687624;
    uint256 constant deltay2 = 20546263160862837460409118044422652947266880397408075805908927889331726444181;

    
    uint256 constant IC0x = 6528463720119169956910508046671335670276663511583605564508966369017490313948;
    uint256 constant IC0y = 13945102512853181616354852972968747490797607546690279075432294585129317820554;
    
    uint256 constant IC1x = 8026983320529067256984572261840246328904170811370554340031164832635171081006;
    uint256 constant IC1y = 19753455491564929485855838831191686316662706249645956906505166668567989097036;
    
    uint256 constant IC2x = 17306647429536871831952236536761192736190609769046195804334138230200079729705;
    uint256 constant IC2y = 11027481280886282275204597953031020465607472040592267752617752565761156789433;
    
    uint256 constant IC3x = 764459777791151555223468800121526961931523181386414436822890922581539860050;
    uint256 constant IC3y = 21290323751000785562161192778424508220421751235610861404899314088222126053697;
    
    uint256 constant IC4x = 3679778941226389323338858563022866457175077731832449097488579611047491402755;
    uint256 constant IC4y = 4923255183934017159995548442961319601120922807816407236275469806285377807703;
    
    uint256 constant IC5x = 748285926228497999537572278118149325164085442253067580423431410775715969375;
    uint256 constant IC5y = 17294155602700625382743839822554325634537495258106996820355509331354743816431;
    
    uint256 constant IC6x = 13265067317374244120272879029478271388660619922258175188898594416045425920332;
    uint256 constant IC6y = 9065869587669699678842140322291190277344875887379929313564951473433761219397;
    
    uint256 constant IC7x = 18280893636444783532098570869995862574388302682644833978516094703314386281629;
    uint256 constant IC7y = 15125225875958045396573993117444374948090085154874379480870932272738075290234;
    
    uint256 constant IC8x = 20431075083557914357486731231392788955584247300508252934752100401285884293448;
    uint256 constant IC8y = 19689857124347097062823698332140378056729722838372913554890474152959595032754;
    
    uint256 constant IC9x = 844342455255953675598415014498437117583346395595758977573468462251951592321;
    uint256 constant IC9y = 12517760378673523239505522763290509063809358689605149034291478830460216506277;
    
    uint256 constant IC10x = 14823034248620479168711923966233903956623757527459606398477871400704966733211;
    uint256 constant IC10y = 4787005919387841268469924297167177249199643821747024250179606051175725004640;
    
    uint256 constant IC11x = 1822774474249613498517732418668778654819255276705611472625010985774978424127;
    uint256 constant IC11y = 10703426540997542264685906438847168191432798623278256086365477572296444675419;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[11] calldata _pubSignals) public view returns (bool) {
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
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                

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
            
            checkField(calldataload(add(_pubSignals, 320)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
