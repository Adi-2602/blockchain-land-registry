import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";
import chai from "chai";
import hre from "hardhat";

const { expect } = chai;
const { ethers } = hre;

const HASH_1 = "a3f5c1e98b2d4f6071c3e5a7b9d1f3e5c7a9b1d3f5e7c9a1b3d5f7e9c1a3b5d7";
const HASH_2 = "7e1d9c3b5a7f9e1d3c5b7a9f1e3d5c7b9a1f3e5d7c9b1a3f5e7d9c1b3a5f7e9d";
const URL_1 = "https://res.cloudinary.com/demo/raw/upload/land-documents/LAND101_1";
const URL_2 = "https://res.cloudinary.com/demo/raw/upload/land-documents/LAND101_2";

describe("LandRegistry", function () {
  async function deployFixture() {
    const [admin, registrar, outsider] = await ethers.getSigners();
    const registry = await (await ethers.getContractFactory("LandRegistry")).deploy();
    await registry.addRegistrar(registrar.address);
    return { registry, admin, registrar, outsider };
  }

  async function registeredFixture() {
    const f = await deployFixture();
    await f.registry.connect(f.registrar).registerLand("LAND101", "Ramesh Kumar", "Chengalpattu", HASH_1, URL_1);
    return f;
  }

  describe("Registrar access control", function () {
    it("makes the deployer admin and registrar", async function () {
      const { registry, admin } = await loadFixture(deployFixture);
      expect(await registry.admin()).to.equal(admin.address);
      expect(await registry.registrars(admin.address)).to.equal(true);
    });

    it("only lets the admin add or remove registrars", async function () {
      const { registry, registrar, outsider } = await loadFixture(deployFixture);
      await expect(registry.connect(outsider).addRegistrar(outsider.address)).to.be.revertedWith("Only admin");
      await expect(registry.removeRegistrar(registrar.address))
        .to.emit(registry, "RegistrarRemoved").withArgs(registrar.address);
      expect(await registry.registrars(registrar.address)).to.equal(false);
    });

    it("rejects register and transfer from a non-registrar wallet", async function () {
      const { registry, outsider } = await loadFixture(registeredFixture);
      await expect(registry.connect(outsider).registerLand("LAND999", "X", "Y", HASH_1, URL_1))
        .to.be.revertedWith("Only an approved registrar can do this");
      await expect(registry.connect(outsider).transferOwnership("LAND101", "X", HASH_2, URL_2))
        .to.be.revertedWith("Only an approved registrar can do this");
    });
  });

  describe("Registration and transfer", function () {
    it("stores the record with document URL and signer", async function () {
      const { registry, registrar } = await loadFixture(registeredFixture);
      const land = await registry.getLand("LAND101");
      expect(land.ownerName).to.equal("Ramesh Kumar");
      expect(land.docHash).to.equal(HASH_1);
      expect(land.docUrl).to.equal(URL_1);
      expect(land.registeredBy).to.equal(registrar.address);
    });

    it("rejects duplicate land IDs", async function () {
      const { registry, registrar } = await loadFixture(registeredFixture);
      await expect(registry.connect(registrar).registerLand("LAND101", "A", "B", HASH_2, URL_2))
        .to.be.revertedWith("Land already registered");
    });

    it("appends transfers to the history and keeps the location", async function () {
      const { registry, registrar } = await loadFixture(registeredFixture);
      await expect(registry.connect(registrar).transferOwnership("LAND101", "Priya Sharma", HASH_2, URL_2))
        .to.emit(registry, "OwnershipTransferred");
      const history = await registry.getHistory("LAND101");
      expect(history.length).to.equal(2);
      expect(history[0].ownerName).to.equal("Ramesh Kumar");
      expect(history[1].ownerName).to.equal("Priya Sharma");
      expect(history[1].location).to.equal("Chengalpattu");
      expect((await registry.getLand("LAND101")).docUrl).to.equal(URL_2);
    });

    it("rejects transfer of an unregistered land", async function () {
      const { registry, registrar } = await loadFixture(deployFixture);
      await expect(registry.connect(registrar).transferOwnership("NOPE", "A", HASH_1, URL_1))
        .to.be.revertedWith("Land not registered");
    });
  });

  describe("Document verification", function () {
    it("recognises the current deed, an older deed and a tampered one", async function () {
      const { registry, registrar } = await loadFixture(registeredFixture);
      await registry.connect(registrar).transferOwnership("LAND101", "Priya Sharma", HASH_2, URL_2);

      const current = await registry.verifyDocument("LAND101", HASH_2);
      expect([current.found, current.isCurrent, current.version]).to.deep.equal([true, true, 2n]);

      const older = await registry.verifyDocument("LAND101", HASH_1);
      expect([older.found, older.isCurrent, older.version]).to.deep.equal([true, false, 1n]);

      const tampered = await registry.verifyDocument("LAND101", "deadbeef");
      expect([tampered.found, tampered.isCurrent, tampered.version]).to.deep.equal([false, false, 0n]);

      expect(await registry.verifyHash("LAND101", HASH_2)).to.equal(true);
      expect(await registry.verifyHash("LAND101", HASH_1)).to.equal(false);
    });
  });
});
