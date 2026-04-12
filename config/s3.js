// config/s3.js
import AWS from "aws-sdk";
import crypto from "crypto";

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

export const s3 = new AWS.S3();

export const uploadImage = async (fileBuffer, fileName, mimetype) => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `${crypto.randomBytes(16).toString("hex")}-${fileName}`,
    Body: fileBuffer,
    ACL: "public-read",
    ContentType: mimetype || fileBuffer.mimetype || "image/jpeg",
  };

  const data = await s3.upload(params).promise();
  return data.Location; // Public URL of the uploaded image
};

export const deleteImage = async (imageUrl) => {
  if (!imageUrl) return;
  
  try {
    // Extract the key from the S3 URL
    const url = new URL(imageUrl);
    const key = url.pathname.substring(1); // Remove leading slash
    
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
    };

    await s3.deleteObject(params).promise();
    console.log(`Successfully deleted image: ${key}`);
  } catch (error) {
    console.error(`Error deleting image from S3: ${error.message}`);
    // Don't throw error to prevent blocking the main operation
  }
};
