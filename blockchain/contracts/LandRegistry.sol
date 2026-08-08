// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract LandRegistry {

    // Ek land record ki saari details
    struct LandRecord {
        string landId;
        string ownerName;
        string location;
        string docHash;      // document ka SHA-256 hash
        uint256 timestamp;   // kab register/transfer hua
    }

    // landId => current owner ka record
    mapping(string => LandRecord) private lands;

    // landId => poori ownership history (purane + current sab records)
    mapping(string => LandRecord[]) private history;

    // Events — frontend/demo mein transactions track karne ke liye
    event LandRegistered(string landId, string ownerName, uint256 timestamp);
    event OwnershipTransferred(string landId, string newOwner, uint256 timestamp);

    // Helper: check karo ki land exist karta hai ya nahi
    function landExists(string memory landId) public view returns (bool) {
        return bytes(lands[landId].landId).length != 0;
    }

    // 1. Naya land register karo
    function registerLand(
        string memory landId,
        string memory ownerName,
        string memory location,
        string memory docHash
    ) public {
        require(!landExists(landId), "Land already registered");

        LandRecord memory record = LandRecord({
            landId: landId,
            ownerName: ownerName,
            location: location,
            docHash: docHash,
            timestamp: block.timestamp
        });

        lands[landId] = record;
        history[landId].push(record);   // history ki first entry

        emit LandRegistered(landId, ownerName, block.timestamp);
    }

    // 2. Ownership transfer karo
    function transferOwnership(
        string memory landId,
        string memory newOwner,
        string memory newDocHash
    ) public {
        require(landExists(landId), "Land not registered");

        LandRecord memory newRecord = LandRecord({
            landId: landId,
            ownerName: newOwner,
            location: lands[landId].location,  // location same rehti hai
            docHash: newDocHash,
            timestamp: block.timestamp
        });

        lands[landId] = newRecord;
        history[landId].push(newRecord);

        emit OwnershipTransferred(landId, newOwner, block.timestamp);
    }

    // 3. Current record dekho
    function getLand(string memory landId) public view returns (LandRecord memory) {
        require(landExists(landId), "Land not registered");
        return lands[landId];
    }

    // 4. Poori ownership history dekho
    function getHistory(string memory landId) public view returns (LandRecord[] memory) {
        require(landExists(landId), "Land not registered");
        return history[landId];
    }

    // 5. Document hash verify karo (tamper detection)
    function verifyHash(string memory landId, string memory hash) public view returns (bool) {
        require(landExists(landId), "Land not registered");
        return keccak256(abi.encodePacked(lands[landId].docHash)) ==
               keccak256(abi.encodePacked(hash));
    }
}