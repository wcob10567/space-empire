# Space Empire — Project Conventions

OGame-like browser strategy game. Vite + React 19 + Supabase (Postgres + auth + RLS) + Tailwind 4. Universe is 5 galaxies × 499 systems × 15 positions. Solo developer.

This file is auto-loaded at the start of every Claude Code session. Read it. Follow it. The conventions here describe what the codebase **is** post-cleanup; they exist so we don't have to do that cleanup again.

---

## Where things go

### `src/data/` — all static game data
- `techTree.js` — `TECH_TREE` + derived `TECH_TYPES`, `TECH_BY_TYPE`, `TECH_BRANCHES`
- `ships.js` — `SHIPS`, `DEFENSES`, plus derived `SHIP_TYPES`, `SHIP_BY_TYPE`, `DEFENSE_BY_TYPE`, `SHIP_STATS`
- `buildings.js` — `BUILDINGS`, `ALL_BUILDING_TYPES`, `STARTING_BUILDING_TYPES`, `BUILDING_CATEGORIES`
- `defaults.js` — `DEFAULT_RESOURCES`, `PLANET_GEN`

**Never inline these lists in a page or component.** If you need a tech / ship / building reference, import from `src/data/`.

### `src/config/tick.js` — every polling / refresh / animation interval
Named constants, no raw millisecond literals in `setInterval` / `setTimeout` outside this file.

### `src/services/queries.js` — every supabase read
Pages and components use `queries.X(id)`. Inline `supabase.from(...).select(...)` is reserved for this file.

### `src/services/resources.js` — every resource debit / credit
`debitResources(planetId, currentResources, cost)` instead of `metal: prev.metal - cost.metal` ad-hoc.

### Allowed direct supabase imports
- `src/lib/supabase.js` — defines the client
- `src/context/AuthContext.jsx` — `supabase.auth.*` for sign in/up/out
- `src/components/Notifications.jsx` — `supabase.removeChannel` for realtime cleanup
- `src/services/queries.js` and `src/services/resources.js`

Anywhere else, `supabase.*` is a smell. Use the service layer.

### Pages, components, context
- `src/pages/` — top-level routes (Buildings, Research, Shipyard, Fleet, Galaxy, Reports, Overview, Login)
- `src/components/` — cross-cutting UI (DevPanel, GameLayout, Notifications, RenamePlanet)
- `src/context/` — auth + global state

---

## Patterns we use

### User-action handlers
Every click that mutates the DB follows:
1. Optimistic local-state update (snappy UI)
2. DB writes — each checked for `{ error }` and thrown
3. Commit local state on success
4. All wrapped in `try { ... } catch (err) { ... }`
5. On error: `console.error` + `alert` + refund the optimistic deduct + reset the loading flag

See `Buildings.jsx#handleUpgrade`, `Research.jsx#handleResearch`, `Shipyard.jsx#handleBuild`, `Fleet.jsx#handleSend` for the canonical shape.

### Idempotent completers
- Building / research completion bodies guard the DB UPDATE with `.eq('is_upgrading', true)` / `.eq('is_researching', true)` and the local-state map with the matching prev-row check.
- A 2s interval completer (`TICK.COMPLETION_POLL_MS`) on Buildings + Research pages is the safety net for missed `setTimeout`s (tab throttled, page reloaded, dev-speed change).
- This means the original `setTimeout` and the interval can both fire on the same row without double-incrementing — one wins, the other no-ops.

### Multi-planet
- Pages take both `planet` (active, single) and `planets` (all owned).
- Active planet's data is live; other planets are fetched on demand (e.g., Research's planet picker polls every 5s).
- **Research is account-wide** — keyed by `owner_id`, not `planet_id`. One research at a time across all planets.

### Player isolation
Each player has their own UI-facing rows (notifications, combat reports, espionage reports). Never share a single row between two players. Game-state mutations (combat resolution, plundering, debris) ARE allowed to cross players — that's gameplay.

---

## Drift alert — do this on every session

While working on any task, if you notice:
- An **inline game-data list** (TECH_TREE / SHIPS / BUILDINGS / type-string array) in a page or component
- A **magic-number** `setInterval` / `setTimeout` (raw ms instead of `TICK.X`)
- `supabase.from(...)` **outside** `src/services/`
- Inline **resource arithmetic** (`metal: x.metal - cost.metal`) outside `src/services/resources.js`
- `console.log` / `console.debug` in committed code (`console.error` in catch blocks is fine)
- A **stranded** `import { supabase }` with 0 usages in the file
- A **user-action handler without try/catch**

→ **Mention it in your response, one line per finding, file:line.**

Do NOT sweep-refactor. The user can invoke `/cleanup` for that. Drift alerts surface, they don't auto-fix.

---

## What NOT to do without explicit ask

- Sweep-refactor across the codebase ("make it more professional", "improve everything")
- Replace polling with Supabase realtime subscriptions wholesale
- Add caching layers (SWR / React Query / custom stale-while-revalidate)
- Run `git push`, `git commit`, or open PRs (the user runs these themselves)
- Run SQL mutations against the DB (read-only Management API queries don't need approval; mutations do)

---

## SQL specifics

- 14 functions, 15 tables, 56 RLS policies, 14 non-pkey indexes (counts at the cleanup pass — may drift)
- **SQL functions live in the DB, not in git.** Before replacing one, capture the current body for rollback:
  ```sql
  SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = '<name>';
  ```
- Big three: `process_arrived_fleets`, `process_combat`, `process_espionage`. Plus `claim_starting_planet`, `restock_npc_resources`, `update_last_online`, `seed_npc_planets`, etc.
- Local backups go in `backups/<date>-<purpose>.sql` — gitignored.
- Project ref: `zkiyudegrnmeisiemqyd`. Management API token in `.mcp.json` (gitignored).
- Read-only queries via `curl` to `https://api.supabase.com/v1/projects/<ref>/database/query` are fine without permission. Mutations (CREATE / ALTER / DROP / UPDATE / INSERT / DELETE) need the user's explicit OK.

---

## Workflow

- New work: branch off master as `claude/<feature-name>` or `claude/cleanup-<n>`. Each commit independently testable.
- Dev server runs on the main checkout; switch its branch with `git checkout` to test a different version. HMR rebuilds.
- Before any sweeping change: tag master (`git tag -a backup/<date> -m '...'`) and dump SQL state to `backups/<date>.sql`.
- The user commits, pushes, and opens PRs themselves unless they explicitly say otherwise.
- Restore points exist for the cleanup pass: tag `backup/pre-cleanup-2026-04-26` + `backups/2026-04-26-pre-cleanup.sql`.

## Commands

- `npm run dev` — Vite dev server (HMR; serves whichever branch is checked out)
- `npm run build` — production build
- `npm run lint` — ESLint
