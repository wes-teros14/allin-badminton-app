/**
 * Neon Function `gallery` — see handler.ts for what it does and why.
 *
 * Env (declared in neon.ts, per branch; all public values):
 *   SUPABASE_URL     the Supabase project whose sign-ins we trust (DEV for test branches, prod for production).
 *   DATA_API_URL     this branch's Data API base, e.g. https://ep-….apirest…/neondb/rest/v1
 *   GALLERY_BUCKET   the private bucket holding the photos (`gallery`).
 *   ALLOWED_ORIGINS  comma-separated exact browser origins.
 *   AWS_*            injected by Neon for the branch's object storage.
 */
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { createGalleryHandler, type PhotoRow } from './handler'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

const issuer = `${required('SUPABASE_URL').replace(/\/+$/, '')}/auth/v1`
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
const api = required('DATA_API_URL').replace(/\/+$/, '')
const Bucket = required('GALLERY_BUCKET')
const s3 = new S3Client({ forcePathStyle: true }) // Neon requires path-style addressing

const COLS = 'id,session_id,version,ready'
const GET_TTL = 7 * 24 * 3600 // Neon's maximum
const PUT_TTL = 300

async function call(token: string, path: string, init: RequestInit = {}): Promise<PhotoRow[]> {
  const res = await fetch(`${api}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers as Record<string, string> | undefined),
    },
  })
  if (!res.ok) throw new Error(`Data API ${init.method ?? 'GET'} ${res.status}: ${await res.text()}`)
  const text = await res.text()
  return text ? (JSON.parse(text) as PhotoRow[]) : []
}

const handler = createGalleryHandler({
  verify: async (token) => {
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer, audience: 'authenticated' })
      return typeof payload.sub === 'string' ? payload.sub : null
    } catch {
      return null
    }
  },
  rows: {
    select: (token, ids) => call(token, `/session_photos?select=${COLS}&id=in.(${ids.join(',')})`),
    touch: async (token, id) => {
      const [row] = await call(token, `/session_photos?select=${COLS}&id=eq.${id}`)
      if (!row) return null
      // RLS's UPDATE rule decides: a row comes back only if this caller may change it.
      const [changed] = await call(token, `/session_photos?id=eq.${id}&select=${COLS}`, {
        method: 'PATCH',
        body: JSON.stringify({ version: row.version }),
      })
      return changed ?? null
    },
    remove: async (token, id) => {
      const [row] = await call(token, `/session_photos?id=eq.${id}&select=${COLS}`, { method: 'DELETE' })
      return row ?? null
    },
  },
  files: {
    signGet: (Key, signingDate) =>
      getSignedUrl(s3, new GetObjectCommand({ Bucket, Key }), { expiresIn: GET_TTL, signingDate }),
    signPut: (Key, ContentType) =>
      getSignedUrl(
        s3,
        new PutObjectCommand({ Bucket, Key, ContentType, CacheControl: 'private, max-age=31536000, immutable' }),
        { expiresIn: PUT_TTL, signableHeaders: new Set(['content-type']) },
      ),
    list: async (Prefix) => {
      const keys: string[] = []
      let ContinuationToken: string | undefined
      do {
        const res = await s3.send(new ListObjectsV2Command({ Bucket, Prefix, ContinuationToken }))
        for (const o of res.Contents ?? []) if (o.Key) keys.push(o.Key)
        ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
      } while (ContinuationToken)
      return keys
    },
    remove: async (keys) => {
      for (let i = 0; i < keys.length; i += 1000) {
        await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) } }))
      }
    },
  },
  allowedOrigins: required('ALLOWED_ORIGINS')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
})

export default { fetch: handler }
