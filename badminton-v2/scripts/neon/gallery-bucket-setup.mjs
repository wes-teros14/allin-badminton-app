#!/usr/bin/env node
// scripts/neon/gallery-bucket-setup.mjs — one-time setup + self-test of a branch's `gallery` bucket.
//   npx neon-env run --project-id lucky-heart-02739020 --branch <dev|production> -- node scripts/neon/gallery-bucket-setup.mjs
// 1. Sets CORS so the app's pages may PUT (upload) and GET files directly.
// 2. Proves a GET link signed with a signing time 2 days in the past still opens (the Function signs
//    at the start of a 3-day window so the URL stays the same and phones can cache it).
// 3. Proves an unsigned GET is refused (the bucket is private).
// Prints the storage host so you can see which branch it touched. Never prints credentials.
import { DeleteObjectCommand, GetBucketCorsCommand, GetObjectCommand, PutBucketCorsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const Bucket = 'gallery'
const ORIGINS = ['https://badmintontayo.mrkws.com', 'http://localhost:5173']
const s3 = new S3Client({ forcePathStyle: true })
console.log('storage host:', new URL(process.env.AWS_ENDPOINT_URL_S3).host)

await s3.send(new PutBucketCorsCommand({
  Bucket,
  CORSConfiguration: {
    CORSRules: [{ AllowedOrigins: ORIGINS, AllowedMethods: ['GET', 'PUT', 'HEAD'], AllowedHeaders: ['content-type'], MaxAgeSeconds: 86400 }],
  },
}))
const cors = await s3.send(new GetBucketCorsCommand({ Bucket }))
console.log('cors:', JSON.stringify(cors.CORSRules))

const Key = `_selftest/${Date.now()}`
await s3.send(new PutObjectCommand({ Bucket, Key, Body: 'ok', ContentType: 'text/plain' }))
try {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000)
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket, Key }), { expiresIn: 7 * 24 * 3600, signingDate: twoDaysAgo })
  const res = await fetch(url, { headers: { Origin: ORIGINS[1] } })
  console.log('GET signed 2 days ago:', res.status, '| allow-origin:', res.headers.get('access-control-allow-origin'))
  const again = await getSignedUrl(s3, new GetObjectCommand({ Bucket, Key }), { expiresIn: 7 * 24 * 3600, signingDate: twoDaysAgo })
  console.log('same signing time gives same URL:', again === url)
  const plain = await fetch(`${process.env.AWS_ENDPOINT_URL_S3.replace(/\/+$/, '')}/${Bucket}/${Key}`)
  console.log('unsigned GET (must be refused):', plain.status)
  const pre = await fetch(url, { method: 'OPTIONS', headers: { Origin: ORIGINS[1], 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type' } })
  console.log('preflight PUT from localhost:', pre.status, '| allow-origin:', pre.headers.get('access-control-allow-origin'))
} finally {
  await s3.send(new DeleteObjectCommand({ Bucket, Key }))
}
