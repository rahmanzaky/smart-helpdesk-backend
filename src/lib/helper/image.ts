import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY!,
    secretAccessKey: process.env.R2_SECRET_KEY!,
  },
});

export async function uploadToR2Buffer(buffer: Buffer, key: string, mime: string) {
  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: mime,
      ContentLength: buffer.length,
    })
  );

  return {
    key,
    url: `${process.env.R2_PUBLIC_URL}/${key}`,
  };
}

export async function generatePresignedUrl(key: string, expiresIn = 300) {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: key,
  });
  return getSignedUrl(r2, command, { expiresIn });
}