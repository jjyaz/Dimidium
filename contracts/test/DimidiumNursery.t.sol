// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DimidiumNursery} from "../src/DimidiumNursery.sol";

contract DimidiumNurseryTest is Test {
    DimidiumNursery internal nursery;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    bytes32 internal constant SALT = keccak256("very-secret-salt");
    string internal constant ASSET = "ETH";
    string internal constant INTENTION = "Buy";
    uint256 internal constant AMOUNT = 0.5 ether;
    string internal constant NOTE = "Everyone says it is going up. Suspicious.";

    function setUp() public {
        nursery = new DimidiumNursery();
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function _commitment() internal pure returns (bytes32) {
        return keccak256(abi.encode(ASSET, INTENTION, AMOUNT, NOTE, SALT));
    }

    function _commitAs(address who, uint256 stake) internal returns (uint256 id) {
        vm.prank(who);
        id = nursery.commit{value: stake}(_commitment(), 1 days, false);
    }

    // ------------------------------------------------------------- commit

    function test_commit_storesEgg() public {
        uint256 id = _commitAs(alice, 1 ether);

        DimidiumNursery.Egg memory egg = nursery.getEgg(id);
        assertEq(egg.owner, alice);
        assertEq(egg.commitment, _commitment());
        assertEq(egg.escrow, 1 ether);
        assertEq(uint8(egg.status), uint8(DimidiumNursery.Status.Incubating));
        assertEq(egg.hatchesAt, egg.createdAt + 1 days);
        assertEq(nursery.eggCount(), 1);
        assertEq(nursery.eggsOf(alice).length, 1);
        assertEq(address(nursery).balance, 1 ether);
    }

    function test_commit_rejectsEmptyCommitment() public {
        vm.prank(alice);
        vm.expectRevert(DimidiumNursery.EmptyCommitment.selector);
        nursery.commit(bytes32(0), 1 days, false);
    }

    function test_commit_rejectsTooShortIncubation() public {
        vm.prank(alice);
        vm.expectRevert(DimidiumNursery.IncubationTooShort.selector);
        nursery.commit(_commitment(), 30 seconds, false);
    }

    function test_commit_rejectsTooLongIncubation() public {
        vm.prank(alice);
        vm.expectRevert(DimidiumNursery.IncubationTooLong.selector);
        nursery.commit(_commitment(), 366 days, false);
    }

    function test_commitmentHelperMatches() public view {
        assertEq(
            nursery.computeCommitment(ASSET, INTENTION, AMOUNT, NOTE, SALT),
            _commitment()
        );
    }

    // ------------------------------------------------------------- extend

    function test_extend_pushesTimerAndCounts() public {
        uint256 id = _commitAs(alice, 0);
        uint64 before = nursery.getEgg(id).hatchesAt;

        vm.prank(alice);
        nursery.extend(id, 1 days);

        DimidiumNursery.Egg memory egg = nursery.getEgg(id);
        assertEq(egg.hatchesAt, before + 1 days);
        assertEq(egg.extensions, 1);
    }

    function test_extend_fromExpiredUsesNow() public {
        uint256 id = _commitAs(alice, 0);
        vm.warp(block.timestamp + 3 days); // egg long ready

        vm.prank(alice);
        nursery.extend(id, 1 days);

        assertEq(nursery.getEgg(id).hatchesAt, uint64(block.timestamp + 1 days));
    }

    function test_extend_onlyOwner() public {
        uint256 id = _commitAs(alice, 0);
        vm.prank(bob);
        vm.expectRevert(DimidiumNursery.NotYourEgg.selector);
        nursery.extend(id, 1 days);
    }

    // -------------------------------------------------------- hatch/shell

    function test_hatch_afterTimer_refundsEscrow() public {
        uint256 id = _commitAs(alice, 2 ether);
        vm.warp(block.timestamp + 1 days);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit DimidiumNursery.EggHatched(id, uint64(block.timestamp), false);
        nursery.hatch(id);

        DimidiumNursery.Egg memory egg = nursery.getEgg(id);
        assertEq(uint8(egg.status), uint8(DimidiumNursery.Status.Hatched));
        assertEq(egg.escrow, 0);
        assertEq(alice.balance, balBefore + 2 ether);
        assertEq(address(nursery).balance, 0);
    }

    function test_hatch_early_isRecordedAsEarly() public {
        uint256 id = _commitAs(alice, 0);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit DimidiumNursery.EggHatched(id, uint64(block.timestamp), true);
        nursery.hatch(id);
    }

    function test_shell_refundsEscrow() public {
        uint256 id = _commitAs(alice, 1 ether);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        nursery.shell(id);

        DimidiumNursery.Egg memory egg = nursery.getEgg(id);
        assertEq(uint8(egg.status), uint8(DimidiumNursery.Status.Shelled));
        assertEq(alice.balance, balBefore + 1 ether);
    }

    function test_resolve_onlyOnce() public {
        uint256 id = _commitAs(alice, 0);
        vm.startPrank(alice);
        nursery.hatch(id);
        vm.expectRevert(DimidiumNursery.EggNotIncubating.selector);
        nursery.shell(id);
        vm.stopPrank();
    }

    function test_resolve_onlyOwner() public {
        uint256 id = _commitAs(alice, 0);
        vm.prank(bob);
        vm.expectRevert(DimidiumNursery.NotYourEgg.selector);
        nursery.hatch(id);
    }

    // ------------------------------------------------------------- reveal

    function test_reveal_afterResolution() public {
        uint256 id = _commitAs(alice, 0);
        vm.startPrank(alice);
        nursery.hatch(id);

        vm.expectEmit(true, false, false, true);
        emit DimidiumNursery.EggRevealed(id, ASSET, INTENTION, AMOUNT, NOTE);
        nursery.reveal(id, ASSET, INTENTION, AMOUNT, NOTE, SALT);
        vm.stopPrank();

        assertTrue(nursery.getEgg(id).revealed);
    }

    function test_reveal_blockedWhileIncubating() public {
        uint256 id = _commitAs(alice, 0);
        vm.prank(alice);
        vm.expectRevert(DimidiumNursery.EggNotResolved.selector);
        nursery.reveal(id, ASSET, INTENTION, AMOUNT, NOTE, SALT);
    }

    function test_reveal_rejectsWrongPreimage() public {
        uint256 id = _commitAs(alice, 0);
        vm.startPrank(alice);
        nursery.hatch(id);
        vm.expectRevert(DimidiumNursery.RevealMismatch.selector);
        nursery.reveal(id, ASSET, "Sell", AMOUNT, NOTE, SALT);
        vm.stopPrank();
    }

    function test_reveal_onlyOnce() public {
        uint256 id = _commitAs(alice, 0);
        vm.startPrank(alice);
        nursery.hatch(id);
        nursery.reveal(id, ASSET, INTENTION, AMOUNT, NOTE, SALT);
        vm.expectRevert(DimidiumNursery.AlreadyRevealed.selector);
        nursery.reveal(id, ASSET, INTENTION, AMOUNT, NOTE, SALT);
        vm.stopPrank();
    }

    // ------------------------------------------------------------ readiness

    function test_isReady_flipsAtTimer() public {
        uint256 id = _commitAs(alice, 0);
        assertFalse(nursery.isReady(id));
        vm.warp(block.timestamp + 1 days);
        assertTrue(nursery.isReady(id));
        vm.prank(alice);
        nursery.shell(id);
        assertFalse(nursery.isReady(id));
    }

    // ------------------------------------------------------------- fuzzing

    function testFuzz_commitResolveRefunds(uint96 stake, uint32 incubation) public {
        stake = uint96(bound(stake, 0, 5 ether));
        incubation = uint32(bound(incubation, 1 minutes, 300 days));

        vm.prank(alice);
        uint256 id = nursery.commit{value: stake}(_commitment(), incubation, true);

        uint256 balBefore = alice.balance;
        vm.warp(block.timestamp + incubation);
        vm.prank(alice);
        nursery.hatch(id);

        assertEq(alice.balance, balBefore + stake);
        assertEq(address(nursery).balance, 0);
    }
}
