import { S3Client } from "@aws-sdk/client-s3";
import "dotenv/config";

if (!process.env.CLOUDFLARE_ACCESS_KEY_ID) {
  throw new Error("CLOUDFLARE_ACCESS_KEY_ID is required");
}

if (!process.env.CLOUDFLARE_SECRET_ACCESS_KEY) {
  throw new Error("CLOUDFLARE_SECRET_ACCESS_KEY is required");
}

if (!process.env.CLOUDFLARE_ENDPOINT) {
  throw new Error("CLOUDFLARE_ENDPOINT is required");
}

const S3 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});

export default S3;