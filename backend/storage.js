require("dotenv").config({ quiet: true });
const fs = require("fs");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// S3 jab S3_BUCKET set ho (AWS deploy), warna Cloudinary (purana local setup)
const BUCKET = process.env.S3_BUCKET;
const s3 = BUCKET ? new S3Client({ region: process.env.AWS_REGION }) : null;
const LINK_EXPIRY_SECONDS = 3600;

// Private bucket ke object ka 1 ghante wala download link
function signedUrl(key) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: LINK_EXPIRY_SECONDS });
}

// Document upload karo → { key, url }
async function uploadDocument(filePath, landId) {
  if (!BUCKET) {
    const { uploadToCloud } = require("./cloudinary");
    return { key: null, url: await uploadToCloud(filePath, landId) };
  }
  const key = `land-documents/${landId}/${Date.now()}.pdf`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fs.readFileSync(filePath),
    ContentType: "application/pdf",
  }));
  return { key, url: await signedUrl(key) };
}

module.exports = { uploadDocument, signedUrl, usingS3: Boolean(BUCKET) };
