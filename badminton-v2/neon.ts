import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  auth: false,
  functions: {
    // Hands out 60 s Realtime passes for live-update channels (functions/seal/handler.ts).
    seal: {
      name: "realtime seal",
      source: "functions/seal/index.ts",
      env: {
        // Deploy with `neon deploy --branch <b> --env <file>`; the file holds that branch's
        // NEON_REALTIME_SECRET (from `neon env pull -s realtime`) and SEAL_SUPABASE_URL.
        REALTIME_SECRET: { value: process.env.NEON_REALTIME_SECRET, required: true },
        SUPABASE_URL: { value: process.env.SEAL_SUPABASE_URL, required: true },
        ALLOWED_ORIGINS: "https://badmintontayo.mrkws.com,http://localhost:5173",
      },
    },
    // Gallery photo files: signed links, upload slots, cleanup (functions/gallery/handler.ts).
    // Holds no database password — rows go through the Data API with the caller's own token.
    gallery: {
      name: "gallery photos",
      source: "functions/gallery/index.ts",
      env: {
        SUPABASE_URL: { value: process.env.GALLERY_SUPABASE_URL, required: true },
        DATA_API_URL: { value: process.env.GALLERY_DATA_API_URL, required: true },
        GALLERY_BUCKET: "gallery",
        ALLOWED_ORIGINS: "https://badmintontayo.mrkws.com,http://localhost:5173",
      },
    },
    // Once a day, one tiny database request so the Supabase project (sign-in + files) never
    // pauses for inactivity (functions/keepalive/handler.ts, migration 091).
    keepalive: {
      name: "supabase keep-alive",
      source: "functions/keepalive/index.ts",
      env: {
        // The project to keep awake (prod), even when deploying a test branch. The key is the
        // public publishable key the app already ships.
        SUPABASE_URL: { value: process.env.KEEPALIVE_SUPABASE_URL, required: true },
        SUPABASE_PUBLISHABLE_KEY: { value: process.env.KEEPALIVE_SUPABASE_KEY, required: true },
        // Daily key-list refresh (functions/keepalive/jwks.ts). JWKS_SUPABASE_URL is the project whose
        // sign-ins this branch's Data API accepts; JWKS_BUCKET is the bucket in its JWKS URL;
        // ANON_JWKS is the anonymous token's public key(s), {"keys":[...]}. All public values.
        JWKS_SUPABASE_URL: { value: process.env.JWKS_SUPABASE_URL, required: true },
        JWKS_BUCKET: { value: process.env.JWKS_BUCKET, required: true },
        ANON_JWKS: { value: process.env.ANON_JWKS, required: true },
      },
    },
  },
  // The Data API's key list lives here (owner decision 2026-11-16). Declaring a bucket also gives
  // the Functions their AWS_* storage credentials.
  buckets: {
    jwks: { access: "public_read" },
    // Gallery photos (migration 092). Private: only signed links open a file (owner, 2026-11-20).
    gallery: {},
  },
  triggers: {
    // 19:00 UTC = 03:00 Manila, away from sessions.
    "supabase-keepalive": { type: "schedule", function: "keepalive", cron: "0 19 * * *" },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
