
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract BaseDaily is EIP712, Ownable {
    struct UserStats {
        uint32 totalPlayed;
        uint32 totalCorrect;
        uint32 currentStreak;
        uint32 bestStreak;
        uint32 totalPoints;
        uint32 lastPlayedDay;
    }

    bytes32 public constant DAILY_CLAIM_TYPEHASH =
        keccak256(
            "DailyClaim(address user,uint256 questionId,uint256 day,bool correct)"
        );

    mapping(address => UserStats) private _stats;

    address public signer;

    event DailyClaimed(
        address indexed user,
        uint256 indexed questionId,
        uint256 indexed day,
        bool correct,
        uint256 pointsEarned,
        uint256 totalPoints,
        uint256 totalCorrect,
        uint256 currentStreak
    );

    event SignerUpdated(
        address indexed oldSigner,
        address indexed newSigner
    );

    error InvalidSigner();
    error InvalidDay();
    error AlreadyClaimedToday();
    error InvalidSignature();

    constructor(
        address initialOwner,
        address initialSigner
    )
        EIP712("Base Daily", "1")
        Ownable(initialOwner)
    {
        if (initialSigner == address(0)) {
            revert InvalidSigner();
        }

        signer = initialSigner;
    }

    function claimDaily(
        uint256 questionId,
        uint256 day,
        bool correct,
        bytes calldata signature
    ) external {
        uint256 today = currentDay();

        if (day != today) {
            revert InvalidDay();
        }

        UserStats storage stats = _stats[msg.sender];

        if (
            stats.totalPlayed > 0 &&
            stats.lastPlayedDay == today
        ) {
            revert AlreadyClaimedToday();
        }

        bytes32 structHash = keccak256(
            abi.encode(
                DAILY_CLAIM_TYPEHASH,
                msg.sender,
                questionId,
                day,
                correct
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);

        address recovered = ECDSA.recover(
            digest,
            signature
        );

        if (recovered != signer) {
            revert InvalidSignature();
        }

        uint32 pointsEarned = correct ? 3 : 1;

        uint32 newStreak;

        if (stats.totalPlayed == 0) {
            newStreak = 1;
        } else if (
            uint256(stats.lastPlayedDay) + 1 == today
        ) {
            newStreak = stats.currentStreak + 1;
        } else {
            newStreak = 1;
        }

        stats.totalPlayed += 1;

        if (correct) {
            stats.totalCorrect += 1;
        }

        stats.totalPoints += pointsEarned;
        stats.currentStreak = newStreak;
        stats.lastPlayedDay = uint32(today);

        if (newStreak > stats.bestStreak) {
            stats.bestStreak = newStreak;
        }

        emit DailyClaimed(
            msg.sender,
            questionId,
            day,
            correct,
            pointsEarned,
            stats.totalPoints,
            stats.totalCorrect,
            stats.currentStreak
        );
    }

    function getUserStats(
        address user
    ) external view returns (UserStats memory) {
        return _stats[user];
    }

    function canClaim(
        address user
    ) external view returns (bool) {
        UserStats memory stats = _stats[user];

        if (stats.totalPlayed == 0) {
            return true;
        }

        return stats.lastPlayedDay != currentDay();
    }

    function currentDay()
        public
        view
        returns (uint256)
    {
        return block.timestamp / 1 days;
    }

    function setSigner(
        address newSigner
    ) external onlyOwner {
        if (newSigner == address(0)) {
            revert InvalidSigner();
        }

        address oldSigner = signer;
        signer = newSigner;

        emit SignerUpdated(
            oldSigner,
            newSigner
        );
    }
}