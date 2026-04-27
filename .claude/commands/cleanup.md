# /cleanup — targeted cleanup audit

A deliberate, scoped cleanup pass against the conventions in `CLAUDE.md`. This is **invoked on demand**. It is NOT something to do on every session — that's the drift-alert in `CLAUDE.md`'s job.

## Approach

1. **Read `CLAUDE.md`** first to refresh on the project's conventions.
2. **Run `npm run lint`** and capture the warning counts by rule. The lint warnings are the primary drift signal — `no-restricted-syntax`, `no-unused-vars`, `react-hooks/exhaustive-deps`. Those are your starting list.
3. **Survey for things lint can't catch:**
   - Inline game-data lists in pages/components (TECH_TREE, SHIPS, BUILDINGS, type arrays) — should live in `src/data/`
   - Magic-number `setInterval` / `setTimeout` durations — should be `TICK.X` from `src/config/tick.js`
   - User-action handlers without `try/catch` (refer to `Buildings.jsx#handleUpgrade` for the canonical shape)
   - Resource arithmetic outside `src/services/resources.js`
   - Stranded `import { supabase }` (these will already show as `'supabase' is not defined` errors if truly stranded)
4. **Produce a punch list — do NOT touch code yet.** Each item:
   - File:line
   - Severity (clearly broken / inconsistent / cosmetic)
   - Estimated risk (e.g., "low — drop-in import", "medium — touches user-action flow")
5. **Ask the user which items to fix.** Don't assume "all of them".
6. **For each agreed item:**
   - Before any change: tag master and dump the SQL state if SQL is involved (`git tag backup/pre-cleanup-<date>`, `backups/<date>-<purpose>.sql` — local SQL is gitignored)
   - Work on a fresh branch: `claude/cleanup-<YYYY-MM-DD>` or similar
   - Make the smallest safe change
   - Run `npm run lint` — fix any new warnings before committing
   - Commit with a clear, scoped message
   - Move to the next item

## Hard rules

- **Match the user's preferences** in their memory and `CLAUDE.md`, not generic best-practice prompts. Past instances of generic prompts have suggested replacing polling with realtime / adding SWR caching / refactoring everything in one commit — those are the wrong move for this codebase. We've already pushed back on them once. Don't re-suggest them.
- **Never replace polling with Supabase realtime subscriptions wholesale.** The current 3-5s polling is correct for current scale. Realtime becomes worth the complexity at ≥10 active players in a universe.
- **Never add caching layers** (SWR, React Query, custom stale-while-revalidate) without an explicit ask and a concrete pain point.
- **Never sweep-refactor** across the whole codebase in one commit. Each commit should be independently revertable.
- **Don't run `git push`, `git commit`, or open PRs** without explicit user OK.
- **Don't run SQL mutations** without explicit OK. Read-only Management API queries (`SELECT pg_get_functiondef`, `SELECT count(*) FROM ...`) are fine.
- The user pastes complete code in chat freely — that's their preference. Edit-tool changes are still preferred for surgical work, but don't refuse to show full code in the response when it's helpful.

## What this command is NOT for

- New feature work — use a normal prompt and the user's roadmap
- One-off bug fixes — use a normal prompt
- "Make it more professional" / "modernize the codebase" generic-vibes refactors — those produce churn without clear value. If the user invokes /cleanup, treat the lint warnings + the file-line punch list as the scope, not "make every file better".

## Reference

- The first cleanup pass on this codebase was 5 commits on `claude/cleanup-pass-1` (2026-04-26): shared infra → drop inlines → apply services → error handling → dev-tool live updates. ~120 net lines removed; service layer + named tick constants + try/catch on user actions are baseline now. Don't re-do that work; surface only NEW drift.
- Restore points if anything goes wrong: `git tag backup/pre-cleanup-2026-04-26` (code) + `backups/2026-04-26-pre-cleanup.sql` (DB schema dump).
