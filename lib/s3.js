const { S3Client } = require("@aws-sdk/client-s3");

const BUCKET = process.env.AWS_S3_BUCKET;
const REGION = process.env.AWS_REGION || "us-east-1";

if (!BUCKET) console.warn("WARNING: AWS_S3_BUCKET env var not set");

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

module.exports = { s3, BUCKET, REGION };
