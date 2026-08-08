require("dotenv").config();
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// PDF ko cloud pe upload karo, URL return karo
async function uploadToCloud(filePath, landId) {
  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: "raw",        // PDF ke liye "raw" use hota hai
    folder: "land-documents",
    public_id: `${landId}_${Date.now()}`,
  });
  return result.secure_url;
}

module.exports = { uploadToCloud };