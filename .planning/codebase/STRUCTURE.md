# STRUCTURE.md — Directory Layout & Organization

## Repository Root

```
C:/1Wes/all-in-badminton-app/
├── badminton-v2/              # Main app (the only production codebase)
├── _bmad-output/              # BMAD framework artifacts (planning docs, specs)
├── _bmad/                     # BMAD framework modules (do not edit)
├── agent-os/                  # Agent OS config
├── .claude/                   # Claude Code config, GSD workflows, agents
├── .planning/                 # GSD planning directory (this document lives here)
├── docs/                      # Human-facing project documentation
├── tasks/                     # Task tracking (todo.md, lessons.md)
├── temporary_files/           # Scratch space
└── CLAUDE.md                  # Project-level Claude instructions
```

## App Directory: `badminton-v2/`

```
badminton-v2/
├── src/                       # Application source code
│   ├── main.tsx               # React root mount
│   ├── App.tsx                # Router tree + providers
│   ├── App.css                # App-level styles
│   ├── index.css              # Tailwind + global CSS
│   ├── views/                 # Route-level page components (lazy-loaded)
│   ├── components/            # Feature + UI components
│   │   └── ui/                # shadcn/ui base components
│   ├── layouts/               # Shared layout wrappers
│   │   └── PlayerLayout.tsx   # Top nav, cheers gate, notification provider
│   ├── hooks/                 # Custom hooks (data fetching + mutations)
│   ├── contexts/              # React contexts (Auth, Notifications)
│   ├── lib/                   # Utility modules
│   │   ├── supabase.ts        # Supabase singleton client
│   │   ├── matchGenerator.ts  # Match generation engine (SA optimizer)
│   │   └── utils.ts           # cn() Tailwind class utility
│   ├── types/                 # TypeScript type definitions
│   │   ├── app.ts             # Domain types (UserRole, SessionStatus, etc.)
│   │   └── database.ts        # Generated Supabase schema types
│   └── assets/                # Static assets (images, icons)
├── supabase/
│   └── migrations/            # 44 SQL migration files (001–044)
├── scripts/                   # Dev utilities
│   ├── seed-test-users.ts     # Seed test player accounts
│   ├── seed-extra-users.ts    # Seed extra users
│   └── copy-prod-profiles-to-dev.ts
├── tests/                     # Playwright E2E tests
├── __tests__/                 # Vitest unit tests (excluded from tsconfig)
├── public/                    # Vite static assets
├── dist/                      # Build output
├── package.json
├── vite.config.ts
├── tsconfig.app.json          # App TypeScript config (strict mode)
├── tsconfig.json
├── tsconfig.node.json
├── playwright.config.ts
├── vitest.config.ts
├── vercel.json
├── eslint.config.js
└── components.json            # shadcn/ui config
```

## Views (`src/views/`)

| File | Route | Role |
|------|-------|------|
| `HomeView.tsx` | `/` | Public |
| `LiveBoardView.tsx` | `/live-board/:sessionId?` | Public |
| `RegisterView.tsx` | `/register` | Public |
| `ProfileView.tsx` | `/profile` | Player |
| `MySessionsView.tsx` | `/sessions` | Player |
| `SessionPlayerDetailView.tsx` | `/sessions/:sessionId` | Player |
| `LeaderboardView.tsx` | `/leaderboard` | Player |
| `TodayView.tsx` | `/today` | Player (legacy) |
| `PlayerView.tsx` | `/match-schedule/...` | Player (legacy) |
| `AdminView.tsx` | `/admin` | Admin |
| `SessionView.tsx` | `/session/:sessionId` | Admin |
| `PlayersView.tsx` | `/players` | Admin |

## Components (`src/components/`)

| File | Purpose |
|------|---------|
| `TopNavBar.tsx` | Global top navigation bar |
| `CheersPanel.tsx` | Post-match cheer rating gate |
| `MatchGeneratorPanel.tsx` | Admin match schedule generator UI |
| `CourtCard.tsx` | Single court match display |
| `CourtTabs.tsx` | Court tab switcher |
| `GameCard.tsx` | Match card display |
| `RosterPanel.tsx` | Session player roster |
| `LiveIndicator.tsx` | Realtime connection status badge |
| `StatusChip.tsx` | Session status display chip |
| `PlayerScheduleHeader.tsx` | Player match schedule header |
| `RegistrationURLCard.tsx` | Shareable registration link card |
| `SessionRecapBanner.tsx` | Post-session summary banner |
| `DevLoginPanel.tsx` | Dev-only quick login panel |

## Hooks (`src/hooks/`)

| File | Purpose |
|------|---------|
| `useSession.ts` | Full session lifecycle + mutations |
| `useActiveSession.ts` | Current active session detection |
| `useAdminSession.ts` | Admin session management |
| `useAdminActions.ts` | Admin-specific mutations |
| `useAuth.ts` | Auth context consumer hook |
| `useRealtime.ts` | Supabase Realtime subscription wrapper |
| `useCourtState.ts` | Court assignment state |
| `useMatchCheers.ts` | Pending cheer detection + submission |
| `usePlayerList.ts` | Player list data |
| `usePlayers.ts` | Player data with stats |
| `usePlayerSchedule.ts` | Individual player match schedule |
| `usePlayerSessions.ts` | Player session history |
| `usePlayerStats.ts` | Player statistics |
| `useProfileStats.ts` | Profile page stats |
| `useRegisteredPlayers.ts` | Session registration list |
| `useRegistration.ts` | Player self-registration |
| `useRoster.ts` | Session roster |
| `useSession.ts` | Session lifecycle |
| `useSessionList.ts` | All sessions list |

## Database Migrations (`supabase/migrations/`)

44 sequential migrations, numbered `001_` through `044_`. Key milestones:

- `001-005` — Core tables: profiles, sessions, invitations, registrations, matches
- `013` — Player stats tables
- `022-031` — Cheer system (types, multipliers, match-scoped)
- `029` + `041` — Notifications + Realtime
- `033` — Announcements
- `044` — Generator settings stored on sessions

## Naming Conventions

- **Files:** `PascalCase.tsx` for React components/views; `camelCase.ts` for hooks/lib
- **Hooks:** prefix `use` (e.g., `useSession`, `useRealtime`)
- **DB tables:** snake_case plural (e.g., `session_registrations`, `player_stats`)
- **Supabase types:** Generated in `src/types/database.ts` — not hand-edited
- **App types:** Hand-written in `src/types/app.ts` — add as needed
- **Path alias:** `@/` maps to `src/` (e.g., `@/hooks/useSession`)
