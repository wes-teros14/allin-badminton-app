/**
 * Neon Function `keepalive` — see handler.ts (daily Supabase ping) and jwks.ts (daily key-list
 * refresh). Runs from the `supabase-keepalive` schedule trigger in neon.ts (19:00 UTC = 03:00 Manila).
 *
 * Env (declared in neon.ts):
 *   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY  the project to keep awake (always prod) and its public key.
 *   JWKS_SUPABASE_URL                       the project whose sign-in tokens this branch's Data API
 *                                           accepts (DEV on test branches, prod on production).
 *   JWKS_BUCKET                             the bucket holding jwks.json (the Data API's JWKS URL).
 *   ANON_JWKS                               {"keys":[...]} — the anonymous token's public key(s).
 *   AWS_*                                   injected by Neon because neon.ts declares a bucket.
 * The refresh is skipped when JWKS_BUCKET is unset.
 */
import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createKeepaliveHandler } from './handler'
import { refreshJwks, type Jwk } from './jwks'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

const JWKS_KEY = 'jwks.json'
const bucket = process.env.JWKS_BUCKET

function jwksRefresher(bucketName: string) {
  const s3 = new S3Client({ forcePathStyle: true }) // Neon requires path-style addressing
  const authIssuer = `${required('JWKS_SUPABASE_URL').replace(/\/+$/, '')}/auth/v1`
  const anonKeys = (JSON.parse(required('ANON_JWKS')) as { keys?: Jwk[] }).keys ?? []

  return () =>
    refreshJwks({
      anonKeys,
      fetchSupabaseKeys: async () => {
        const res = await fetch(`${authIssuer}/.well-known/jwks.json`)
        if (!res.ok) throw new Error(`Supabase JWKS answered ${res.status}`)
        return ((await res.json()) as { keys?: Jwk[] }).keys ?? []
      },
      readCurrent: async () => {
        try {
          const res = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: JWKS_KEY }))
          return (await res.Body?.transformToString()) ?? null
        } catch (error) {
          if (error instanceof NoSuchKey) return null
          throw error
        }
      },
      write: async (body) => {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: JWKS_KEY,
            Body: body,
            ContentType: 'application/json',
            CacheControl: 'public, max-age=300',
          }),
        )
      },
    })
}

const handler = createKeepaliveHandler({
  supabaseUrl: required('SUPABASE_URL'),
  publishableKey: required('SUPABASE_PUBLISHABLE_KEY'),
  refreshJwks: bucket ? jwksRefresher(bucket) : undefined,
})

export default { fetch: handler }
