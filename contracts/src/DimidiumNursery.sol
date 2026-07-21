// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  DimidiumNursery
/// @notice Onchain commitment device for the half of every decision that
///         normally evaporates. A user seals a financial intention into an
///         Egg (a hash commitment, optionally with an ETH stake escrowed as
///         a patience bond), lets it incubate, and later resolves it by
///         hatching (acting) or shelling (deliberately not acting).
///
///         The contract records *behavior* — timestamps, extensions,
///         resolutions — not profit. Escrow is returned in full on either
///         resolution: the stake is a commitment device, never a wager.
///
///         Privacy: the intention itself never goes onchain in plaintext at
///         commit time. Only keccak256(abi.encode(...)) is stored. The owner
///         may reveal the preimage later; public experiments are expected to,
///         private commitments never have to.
contract DimidiumNursery {
    // ---------------------------------------------------------------- types

    enum Status {
        Incubating,
        Hatched,
        Shelled
    }

    struct Egg {
        address owner;
        bytes32 commitment; // keccak256(abi.encode(asset, intention, amount, note, salt))
        uint64 createdAt;
        uint64 hatchesAt; // end of incubation; extensions push this out
        uint64 resolvedAt; // 0 while incubating
        uint32 extensions;
        Status status;
        bool isPublic; // "public experiment" vs "private commitment"
        bool revealed;
        uint128 escrow; // patience bond in wei, returned on resolution
    }

    // --------------------------------------------------------------- errors

    error IncubationTooShort();
    error IncubationTooLong();
    error EmptyCommitment();
    error NotYourEgg();
    error EggNotIncubating();
    error EggStillIncubating();
    error EggNotResolved();
    error AlreadyRevealed();
    error RevealMismatch();
    error EscrowTooLarge();
    error RefundFailed();

    // --------------------------------------------------------------- events

    event EggCommitted(
        uint256 indexed id,
        address indexed owner,
        bytes32 commitment,
        uint64 hatchesAt,
        bool isPublic,
        uint256 escrow
    );
    event EggExtended(uint256 indexed id, uint64 newHatchesAt, uint32 extensions);
    event EggHatched(uint256 indexed id, uint64 resolvedAt, bool early);
    event EggShelled(uint256 indexed id, uint64 resolvedAt);
    event EggRevealed(
        uint256 indexed id,
        string asset,
        string intention,
        uint256 amount,
        string note
    );

    // -------------------------------------------------------------- storage

    /// @dev Guardrails, not gameplay: keep incubations meaningful but finite.
    uint64 public constant MIN_INCUBATION = 1 minutes;
    uint64 public constant MAX_INCUBATION = 365 days;
    uint128 public constant MAX_ESCROW = 100 ether;

    Egg[] private _eggs;
    mapping(address => uint256[]) private _eggsOf;

    // ------------------------------------------------------------- mutating

    /// @notice Seal an intention into the shell.
    /// @param commitment keccak256(abi.encode(asset, intention, amount, note, salt))
    /// @param incubationSeconds how long the egg must incubate before it is "ready"
    /// @param isPublic whether this egg is a public experiment
    /// @dev  msg.value (optional) is escrowed until the egg resolves.
    function commit(
        bytes32 commitment,
        uint64 incubationSeconds,
        bool isPublic
    ) external payable returns (uint256 id) {
        if (commitment == bytes32(0)) revert EmptyCommitment();
        if (incubationSeconds < MIN_INCUBATION) revert IncubationTooShort();
        if (incubationSeconds > MAX_INCUBATION) revert IncubationTooLong();
        if (msg.value > MAX_ESCROW) revert EscrowTooLarge();

        id = _eggs.length;
        uint64 nowTs = uint64(block.timestamp);
        _eggs.push(
            Egg({
                owner: msg.sender,
                commitment: commitment,
                createdAt: nowTs,
                hatchesAt: nowTs + incubationSeconds,
                resolvedAt: 0,
                extensions: 0,
                status: Status.Incubating,
                isPublic: isPublic,
                revealed: false,
                escrow: uint128(msg.value)
            })
        );
        _eggsOf[msg.sender].push(id);

        emit EggCommitted(id, msg.sender, commitment, nowTs + incubationSeconds, isPublic, msg.value);
    }

    /// @notice Give your future self more time. Resets "ready" further out.
    function extend(uint256 id, uint64 extraSeconds) external {
        Egg storage egg = _ownedIncubating(id);
        if (extraSeconds < MIN_INCUBATION) revert IncubationTooShort();

        uint64 nowTs = uint64(block.timestamp);
        uint64 base = egg.hatchesAt > nowTs ? egg.hatchesAt : nowTs;
        uint64 newHatchesAt = base + extraSeconds;
        if (newHatchesAt - nowTs > MAX_INCUBATION) revert IncubationTooLong();

        egg.hatchesAt = newHatchesAt;
        egg.extensions += 1;

        emit EggExtended(id, newHatchesAt, egg.extensions);
    }

    /// @notice Act on the decision. Allowed at any time; hatching before the
    ///         timer ends is recorded as an early hatch — Dimidium measures
    ///         behavior, it does not police it.
    function hatch(uint256 id) external {
        Egg storage egg = _ownedIncubating(id);
        uint64 nowTs = uint64(block.timestamp);
        bool early = nowTs < egg.hatchesAt;

        egg.status = Status.Hatched;
        egg.resolvedAt = nowTs;

        emit EggHatched(id, nowTs, early);
        _refund(egg);
    }

    /// @notice Deliberately choose not to act. The shell supports this decision.
    function shell(uint256 id) external {
        Egg storage egg = _ownedIncubating(id);
        uint64 nowTs = uint64(block.timestamp);

        egg.status = Status.Shelled;
        egg.resolvedAt = nowTs;

        emit EggShelled(id, nowTs);
        _refund(egg);
    }

    /// @notice Open the envelope: prove what the sealed intention actually was.
    ///         Only possible after resolution, so a reveal can never front-run
    ///         the decision itself.
    function reveal(
        uint256 id,
        string calldata asset,
        string calldata intention,
        uint256 amount,
        string calldata note,
        bytes32 salt
    ) external {
        Egg storage egg = _egg(id);
        if (egg.owner != msg.sender) revert NotYourEgg();
        if (egg.status == Status.Incubating) revert EggNotResolved();
        if (egg.revealed) revert AlreadyRevealed();

        bytes32 computed = keccak256(abi.encode(asset, intention, amount, note, salt));
        if (computed != egg.commitment) revert RevealMismatch();

        egg.revealed = true;
        emit EggRevealed(id, asset, intention, amount, note);
    }

    // ---------------------------------------------------------------- views

    function eggCount() external view returns (uint256) {
        return _eggs.length;
    }

    function getEgg(uint256 id) external view returns (Egg memory) {
        return _egg(id);
    }

    function eggsOf(address owner) external view returns (uint256[] memory) {
        return _eggsOf[owner];
    }

    /// @notice True once the incubation timer has ended for an unresolved egg.
    function isReady(uint256 id) external view returns (bool) {
        Egg storage egg = _egg(id);
        return egg.status == Status.Incubating && block.timestamp >= egg.hatchesAt;
    }

    /// @notice Helper mirroring the offchain commitment construction, so
    ///         frontends and auditors agree on the preimage encoding.
    function computeCommitment(
        string calldata asset,
        string calldata intention,
        uint256 amount,
        string calldata note,
        bytes32 salt
    ) external pure returns (bytes32) {
        return keccak256(abi.encode(asset, intention, amount, note, salt));
    }

    // ------------------------------------------------------------- internal

    function _egg(uint256 id) internal view returns (Egg storage) {
        // Array access reverts with panic on out-of-bounds; bounds-check for
        // a friendlier custom error.
        if (id >= _eggs.length) revert EggNotIncubating();
        return _eggs[id];
    }

    function _ownedIncubating(uint256 id) internal view returns (Egg storage egg) {
        egg = _egg(id);
        if (egg.owner != msg.sender) revert NotYourEgg();
        if (egg.status != Status.Incubating) revert EggNotIncubating();
    }

    /// @dev Returns the patience bond. Called after state changes
    ///      (checks-effects-interactions); zeroes escrow before sending.
    function _refund(Egg storage egg) internal {
        uint128 amount = egg.escrow;
        if (amount == 0) return;
        egg.escrow = 0;
        (bool ok, ) = egg.owner.call{value: amount}("");
        if (!ok) revert RefundFailed();
    }
}
