const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require('@openzeppelin/test-helpers');

describe("ClaimAgainstERC721", function () {
  let mockERC721;
  let claimAgainstERC721WithFee;
  let claimAgainstERC721WithoutFee;
  let startTime;
  let endTime;
  let fee;
  let block;
  let blockNumber;
  let incorrectFeeTooHigh;
  let incorrectFeeTooLow;
  let lastAccountBalance;
  beforeEach(async () => {
    // Deploy mock ERC721
    const MockERC721 = await ethers.getContractFactory("MockERC721");
    mockERC721 = await MockERC721.deploy("MOCK", "MK");
    await mockERC721.deployed();

    // Populate accounts with tokens
    let lastAccountMintQuantity = 10;
    lastAccountBalance = lastAccountMintQuantity;
    let accountCount = 0;
    const [owner, ...accounts] = await ethers.getSigners();
    for(let account of accounts) {
      accountCount++;
      if(accountCount === 100) {
        for(let i = 0; i < lastAccountMintQuantity; i++) {
          await mockERC721.connect(owner).mint(account.address);
        }
      } else {
        await mockERC721.connect(owner).mint(account.address);
      }
    }
  })
  describe("ClaimAgainstERC721WithFee", function () {
    beforeEach(async () => {
      // Deploy ClaimAgainstERC721WithFee
      try {
        blockNumber = await ethers.provider.getBlockNumber();
        block = await ethers.provider.getBlock(blockNumber);
        startTime = ethers.BigNumber.from(block.timestamp).add('900').toString(); // Adds 15 minutes to current time
        endTime = ethers.BigNumber.from(startTime).add(60 * 60 * 24).toString(); // Adds 24 hours to start time
        fee = ethers.utils.parseUnits("0.2", "ether"); // 0.2 ETH fee in wei
        multiTokenClaimFee = ethers.BigNumber.from(ethers.utils.parseUnits("0.2", "ether")).mul(lastAccountBalance); // 0.2 * lastAccountBalance ETH fee in wei
        incorrectFeeTooHigh = ethers.utils.parseUnits("0.4", "ether"); // 0.4 ETH fee in wei
        incorrectFeeTooLow = ethers.utils.parseUnits("0.1", "ether"); // 0.1 ETH fee in wei
        const ClaimAgainstERC721WithFee = await ethers.getContractFactory("ClaimAgainstERC721WithFee");
        claimAgainstERC721WithFee = await ClaimAgainstERC721WithFee.deploy(mockERC721.address, startTime, endTime, fee);
        await claimAgainstERC721WithFee.deployed();
      } catch(e) {
        console.log("Error", e)
      }
    })
    context("claimAgainstTokenIds(uint256[] memory _tokenIds)", async function () {
      context("revert reasons", async function () {
        it("Should not allow claims to be made before opening time", async function () {
          const [owner, ...accounts] = await ethers.getSigners();
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            // Check that claim was successful
            await expect(claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee})).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: claims have not yet opened");
          }
        })
        it("Should not allow claims to be made after end time", async function () {
          const [owner, ...accounts] = await ethers.getSigners();
          // Increase to end time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(endTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            // Check that claim was successful
            await expect(claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee})).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: claims have closed");
          }
        })
        it("Should not allow claims to be made with no token IDs provided", async function () {
          const [owner, ...accounts] = await ethers.getSigners();
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            // Check that claim was successful
            await expect(claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([], {value: fee})).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: no token IDs provided");
          }
        })
        it("Should not allow claims to be made without a fee", async function () {
          const [owner, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            // Check that claim was successful
            await expect(claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId])).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: incorrect claim fee provided");
          }
        })
        it("Should not allow claims to be made with a fee that is too high", async function () {
          const [owner, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            // Check that claim was successful
            await expect(claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: incorrectFeeTooHigh})).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: incorrect claim fee provided");
          }
        })
        it("Should not allow claims to be made with a fee that is too low", async function () {
          const [owner, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            // Check that claim was successful
            await expect(claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: incorrectFeeTooLow})).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: incorrect claim fee provided");
          }
        })
        it("Should not allow claims to be made against a token ID that has already been claimed against", async function () {
          const [owner, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            await claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee});
            // Check that claim was successful
            expect(await claimAgainstERC721WithFee.tokenIdToClaimant(tokenId)).to.equal(account.address);
            // Try to claim against token ID again
            await expect(claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee})).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: token with provided ID has already been claimed against");
          }
        });
        it("Should not allow claims to be made against a token ID that isn't owned by the msg.sender", async function () {
          const [owner, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 101;
          for(let account of accounts) {
            tokenId--;
            // Try to claim against unowned token ID
            await expect(claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee})).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: msg.sender does not own specified token");
          }
        });
      });
      context("happy path", async function () {
        it("Should allow each NFT holder to claim against their NFTs", async function () {
          const [owner, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            await claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee});
            // Check that claim was successful
            expect(await claimAgainstERC721WithFee.tokenIdToClaimant(tokenId)).to.equal(account.address);
          }
        });
        it("Should allow each NFT holder to claim against multiple NFTs within one transaction", async function () {
          const [owner, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            if(tokenId === 100) {
              let tokenIds = [];
              for(let i = 0; i < lastAccountBalance; i++) {
                tokenIds.push(tokenId + i);
              }
              await claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds(tokenIds, {value: multiTokenClaimFee});
              // Check that claim was successful
              for(let i = 0; i < lastAccountBalance; i++) {
                expect(await claimAgainstERC721WithFee.tokenIdToClaimant(tokenId + i)).to.equal(account.address);
              }
            }
          }
        });
      });
    });
    context("claimCount()", async function () {
      it("Should start at zero", async function () {
        const [owner, ...accounts] = await ethers.getSigners();
        // Increase to opening time
        await hre.network.provider.request({
          method: "evm_setNextBlockTimestamp",
          params: [Number(startTime)],
        });
        let claimCountExpected = 0;
        expect(await claimAgainstERC721WithFee.claimCount()).to.equal(claimCountExpected);
      });
      it("Should update the claim count after each successful claim", async function () {
        const [owner, ...accounts] = await ethers.getSigners();
        // Increase to opening time
        await hre.network.provider.request({
          method: "evm_setNextBlockTimestamp",
          params: [Number(startTime)],
        });
        let tokenId = 0;
        for(let account of accounts) {
          tokenId++;
          await claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee});
          // Check that claim was successful
          expect(await claimAgainstERC721WithFee.tokenIdToClaimant(tokenId)).to.equal(account.address);
          expect(await claimAgainstERC721WithFee.claimCount()).to.equal(tokenId);
        }
      });
    })
    context("claimantClaimCount(address _claimant)", async function () {
      it("Should be zero for a claimant that has not claimed against any tokens", async function () {
        const [owner, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let expectedClaimCount = 0;
          for(let account of accounts) {
            expect(await claimAgainstERC721WithFee.claimantClaimCount(account.address)).to.equal(expectedClaimCount);
          }
      });
      it("Should correctly update the claimed token IDs count after claims", async function () {
        const [owner, ...accounts] = await ethers.getSigners();
        // Increase to opening time
        await hre.network.provider.request({
          method: "evm_setNextBlockTimestamp",
          params: [Number(startTime)],
        });
        let tokenId = 0;
        for(let account of accounts) {
          tokenId++;
          if(tokenId === 100) {
            let tokenIds = [];
            for(let i = 0; i < lastAccountBalance; i++) {
              tokenIds.push(tokenId + i);
            }
            await claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds(tokenIds, {value: multiTokenClaimFee});
            // Check that claim was successful
            for(let i = 0; i < lastAccountBalance; i++) {
              expect(await claimAgainstERC721WithFee.tokenIdToClaimant(tokenId + i)).to.equal(account.address);
            }
            expect(await claimAgainstERC721WithFee.claimantClaimCount(account.address)).to.equal(lastAccountBalance);
          } else {
            await claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee});
            expect(await claimAgainstERC721WithFee.claimantClaimCount(account.address)).to.equal(1);
          }
        }
      });
    });
    context("claimantToClaimedTokenIds(address _claimant)", async function () {
      it("Should be an empty array for a claimant that has not claimed against any tokens", async function () {
        const [owner, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let expectedClaimCount = 0;
          for(let account of accounts) {
            let result = await claimAgainstERC721WithFee.claimantToClaimedTokenIds(account.address);
            expect(result.length).to.equal(expectedClaimCount);
          }
      });
      it("Should correctly update the claimed token IDs after claims", async function () {
        const [owner, ...accounts] = await ethers.getSigners();
        // Increase to opening time
        await hre.network.provider.request({
          method: "evm_setNextBlockTimestamp",
          params: [Number(startTime)],
        });
        let tokenId = 0;
        for(let account of accounts) {
          tokenId++;
          if(tokenId === 100) {
            let tokenIds = [];
            for(let i = 0; i < lastAccountBalance; i++) {
              tokenIds.push(tokenId + i);
            }
            await claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds(tokenIds, {value: multiTokenClaimFee});
            // Check that claim was successful
            let result = await claimAgainstERC721WithFee.claimantToClaimedTokenIds(account.address);
            for(let i = 0; i < lastAccountBalance; i++) {
              expect(await claimAgainstERC721WithFee.tokenIdToClaimant(tokenId + i)).to.equal(account.address);
              expect(result[i]).to.equal(tokenId + i);
            }
            expect(await claimAgainstERC721WithFee.claimantClaimCount(account.address)).to.equal(lastAccountBalance);
          } else {
            await claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee});
            expect(await claimAgainstERC721WithFee.claimantClaimCount(account.address)).to.equal(1);
            let result = await claimAgainstERC721WithFee.claimantToClaimedTokenIds(account.address);
            expect(result[0]).to.equal(tokenId);
          }
        }
      });
    });
  })
  describe("ClaimAgainstERC721WithoutFee", function () {
    beforeEach(async () => {
      // Deploy claimAgainstERC721WithoutFee
      try {
        blockNumber = await ethers.provider.getBlockNumber();
        block = await ethers.provider.getBlock(blockNumber);
        startTime = ethers.BigNumber.from(block.timestamp).add('900').toString(); // Adds 15 minutes to current time
        endTime = ethers.BigNumber.from(startTime).add(60 * 60 * 24).toString(); // Adds 24 hours to start time
        const ClaimAgainstERC721WithoutFee = await ethers.getContractFactory("ClaimAgainstERC721WithoutFee");
        claimAgainstERC721WithoutFee = await ClaimAgainstERC721WithoutFee.deploy(mockERC721.address, startTime, endTime);
        await claimAgainstERC721WithoutFee.deployed();
      } catch(e) {
        console.log("Error", e)
      }
    })
    context("claimAgainstTokenIds(uint256[] memory _tokenIds)", async function () {
      context("revert reasons", async function () {
        it("Should not allow claims to be made before opening time", async function () {
          const [owner, ...accounts] = await ethers.getSigners();
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            // Check that claim was successful
            await expect(claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([tokenId])).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: claims have not yet opened");
          }
        })
        it("Should not allow claims to be made after end time", async function () {
          const [owner, ...accounts] = await ethers.getSigners();
          // Increase to end time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(endTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            // Check that claim was successful
            await expect(claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([tokenId])).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: claims have closed");
          }
        })
        it("Should not allow claims to be made with no token IDs provided", async function () {
          const [owner, ...accounts] = await ethers.getSigners();
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            // Check that claim was successful
            await expect(claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([])).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: no token IDs provided");
          }
        })
        it("Should not allow claims to be made against a token ID that has already been claimed against", async function () {
          const [owner, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            await claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([tokenId]);
            // Check that claim was successful
            expect(await claimAgainstERC721WithoutFee.tokenIdToClaimant(tokenId)).to.equal(account.address);
            // Try to claim against token ID again
            await expect(claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([tokenId])).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: token with provided ID has already been claimed against");
          }
        });
        it("Should not allow claims to be made against a token ID that isn't owned by the msg.sender", async function () {
          const [owner, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 101;
          for(let account of accounts) {
            tokenId--;
            // Try to claim against unowned token ID
            await expect(claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([tokenId])).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: msg.sender does not own specified token");
          }
        });
      });
      context("happy path", async function () {
        it("Should allow each NFT holder to claim against their NFTs", async function () {
          const [owner, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            await claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([tokenId]);
            // Check that claim was successful
            expect(await claimAgainstERC721WithoutFee.tokenIdToClaimant(tokenId)).to.equal(account.address);
          }
        });
        it("Should allow each NFT holder to claim against multiple NFTs within one transaction", async function () {
          const [owner, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            if(tokenId === 100) {
              let tokenIds = [];
              for(let i = 0; i < lastAccountBalance; i++) {
                tokenIds.push(tokenId + i);
              }
              await claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds(tokenIds);
              // Check that claim was successful
              for(let i = 0; i < lastAccountBalance; i++) {
                expect(await claimAgainstERC721WithoutFee.tokenIdToClaimant(tokenId + i)).to.equal(account.address);
              }
            }
          }
        });
      });
    });
    context("claimCount()", async function () {
      it("Should start at zero", async function () {
        const [owner, ...accounts] = await ethers.getSigners();
        // Increase to opening time
        await hre.network.provider.request({
          method: "evm_setNextBlockTimestamp",
          params: [Number(startTime)],
        });
        let claimCountExpected = 0;
        expect(await claimAgainstERC721WithoutFee.claimCount()).to.equal(claimCountExpected);
      });
      it("Should update the claim count after each successful claim", async function () {
        const [owner, ...accounts] = await ethers.getSigners();
        // Increase to opening time
        await hre.network.provider.request({
          method: "evm_setNextBlockTimestamp",
          params: [Number(startTime)],
        });
        let tokenId = 0;
        for(let account of accounts) {
          tokenId++;
          await claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([tokenId]);
          // Check that claim was successful
          expect(await claimAgainstERC721WithoutFee.tokenIdToClaimant(tokenId)).to.equal(account.address);
          expect(await claimAgainstERC721WithoutFee.claimCount()).to.equal(tokenId);
        }
      });
    })
    context("claimantClaimCount(address _claimant)", async function () {
      it("Should be zero for a claimant that has not claimed against any tokens", async function () {
        const [owner, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let expectedClaimCount = 0;
          for(let account of accounts) {
            expect(await claimAgainstERC721WithoutFee.claimantClaimCount(account.address)).to.equal(expectedClaimCount);
          }
      });
      it("Should correctly update the claimed token IDs count after claims", async function () {
        const [owner, ...accounts] = await ethers.getSigners();
        // Increase to opening time
        await hre.network.provider.request({
          method: "evm_setNextBlockTimestamp",
          params: [Number(startTime)],
        });
        let tokenId = 0;
        for(let account of accounts) {
          tokenId++;
          if(tokenId === 100) {
            let tokenIds = [];
            for(let i = 0; i < lastAccountBalance; i++) {
              tokenIds.push(tokenId + i);
            }
            await claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds(tokenIds);
            // Check that claim was successful
            for(let i = 0; i < lastAccountBalance; i++) {
              expect(await claimAgainstERC721WithoutFee.tokenIdToClaimant(tokenId + i)).to.equal(account.address);
            }
            expect(await claimAgainstERC721WithoutFee.claimantClaimCount(account.address)).to.equal(lastAccountBalance);
          } else {
            await claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([tokenId]);
            expect(await claimAgainstERC721WithoutFee.claimantClaimCount(account.address)).to.equal(1);
          }
        }
      });
    });
    context("claimantToClaimedTokenIds(address _claimant)", async function () {
      it("Should be an empty array for a claimant that has not claimed against any tokens", async function () {
        const [owner, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let expectedClaimCount = 0;
          for(let account of accounts) {
            let result = await claimAgainstERC721WithoutFee.claimantToClaimedTokenIds(account.address);
            expect(result.length).to.equal(expectedClaimCount);
          }
      });
      it("Should correctly update the claimed token IDs after claims", async function () {
        const [owner, ...accounts] = await ethers.getSigners();
        // Increase to opening time
        await hre.network.provider.request({
          method: "evm_setNextBlockTimestamp",
          params: [Number(startTime)],
        });
        let tokenId = 0;
        for(let account of accounts) {
          tokenId++;
          if(tokenId === 100) {
            let tokenIds = [];
            for(let i = 0; i < lastAccountBalance; i++) {
              tokenIds.push(tokenId + i);
            }
            await claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds(tokenIds);
            // Check that claim was successful
            let result = await claimAgainstERC721WithoutFee.claimantToClaimedTokenIds(account.address);
            for(let i = 0; i < lastAccountBalance; i++) {
              expect(await claimAgainstERC721WithoutFee.tokenIdToClaimant(tokenId + i)).to.equal(account.address);
              expect(result[i]).to.equal(tokenId + i);
            }
            expect(await claimAgainstERC721WithoutFee.claimantClaimCount(account.address)).to.equal(lastAccountBalance);
          } else {
            await claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([tokenId]);
            expect(await claimAgainstERC721WithoutFee.claimantClaimCount(account.address)).to.equal(1);
            let result = await claimAgainstERC721WithoutFee.claimantToClaimedTokenIds(account.address);
            expect(result[0]).to.equal(tokenId);
          }
        }
      });
    });
  })
});