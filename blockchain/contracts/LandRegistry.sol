// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract LandRegistry {

    // Ek land record ki saari details
    struct LandRecord {
        string landId;
        string ownerName;
        string location;
        string docHash;        // document ka SHA-256 hash
        string docUrl;         // cloud (Cloudinary) par document ka link
        address registeredBy;  // kis registrar wallet ne sign kiya
        uint256 timestamp;     // kab register/transfer hua
    }

    // Admin = jisne contract deploy kiya; wahi registrars add/remove karega
    address public admin;

    // Sirf approved registrar wallets hi land register/transfer kar sakte hain
    mapping(address => bool) public registrars;

    // landId => current owner ka record
    mapping(string => LandRecord) private lands;

    // landId => poori ownership history (purane + current sab records)
    mapping(string => LandRecord[]) private history;

    // Events — frontend/demo mein transactions track karne ke liye
    event LandRegistered(string landId, string ownerName, address indexed registrar, uint256 timestamp);
    event OwnershipTransferred(string landId, string newOwner, address indexed registrar, uint256 timestamp);
    event RegistrarAdded(address indexed registrar);
    event RegistrarRemoved(address indexed registrar);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier onlyRegistrar() {
        require(registrars[msg.sender], "Only an approved registrar can do this");
        _;
    }

    constructor() {
        admin = msg.sender;
        registrars[msg.sender] = true;   // deployer by default registrar bhi hai
        emit RegistrarAdded(msg.sender);
    }

    // ---------- Registrar management ----------

    function addRegistrar(address account) public onlyAdmin {
        require(account != address(0), "Invalid address");
        registrars[account] = true;
        emit RegistrarAdded(account);
    }

    function removeRegistrar(address account) public onlyAdmin {
        registrars[account] = false;
        emit RegistrarRemoved(account);
    }

    // Helper: check karo ki land exist karta hai ya nahi
    function landExists(string memory landId) public view returns (bool) {
        return bytes(lands[landId].landId).length != 0;
    }

    // 1. Naya land register karo
    function registerLand(
        string memory landId,
        string memory ownerName,
        string memory location,
        string memory docHash,
        string memory docUrl
    ) public onlyRegistrar {
        require(bytes(landId).length > 0, "Land ID required");
        require(!landExists(landId), "Land already registered");

        LandRecord memory record = LandRecord({
            landId: landId,
            ownerName: ownerName,
            location: location,
            docHash: docHash,
            docUrl: docUrl,
            registeredBy: msg.sender,
            timestamp: block.timestamp
        });

        lands[landId] = record;
        history[landId].push(record);   // history ki first entry

        emit LandRegistered(landId, ownerName, msg.sender, block.timestamp);
    }

    // 2. Ownership transfer karo
    function transferOwnership(
        string memory landId,
        string memory newOwner,
        string memory newDocHash,
        string memory newDocUrl
    ) public onlyRegistrar {
        require(landExists(landId), "Land not registered");

        LandRecord memory newRecord = LandRecord({
            landId: landId,
            ownerName: newOwner,
            location: lands[landId].location,  // location same rehti hai
            docHash: newDocHash,
            docUrl: newDocUrl,
            registeredBy: msg.sender,
            timestamp: block.timestamp
        });

        lands[landId] = newRecord;
        history[landId].push(newRecord);

        emit OwnershipTransferred(landId, newOwner, msg.sender, block.timestamp);
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

    // 5. Document hash verify karo — sirf current deed ke against
    function verifyHash(string memory landId, string memory hash) public view returns (bool) {
        require(landExists(landId), "Land not registered");
        return keccak256(abi.encodePacked(lands[landId].docHash)) ==
               keccak256(abi.encodePacked(hash));
    }

    // 6. Document ko poori history ke against verify karo
    //    found     = hash kisi bhi record se match hua
    //    isCurrent = match current owner ke deed se hua
    //    version   = kaunsa record match hua (1 = first registration)
    function verifyDocument(string memory landId, string memory hash)
        public
        view
        returns (bool found, bool isCurrent, uint256 version)
    {
        require(landExists(landId), "Land not registered");
        LandRecord[] storage records = history[landId];
        bytes32 target = keccak256(abi.encodePacked(hash));

        // Latest se start karo, taaki same deed dobara use hua ho to newest version mile
        for (uint256 i = records.length; i > 0; i--) {
            if (keccak256(abi.encodePacked(records[i - 1].docHash)) == target) {
                return (true, i == records.length, i);
            }
        }
        return (false, false, 0);
    }
}
