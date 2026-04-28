// DB writes for completion polling. The 2s interval poll on Buildings.jsx
// and Research.jsx used to call `supabase.from(...)` inline (CLAUDE.md
// drift); centralizing here keeps pages clean and gives one place to change
// the idempotency guard.
//
// Each completer is idempotent: the `.eq(flag, true)` clause makes a stale
// fire (e.g. setTimeout that beats the interval poll) a no-op rather than
// a double-increment.

import { supabase } from '../lib/supabase'

/**
 * Bump a building to its next level if it's still flagged as upgrading.
 * Returns true on success, false if already completed or errored.
 */
export async function completeBuildingUpgrade(id, currentLevel) {
  const { error } = await supabase.from('buildings').update({
    level: currentLevel + 1,
    is_upgrading: false,
    upgrade_complete_at: null,
  })
    .eq('id', id)
    .eq('is_upgrading', true)
  return !error
}

/**
 * Bump a research row to its next level if it's still flagged as researching.
 * Returns true on success, false if already completed or errored.
 */
export async function completeResearchTech(id, currentLevel) {
  const { error } = await supabase.from('research').update({
    level: currentLevel + 1,
    is_researching: false,
    research_complete_at: null,
  })
    .eq('id', id)
    .eq('is_researching', true)
  return !error
}
