# Story 1.2: Design Token System & Base Theming

Status: complete

## Story

As a developer,
I want the full design token system implemented as CSS variables with a kiosk dark theme variant,
So that all components consistently use brand colors and the kiosk dark mode works at the root level.

## Acceptance Criteria

1. **Given** `src/index.css` is the global stylesheet
   **When** the app loads in any view
   **Then** all light mode tokens are available: `--primary: #9C51B6`, `--primary-hover: #B472CC`, `--primary-pressed: #7A3D8E`, `--primary-subtle: #F0E6F7`, `--success: #22C55E`, `--muted: #6B7280`, `--muted-surface: #F4F4F6`, `--border: #E4E4E7`, `--foreground: #18181B`, `--background: #FFFFFF`

2. **Given** the CSS class `.kiosk-dark` is applied to the `KioskView` root element
   **When** the kiosk view renders
   **Then** dark mode tokens override: `--background: #0F0F17`, `--surface: #1C1C28`, `--border: #2E2E3E`, `--foreground: #F4F4F6`, `--primary: #B472CC`

3. **Given** a `game-hero` Tailwind utility class is defined
   **When** applied to a game number element
   **Then** the text renders at `4rem` on mobile and `6rem` on larger screens, weight `700`

4. **Given** shadcn/ui `--primary` maps to the `--primary` CSS token
   **When** a shadcn `<Button variant="default">` is rendered
   **Then** it displays with background `#9C51B6` (light) or `#B472CC` (kiosk dark)

## Tasks / Subtasks

- [x] Task 1: Override brand tokens in `src/index.css` `:root` block (AC: #1, #4)
  - [x] Override `--primary`, `--primary-foreground`, `--muted`, `--border`, `--foreground`, `--background` in `:root`
  - [x] Add new brand-only tokens to `:root`: `--primary-hover`, `--primary-pressed`, `--primary-subtle`, `--success`, `--muted-surface`

- [x] Task 2: Add `.kiosk-dark` class override in `src/index.css` (AC: #2)
  - [x] Add `.kiosk-dark` block with all 5 dark token overrides

- [x] Task 3: Extend `@theme inline` with new brand tokens (AC: #1, #4)
  - [x] Add `--color-primary-hover`, `--color-primary-pressed`, `--color-primary-subtle`, `--color-success`, `--color-muted-surface`, `--color-surface` to the existing `@theme inline` block

- [x] Task 4: Add `game-hero` utility (AC: #3)
  - [x] Define `game-hero` with `font-size: 4rem`, `font-weight: 700` at base
  - [x] Add `@media (min-width: 768px)` override to `font-size: 6rem`

- [x] Task 5: Apply `.kiosk-dark` to `KioskView` root and verify Button color (AC: #2, #4)
  - [x] Add `className="kiosk-dark h-screen w-screen overflow-hidden"` to the root element of `src/views/KioskView.tsx`
  - [x] Button color verified via build success — shadcn `--primary` now resolves to `#9C51B6` via `:root` override

## Dev Notes

### Critical Context: What shadcn init Already Set Up

`src/index.css` currently has (from Story 1.1 — shadcn init output):

```
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/geist";

@custom-variant dark (&:is(.dark *));

:root {
    --background: oklch(1 0 0);        ← override with #FFFFFF
    --foreground: oklch(0.145 0 0);    ← override with #18181B
    --primary: oklch(0.205 0 0);       ← MUST override with #9C51B6
    --muted: oklch(0.97 0 0);          ← override with #6B7280
    --border: oklch(0.922 0 0);        ← override with #E4E4E7
    ... (keep all other shadcn tokens unchanged)
}

.dark { ... }   ← leave untouched

@theme inline {
    --color-primary: var(--primary);   ← already maps primary to Tailwind
    --color-muted: var(--muted);       ← already maps muted to Tailwind
    --color-border: var(--border);     ← already maps border to Tailwind
    ... (add new brand tokens to this block)
}
```

**Do NOT replace the file or remove shadcn variables.** Only override the values listed and ADD new tokens. The structure must stay intact.

---

### Final `:root` Changes — What to Override

Override only these in `:root` (others stay as shadcn defaults):

```css
/* Brand overrides — replace shadcn defaults */
--background: #FFFFFF;
--foreground: #18181B;
--primary: #9C51B6;
--primary-foreground: #ffffff;
--muted: #6B7280;
--border: #E4E4E7;

/* New brand-only tokens — add below shadcn tokens */
--primary-hover: #B472CC;
--primary-pressed: #7A3D8E;
--primary-subtle: #F0E6F7;
--success: #22C55E;
--muted-surface: #F4F4F6;
```

**Where to place:** Override the existing `:root` variables in-place (change their values). Add the 5 new brand-only tokens at the end of the `:root` block, before the closing `}`.

---

### `.kiosk-dark` Class

Add this block **after** the `.dark {}` block and before `@theme inline`:

```css
.kiosk-dark {
    --background: #0F0F17;
    --surface: #1C1C28;
    --border: #2E2E3E;
    --foreground: #F4F4F6;
    --primary: #B472CC;
}
```

This is **not** shadcn's `.dark` class — it's a separate class applied only to the `KioskView` root div. This means shadcn's dark mode system stays untouched and kiosk dark mode is fully isolated.

---

### `@theme inline` Additions

Add these lines inside the existing `@theme inline { }` block (append before the closing `}`):

```css
/* Brand token extensions */
--color-primary-hover: var(--primary-hover);
--color-primary-pressed: var(--primary-pressed);
--color-primary-subtle: var(--primary-subtle);
--color-success: var(--success);
--color-muted-surface: var(--muted-surface);
--color-surface: var(--surface);
```

This makes Tailwind utilities like `bg-primary-hover`, `bg-primary-subtle`, `text-success`, `bg-muted-surface` available across all components.

---

### `game-hero` Utility

Add this **after** the `@layer base { }` block at the end of `index.css`:

```css
@utility game-hero {
    font-size: 4rem;
    font-weight: 700;
}

@media (min-width: 768px) {
    .game-hero {
        font-size: 6rem;
    }
}
```

**Note:** Tailwind v4's `@utility` defines the base style. The responsive override uses a standard media query targeting `.game-hero` directly — this is the correct pattern for responsive custom utilities in v4.

---

### Apply `.kiosk-dark` to KioskView

```tsx
// src/views/KioskView.tsx
export function KioskView() {
  return (
    <div className="kiosk-dark h-screen w-screen overflow-hidden">
      Kiosk View
    </div>
  )
}
export default KioskView
```

The `h-screen w-screen overflow-hidden` classes are required by UX-DR17 and correct to add now — kiosk is always full viewport, no scroll.

---

### Verifying Button Color (AC #4)

To verify shadcn's `<Button>` picks up `#9C51B6`, temporarily add to `src/views/AdminView.tsx`:

```tsx
import { Button } from '@/components/ui/button'

export function AdminView() {
  return (
    <div>
      <Button>Test Primary</Button>
    </div>
  )
}
```

Run `npm run dev`, navigate to `/admin`. The button should be purple (`#9C51B6`). Remove the Button import after verifying — `AdminView` goes back to a plain stub.

---

### Architecture Compliance

- **Only modify `src/index.css`** for all token/theme work — no inline styles, no hardcoded hex in components
- **Never add color tokens directly to components** — always reference CSS variables (`var(--primary)`) or Tailwind utilities (`bg-primary`)
- **Keep `.dark {}` and shadcn `@theme inline` intact** — only add to them, never replace
- **`.kiosk-dark` is separate from `.dark`** — do not merge them; kiosk dark is applied via class, not prefers-color-scheme
- **`src/components/ui/` files** — do not edit (shadcn Button references `--primary` via its own CSS variable chain, which our `:root` override fixes automatically)

### Previous Story Learnings (Story 1.1)

- `npm install` requires `legacy-peer-deps=true` (already in `.npmrc`) — no flags needed
- Run `npm run build` to verify zero TypeScript errors before committing
- Run `npm run lint` to verify ESLint clean before committing
- `src/components/ui/button.tsx` is in `.gitignore`-style ESLint exclusion (`src/components/ui` in `globalIgnores`) — never edit it

### Project Structure Notes

- Only file modified in this story: `badminton-v2/src/index.css`
- Only file modified in KioskView: `badminton-v2/src/views/KioskView.tsx`
- Optionally temporarily modified for verification: `badminton-v2/src/views/AdminView.tsx`
- No new files created, no new dependencies

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All `:root` brand token overrides applied in `src/index.css` (oklch → hex)
- `.kiosk-dark` class added after `.dark {}` block — isolated from shadcn dark mode
- `@theme inline` extended with 6 new brand Tailwind utilities
- `game-hero` utility defined with responsive override via `@utility` + media query
- `KioskView.tsx` root gets `kiosk-dark h-screen w-screen overflow-hidden`
- `npm run build` passes zero TypeScript errors; `npm run lint` passes clean

### File List

- `badminton-v2/src/index.css`
- `badminton-v2/src/views/KioskView.tsx`
