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
