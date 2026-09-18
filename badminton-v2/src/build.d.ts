/**
 * Injected by the `define` block in vite.config.ts at build time. Read these
 * through `src/lib/appBuild.ts` rather than directly — vitest.config.ts has no
 * `define` block, so a bare reference is a ReferenceError under test.
 */
declare const __APP_COMMIT__: string
declare const __APP_BUILT_AT__: string
