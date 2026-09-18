import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { execSync } from 'node:child_process'

/**
 * The commit this bundle was built from, shown at the bottom of the profile page.
 * It is generated, never hand-maintained, so it cannot drift from what shipped.
 *
 * Vercel exposes the deployed commit as a build-time env var and does not
 * guarantee a usable .git directory, so that is tried first; `git` covers local
 * builds. 'dev' is the last resort — a stamp reading 'dev' means the build came
 * from somewhere with neither, which is itself worth knowing.
 */
function commitSha(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA
  if (fromVercel) return fromVercel.slice(0, 7)

  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_COMMIT__: JSON.stringify(commitSha()),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
