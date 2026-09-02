import assert from "node:assert/strict";
import { describe, it } from "node:test";
import hre from "hardhat";

describe("BaseDaily", async function () {
  const { viem, networkHelpers } = await hre.network.connect();

  async function deployBaseDaily() {
    const [owner, signer, user, secondUser, fakeSigner] =
      await viem.getWalletClients();

    const contract = await viem.deployContract("BaseDaily", [
      owner.account.address,
      signer.account.address,
    ]);

    return {
      contract,
      owner,
      signer,
      user,
      secondUser,
      fakeSigner,
    };
  }

  async function signClaim(
    signerClient: Awaited<
      ReturnType<typeof viem.getWalletClients>
    >[number],
    contractAddress: `0x${string}`,
    user: `0x${string}`,
    questionId: bigint,
    day: bigint,
    correct: boolean
  ) {
    return signerClient.signTypedData({
      account: signerClient.account,
      domain: {
        name: "Base Daily",
        version: "1",
        chainId: 31337,
        verifyingContract: contractAddress,
      },
      types: {
        DailyClaim: [
          { name: "user", type: "address" },
          { name: "questionId", type: "uint256" },
          { name: "day", type: "uint256" },
          { name: "correct", type: "bool" },
        ],
      },
      primaryType: "DailyClaim",
      message: {
        user,
        questionId,
        day,
        correct,
      },
    });
  }

  it("gives 3 points for a correct answer", async function () {
    const { contract, signer, user } =
      await deployBaseDaily();

    const day = await contract.read.currentDay();

    const signature = await signClaim(
      signer,
      contract.address,
      user.account.address,
      1n,
      day,
      true
    );

    await contract.write.claimDaily(
      [1n, day, true, signature],
      { account: user.account }
    );

    const stats = await contract.read.getUserStats([
      user.account.address,
    ]);

    assert.equal(stats.totalPlayed, 1);
    assert.equal(stats.totalCorrect, 1);
    assert.equal(stats.currentStreak, 1);
    assert.equal(stats.bestStreak, 1);
    assert.equal(stats.totalPoints, 3);
  });

  it("gives 1 point for a wrong answer", async function () {
    const { contract, signer, user } =
      await deployBaseDaily();

    const day = await contract.read.currentDay();

    const signature = await signClaim(
      signer,
      contract.address,
      user.account.address,
      1n,
      day,
      false
    );

    await contract.write.claimDaily(
      [1n, day, false, signature],
      { account: user.account }
    );

    const stats = await contract.read.getUserStats([
      user.account.address,
    ]);

    assert.equal(stats.totalPlayed, 1);
    assert.equal(stats.totalCorrect, 0);
    assert.equal(stats.currentStreak, 1);
    assert.equal(stats.bestStreak, 1);
    assert.equal(stats.totalPoints, 1);
  });

  it("rejects a second claim on the same day", async function () {
    const { contract, signer, user } =
      await deployBaseDaily();

    const day = await contract.read.currentDay();

    const firstSignature = await signClaim(
      signer,
      contract.address,
      user.account.address,
      1n,
      day,
      true
    );

    await contract.write.claimDaily(
      [1n, day, true, firstSignature],
      { account: user.account }
    );

    const secondSignature = await signClaim(
      signer,
      contract.address,
      user.account.address,
      2n,
      day,
      true
    );

    await assert.rejects(
      contract.write.claimDaily(
        [2n, day, true, secondSignature],
        { account: user.account }
      )
    );
  });

  it("rejects a signature from the wrong signer", async function () {
    const {
      contract,
      user,
      fakeSigner,
    } = await deployBaseDaily();

    const day = await contract.read.currentDay();

    const signature = await signClaim(
      fakeSigner,
      contract.address,
      user.account.address,
      1n,
      day,
      true
    );

    await assert.rejects(
      contract.write.claimDaily(
        [1n, day, true, signature],
        { account: user.account }
      )
    );
  });

  it("increases the streak when the user claims on the next day", async function () {
    const { contract, signer, user } =
      await deployBaseDaily();

    const firstDay = await contract.read.currentDay();

    const firstSignature = await signClaim(
      signer,
      contract.address,
      user.account.address,
      1n,
      firstDay,
      true
    );

    await contract.write.claimDaily(
      [1n, firstDay, true, firstSignature],
      { account: user.account }
    );

    await networkHelpers.time.increase(24 * 60 * 60);

    const secondDay = await contract.read.currentDay();

    const secondSignature = await signClaim(
      signer,
      contract.address,
      user.account.address,
      2n,
      secondDay,
      false
    );

    await contract.write.claimDaily(
      [2n, secondDay, false, secondSignature],
      { account: user.account }
    );

    const stats = await contract.read.getUserStats([
      user.account.address,
    ]);

    assert.equal(stats.totalPlayed, 2);
    assert.equal(stats.totalCorrect, 1);
    assert.equal(stats.totalPoints, 4);
    assert.equal(stats.currentStreak, 2);
    assert.equal(stats.bestStreak, 2);
  });

  it("resets the current streak after a missed day but keeps the best streak", async function () {
    const { contract, signer, user } =
      await deployBaseDaily();

    const firstDay = await contract.read.currentDay();

    const firstSignature = await signClaim(
      signer,
      contract.address,
      user.account.address,
      1n,
      firstDay,
      true
    );

    await contract.write.claimDaily(
      [1n, firstDay, true, firstSignature],
      { account: user.account }
    );

    await networkHelpers.time.increase(24 * 60 * 60);

    const secondDay = await contract.read.currentDay();

    const secondSignature = await signClaim(
      signer,
      contract.address,
      user.account.address,
      2n,
      secondDay,
      true
    );

    await contract.write.claimDaily(
      [2n, secondDay, true, secondSignature],
      { account: user.account }
    );

    await networkHelpers.time.increase(
      2 * 24 * 60 * 60
    );

    const fourthDay = await contract.read.currentDay();

    const fourthSignature = await signClaim(
      signer,
      contract.address,
      user.account.address,
      4n,
      fourthDay,
      true
    );

    await contract.write.claimDaily(
      [4n, fourthDay, true, fourthSignature],
      { account: user.account }
    );

    const stats = await contract.read.getUserStats([
      user.account.address,
    ]);

    assert.equal(stats.totalPlayed, 3);
    assert.equal(stats.totalCorrect, 3);
    assert.equal(stats.totalPoints, 9);
    assert.equal(stats.currentStreak, 1);
    assert.equal(stats.bestStreak, 2);
  });

  it("rejects a signature for an old day", async function () {
    const { contract, signer, user } =
      await deployBaseDaily();

    const oldDay = await contract.read.currentDay();

    const signature = await signClaim(
      signer,
      contract.address,
      user.account.address,
      1n,
      oldDay,
      true
    );

    await networkHelpers.time.increase(24 * 60 * 60);

    await assert.rejects(
      contract.write.claimDaily(
        [1n, oldDay, true, signature],
        { account: user.account }
      )
    );
  });

  it("rejects a signature created for another user", async function () {
    const {
      contract,
      signer,
      user,
      secondUser,
    } = await deployBaseDaily();

    const day = await contract.read.currentDay();

    const signature = await signClaim(
      signer,
      contract.address,
      user.account.address,
      1n,
      day,
      true
    );

    await assert.rejects(
      contract.write.claimDaily(
        [1n, day, true, signature],
        { account: secondUser.account }
      )
    );
  });

  it("allows the owner to change the signer", async function () {
    const {
      contract,
      owner,
      fakeSigner,
    } = await deployBaseDaily();

    await contract.write.setSigner(
      [fakeSigner.account.address],
      {
        account: owner.account,
      }
    );

    const newSigner = await contract.read.signer();

    assert.equal(
      newSigner.toLowerCase(),
      fakeSigner.account.address.toLowerCase()
    );
  });

  it("rejects signer changes from a non-owner", async function () {
    const {
      contract,
      user,
      fakeSigner,
    } = await deployBaseDaily();

    await assert.rejects(
      contract.write.setSigner(
        [fakeSigner.account.address],
        {
          account: user.account,
        }
      )
    );
  });

  it("rejects signatures from the old signer after signer rotation", async function () {
    const {
      contract,
      owner,
      signer,
      user,
      fakeSigner,
    } = await deployBaseDaily();

    await contract.write.setSigner(
      [fakeSigner.account.address],
      {
        account: owner.account,
      }
    );

    const day = await contract.read.currentDay();

    const oldSignerSignature = await signClaim(
      signer,
      contract.address,
      user.account.address,
      1n,
      day,
      true
    );

    await assert.rejects(
      contract.write.claimDaily(
        [1n, day, true, oldSignerSignature],
        { account: user.account }
      )
    );

    const newSignerSignature = await signClaim(
      fakeSigner,
      contract.address,
      user.account.address,
      1n,
      day,
      true
    );

    await contract.write.claimDaily(
      [1n, day, true, newSignerSignature],
      { account: user.account }
    );

    const stats = await contract.read.getUserStats([
      user.account.address,
    ]);

    assert.equal(stats.totalPlayed, 1);
    assert.equal(stats.totalPoints, 3);
  });
});