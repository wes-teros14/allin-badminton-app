# CONVENTIONS.md — Code Style & Patterns

## Language & TypeScript

- **TypeScript strict mode** — `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `erasableSyntaxOnly`
- **No `any`** — compiler enforced; type casts use `as` with comments when necessary (e.g., `as never` for Supabase type mismatches)
- **Verbatim module syntax** — `import type` used for type-only imports
- **Target:** ES2023 — modern JS features (structured clone, `at()`, etc.)

## File & Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| React components/views | `PascalCase.tsx` | `SessionView.tsx` |
| Hooks | `camelCase.ts`, `use` prefix | `useSession.ts` |
| Utility lib files | `camelCase.ts` | `matchGenerator.ts` |
| Type files | `camelCase.ts` | `database.ts`, `app.ts` |
| DB tables | `snake_case` plural | `session_registrations` |
| DB columns | `snake_case` | `created_at`, `team1_player1_id` |
| CSS classes | Tailwind utilities | `cn('flex items-center', ...)` |

## Component Patterns

### Function components only
All components are function components. No class components.

```tsx
export function SessionView() { ... }
export default SessionView  // default export for lazy-loaded views
```

### Named exports for layout/shared components, default for views
- Views: `export default` (required for `React.lazy`)
- Components/hooks: named exports preferred

### Props interface inline or above component
```tsx
interface Props {
  courtNumber: 1 | 2
  data: CourtData
}
export function CourtCard({ courtNumber, data }: Props) { ... }
```

### shadcn/ui component usage
- UI components live in `src/components/ui/` — not modified (excluded from ESLint)
- Feature components import from `@/components/ui/...`
- Tailwind classes composed via `cn()` utility from `@/lib/utils`

## State Management

- **No global state library** — all state is local to hooks or component
- **Hooks own data** — views call hooks, pass data to components as props
- **useState + useEffect** pattern throughout
- **refreshKey** pattern for manual data refresh:
  ```ts
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey(k => k + 1)
  useEffect(() => { fetchData() }, [sessionId, refreshKey])
  ```

## Error Handling

- **Supabase errors:** always checked, surfaced via `toast.error(error.message)` (Sonner)
- **No try/catch in hooks** — Supabase client returns `{ data, error }` — error checked inline
- **Exception:** some components use try/finally for loading state:
  ```ts
  try {
    await supabase.from('matches').update(...)
  } finally {
    setIsSaving(false)
  }
  ```
- **Auth errors:** handled in `AuthContext` — role fetch failure silently falls back to null

## Async Patterns

- All Supabase mutations are `async/await` in hook-exposed functions
- Hooks expose async mutation functions (e.g., `lockSchedule`, `openRegistration`)
- Views call mutations directly — no middleware
- `Promise.all` used for parallel Supabase updates (e.g., starting multiple courts)

## Realtime Pattern

```ts
const channel = supabase
  .channel(`channel-name-${id}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `session_id=eq.${id}` }, callback)
  .subscribe(statusCallback)
// Cleanup
return () => supabase.removeChannel(channel)
```

## Tailwind CSS

- Tailwind v4 — no `tailwind.config.js` (config via CSS variables and vite plugin)
- Design tokens: `bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`, etc.
- Inline conditional classes via `cn()`:
  ```ts
  import { cn } from '@/lib/utils'
  cn('base-class', condition && 'conditional-class')
  ```
- Custom hex colors used directly for status indicators (not design tokens):
  ```ts
  'text-[#EB5B00]'  // registration open
  'text-[#FFB200]'  // schedule locked
  'text-[#D91656]'  // in progress
  ```

## Confirmation Pattern

Two-step destructive action confirmation (no modal):
```ts
const [confirmDelete, setConfirmDelete] = useState(false)
const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

function handleDeleteClick() {
  if (!confirmDelete) {
    setConfirmDelete(true)
    deleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
  } else {
    clearTimeout(deleteTimerRef.current!)
    handleDelete()
  }
}
```

## ESLint Config

- `@eslint/js` + `typescript-eslint` recommended rules
- `eslint-plugin-react-hooks` — enforces hooks rules
- `eslint-plugin-react-refresh` — Vite HMR compatibility
- `src/components/ui/` is **ignored** (shadcn generated code)

## Import Order (informal convention)

1. React imports
2. Third-party libraries
3. Internal: `@/` path alias — contexts, hooks, lib, types, components

## Comments

- Block comments for non-obvious logic (e.g., `// 1.`, `// 2.` for multi-step mutations)
- Top-of-file docblocks for complex modules (e.g., `matchGenerator.ts` explains 3-phase architecture)
- `// Cast needed until...` pattern for known Supabase type generation lag
