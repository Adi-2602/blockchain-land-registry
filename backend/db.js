require("dotenv").config({ quiet: true });
const fs = require("fs");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");

// DynamoDB jab USERS_TABLE / DOCS_TABLE set ho (AWS deploy), warna users.json (local)
const USERS_TABLE = process.env.USERS_TABLE;
const DOCS_TABLE = process.env.DOCS_TABLE;
const ddb = USERS_TABLE || DOCS_TABLE
  ? DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }))
  : null;

const USERS_FILE = "./users.json";
const readUsersFile = () => (fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE, "utf-8")) : []);

async function getUser(email) {
  if (USERS_TABLE) {
    const { Item } = await ddb.send(new GetCommand({ TableName: USERS_TABLE, Key: { email } }));
    return Item || null;
  }
  return readUsersFile().find((u) => u.email === email) || null;
}

// false return karta hai agar email pehle se registered hai
async function createUser(user) {
  if (USERS_TABLE) {
    try {
      await ddb.send(new PutCommand({
        TableName: USERS_TABLE,
        Item: { ...user, createdAt: Date.now() },
        ConditionExpression: "attribute_not_exists(email)",
      }));
      return true;
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") return false;
      throw err;
    }
  }
  const users = readUsersFile();
  if (users.find((u) => u.email === user.email)) return false;
  users.push(user);
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  return true;
}

// Land ID ↔ S3 document ka record (blockchain par sirf hash hota hai)
async function saveDocument(doc) {
  if (!DOCS_TABLE) return;
  await ddb.send(new PutCommand({ TableName: DOCS_TABLE, Item: { ...doc, uploadedAt: Date.now() } }));
}

async function listDocuments(landId) {
  if (!DOCS_TABLE) return [];
  const { Items } = await ddb.send(new QueryCommand({
    TableName: DOCS_TABLE,
    KeyConditionExpression: "landId = :id",
    ExpressionAttributeValues: { ":id": landId },
  }));
  return Items || [];
}

module.exports = { getUser, createUser, saveDocument, listDocuments };
