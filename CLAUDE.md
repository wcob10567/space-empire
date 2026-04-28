# Space Empire — Project Conventions

OGame-like browser strategy game. Vite + React 19 + Supabase (Postgres + auth + RLS) + Tailwind 4. Universe is 5 galaxies × 499 systems × 15 positions. Solo developer.

This file is auto-loaded at the start of every Claude Code session. Read it. Follow it. The conventions here describe what the codebase **is** today; they exist so we don't have to keep cleaning up.

---

## Where things go

### `src/data/` — all static game data
- `techTree.js` — `TECH_TREE` + derived `TECH_TYPES`, `TECH_BY_TYPE`, `TECH_BRANCHES`
- `ships.js` — `SHIPS`, `DEFENSES`, plus derived `SHIP_TYPES`, `SHIP_BY_TYPE`, `DEFENSE_BY_TYPE`, `SHIP_STATS`, `SHIPYARD_CATEGORIES`
- `buildings.js` — `BUILDINGS`, `ALL_BUILDING_TYPES`, `STARTING_BUILDING_TYPES`, `BUILDING_CATEGORIES`, `BUILDING_BY_TYPE`
- `queueSlots.js` — `BUILDING_SLOT_TIERS`, `SHIP_SLOT_TIERS`, `RESEARCH_SLOT_TIERS` + helpers `countEarnedFreeSlots`, `nextFreeTier`
- `defaults.js` — `DEFAULT_RESOURCES`, `PLANET_GEN`

**Never inline these lists in a page or component.** If you need a tech / ship / building / slot reference, import from `src/data/`.

### `src/config/tick.js` — every polling / refresh / animation interval
Named constants, no raw millisecond literals in `setInterval` / `setTimeout` outside this file.

### `src/services/` — every supabase write + read
- `queries.js` — every read (`queries.X(id)` everywhere; inline `supabase.from(...).select(...)` is reserved for this file)
- `resources.js` — `debitResources(planetId, currentResources, cost)` and `creditResources` for resource math; never `metal: prev.metal - cost.metal` ad-hoc
- `buildQueue.js` / `shipQueue.js` / `researchQueue.js` — same shape: `addToX / cancelX / sumXReservation`. New positions = `max(existing) + 1`.
- `completion.js` — `completeBuildingUpgrade(id, level)`, `completeResearchTech(id, level)`. Idempotent UPDATE-with-flag-guard writes (replaces the inline supabase calls that used to live in pages)

### `src/utils/` — pure helpers
- `format.js` — `formatTime(seconds)`
- `formulas.js` — `scaleCost(baseCost, multiplier, level)` (replaces per-page cost calcs), `computeDuration({ cost, divisor, factor, minSeconds, applyDevSpeed })` (replaces per-page time calcs)

### `src/hooks/`
- `useCompletionPoll.js` — generic 2s poll for `is_upgrading` / `is_researching` rows. Buildings matches by `id`, Research by `tech_type`.

### `src/components/`
- `QueuePanel.jsx` — combined queue list + slot pills + cancel + buy button. Used by Buildings, Shipyard, Research. Single source of truth for queue UI.
- `GameLayout.jsx`, `DevPanel.jsx`, `Notifications.jsx`, `RenamePlanet.jsx`

### Allowed direct supabase imports
- `src/lib/supabase.js` — defines the client
- `src/context/AuthContext.jsx` — `supabase.auth.*` for sign in/up/out
- `src/components/Notifications.jsx` — `supabase.removeChannel` for realtime cleanup
- `src/services/*` — service layer (queries, resources, completion, queue services)

Anywhere else, `supabase.*` is a smell. Use the service layer.

### Pages, context
- `src/pages/` — top-level routes (Buildings, Research, Shipyard, Fleet, Galaxy, Reports, Overview, Login)
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

See `Buildings.jsx#handleQueue`, `Research.jsx#handleQueue`, `Shipyard.jsx#handleQueue`, `Fleet.jsx#handleSend` for the canonical shape.

### Idempotent completers
- Building / research completion bodies guard the DB UPDATE with `.eq('is_upgrading', true)` / `.eq('is_researching', true)`.
- The `useCompletionPoll` hook on Buildings + Research pages is the safety net for missed `setTimeout`s (tab throttled, page reloaded, dev-speed change).
- This means the original `setTimeout` and the interval can both fire on the same row without double-incrementing — one wins, the other no-ops.

### Queues (build / ship / research)
- All three follow the same shape: DB-backed table, `process_X_queue()` SQL function on the 3s tick, `<QueuePanel>` UI, slot tier system in `data/queueSlots.js`, reservation memo in App.jsx.
- Reservation = sum of queue costs. `available = balance − reservation`. Balance only deducts when a row becomes head AND can be funded. Cancel is free.
- `build_seconds` is snapshotted at queue time. Post-queue speedups (Robotics/Nanite upgrades) don't apply retroactively.
- Building & ship queues are per-planet. Research queue is account-wide (`owner_id`); each row stores `source_planet_id` so the processor knows which planet to debit.

### Multi-planet
- Pages take both `planet` (active, single) and `planets` (all owned).
- Active planet's data is live; other planets are fetched on demand (e.g., Research's planet picker polls every 5s).

### Player isolation
Each player has their own UI-facing rows (notifications, combat reports, espionage reports). Never share a single row between two players. Game-state mutations (combat resolution, plundering, debris) ARE allowed to cross players — that's gameplay.

---

## Drift alert — do this on every session

While working on any task, if you notice:
- An **inline game-data list** (TECH_TREE / SHIPS / BUILDINGS / type-string array) in a page or component
- A **magic-number** `setInterval` / `setTimeout` (raw ms instead of `TICK.X`)
- `supabase.from(...)` **outside** `src/services/`
- Inline **resource arithmetic** (`metal: x.metal - cost.metal`) outside `src/services/resources.js`
- Inline **cost or time formula** (e.g. `Math.pow(1.5, level)`) outside `src/utils/formulas.js`
- A **duplicated `formatTime`** instead of importing from `src/utils/format.js`
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
- Run `git commit`, `git push`, or open PRs
- Run SQL mutations against the DB (read-only Management API queries don't need approval; mutations do)

### What "explicit ask" actually means

**Explicit = the user typed a word that clearly authorizes the action.** Examples that count: "push", "go", "yes run it", "commit", "open a PR", "run the migration". Examples that DO NOT count:
- "ok let me make the others" — ambiguous; might mean "yes proceed with the DB migration" or "let's plan the next pages"
- "sounds good" / "fine" / continued conversation that implies approval
- The user being engaged with the design discussion

When in doubt, ask with a one-line confirm: *"OK to run X?"*. Auto mode does **not** override this — auto mode lets you act without confirming routine read-only or file-edit work, but mutations to shared systems (DB / git remote) still need a clear word.

---

## SQL specifics

- ~16 functions, ~17 tables, 56+ RLS policies (counts drift; check with `information_schema` / `pg_proc` if you need exact numbers).
- **SQL functions live in the DB, not in git.** Before replacing one, capture the current body for rollback:
  ```sql
  SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = '<name>';
  ```
- The big six processors (called from App.jsx 3s tick): `process_arrived_fleets`, `process_combat`, `process_espionage`, `process_building_queue`, `process_ship_queue`, `process_research_queue`.
- Other functions: `claim_starting_planet`, `restock_npc_resources`, `update_last_online`, `seed_npc_planets`, etc.
- Local backups go in `backups/<date>-<purpose>.sql` — gitignored.
- Project ref: `zkiyudegrnmeisiemqyd`. Management API token in `.mcp.json` (gitignored).
- Read-only queries via `curl` to `https://api.supabase.com/v1/projects/<ref>/database/query` are fine without permission. Mutations (CREATE / ALTER / DROP / UPDATE / INSERT / DELETE) need the user's explicit OK.

---

## Workflow

### Branching
- New work: branch off master as `claude/<feature-name>` or `claude/cleanup-<n>`.
- Each commit independently testable.
- The user commits, pushes, and opens PRs themselves unless they explicitly say otherwise (see "What 'explicit ask' actually means" above).

### Worktree / dev server quirks (cause of most confusion)

**Two checkouts** of this repo can exist side by side:
- Main: `C:\Users\wcob1\Desktop\Projects\space-empire`
- Worktrees: `.claude/worktrees/<name>/` — git worktree clones, each on its own branch

**A branch can only be checked out in ONE location at a time.** If a worktree owns `claude/foo`, the main checkout can't `git checkout claude/foo` until the worktree is moved or removed.

**Where dev runs determines what's served:**
- `npm run dev` from the main checkout → serves whatever branch the main is on
- `npm run dev` from a worktree → serves that worktree's branch

When testing a freshly-merged PR, **the main checkout doesn't auto-update**. If main is still on the feature branch, run `git checkout master && git pull` in main, then restart dev. Or just keep dev running from the worktree.

**Fresh worktrees need setup:**
- `.env` is gitignored. With no `.env`, Supabase throws "supabaseUrl is required" → white page. Copy from main: `cp ../../../.env .env`.
- `node_modules` is gitignored. Run `npm install` once.

**Both main and worktree hit the same Supabase project** (`zkiyudegrnmeisiemqyd`) — there's only one DB.

### `gh` CLI auth state

`gh` is on the PowerShell PATH (not Bash) and is **not authenticated by default**. Symptoms: `gh` commands exit with code 4 and "please run gh auth login". `gh auth login` is interactive and won't run in this tool's non-interactive shell.

Workarounds:
- **Reading public PRs / branches**: `curl https://api.github.com/repos/wcob10567/space-empire/...` works without auth. Use this to find PR URLs, check merge state, etc.
- **Writes (`gh pr create`)**: ask the user to run `gh auth login` once, or fall back to: push the branch, copy the PR body to clipboard with `Set-Clipboard`, open the suggested URL with `Start-Process`, ask user to paste & click Create.

### Backups before sweeping changes
- Tag master: `git tag -a backup/<date>-<purpose> -m '...'`
- Dump SQL state to `backups/<date>-<purpose>.sql` (curl to Management API)
- Both are restore points if a refactor / migration goes sideways.

---

## Commands

- `npm run dev` — Vite dev server (HMR; serves whichever branch is checked out in this directory)
- `npm run build` — production build (also catches compile errors not visible in dev)
- `npm run lint` — ESLint (0 errors required; warnings are drift markers, see "Drift alert")
