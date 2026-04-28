// Generic 2s completion poll. The same loop existed in Buildings.jsx and
// Research.jsx: scan local state for items whose timer has expired, call
// the DB completer, optimistically bump the row's level locally.
//
// Caller passes the items array, which keys identify the in-flight state,
// the completer (DB write), and a function that produces the next-level
// updated row for setItems.
//
// Why a poll at all? `setTimeout` is unreliable across tab throttling, dev
// speed-up changes, and page reloads; the poll is the safety net that
// guarantees a stuck "finishing..." state self-resolves within 2s.

import { useEffect } from 'react'
import { TICK } from '../config/tick'

/**
 * @param {{
 *   items: Array,                          // local state to scan
 *   setItems: (updater) => void,           // local state setter
 *   flagKey: string,                       // e.g. 'is_upgrading'
 *   completeAtKey: string,                 // e.g. 'upgrade_complete_at'
 *   complete: (id, level) => Promise<bool>,// DB writer; returns success
 *   matchKey?: string,                     // local-state guard: which field to match for setItems update; defaults to 'id'
 * }} options
 */
export function useCompletionPoll({ items, setItems, flagKey, completeAtKey, complete, matchKey = 'id' }) {
  useEffect(() => {
    let cancelled = false
    async function checkCompleted() {
      if (cancelled || !items?.length) return
      const now = new Date()
      const expired = items.filter(
        x => x[flagKey] && x[completeAtKey] && new Date(x[completeAtKey]) <= now
      )
      for (const item of expired) {
        if (cancelled) return
        const ok = await complete(item.id, item.level ?? 0)
        if (!ok) continue
        setItems(prev => prev.map(p =>
          p[matchKey] === item[matchKey] && p[flagKey]
            ? { ...p, level: (p.level ?? 0) + 1, [flagKey]: false, [completeAtKey]: null }
            : p
        ))
      }
    }
    checkCompleted()
    const interval = setInterval(checkCompleted, TICK.COMPLETION_POLL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [items, setItems, flagKey, completeAtKey, complete, matchKey])
}
