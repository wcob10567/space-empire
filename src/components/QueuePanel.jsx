// Combined queue + slot-progression panel. Used by Buildings, Shipyard, and
// Research so the three queue pages share one consistent UI:
//
//   ┌─ <title> · X / Y slots in use ─────────────────────────────────────┐
//   │ ⏳ Building now: <inFlight.label> · <countdown>                    │
//   │ #1  <queue[0].label> · <duration>  <costs>            [Cancel ✕]   │
//   │ #2  <queue[1].label> · <duration>  <costs>            [Cancel ✕]   │
//   │ ──────────────────────────────────────────────────────────────────  │
//   │ Slots: <unlocked> / <max>                                           │
//   │ ✓ #1 Always   ✓ #2 Robotics 4   ✓ #3 Robotics 8   🔒 #4–7 Tokens   │
//   │ [ Buy next slot — 1 Rush Token (soon) ]                             │
//   └─────────────────────────────────────────────────────────────────────┘
//
// In-flight items can't be cancelled (build is already underway, resources
// already deducted). Queued items can — cancel refunds the reservation.
//
// `tiers` + `levels` come from src/data/queueSlots.js. `boughtSlots` is the
// per-player counter for paid slots (0 today; grows when Rush Tokens ship).

import { useEffect, useState } from 'react'
import { Clock, ListOrdered, X, Lock, Coins } from 'lucide-react'
import { formatTime } from '../utils/format'
import { countEarnedFreeSlots, nextFreeTier } from '../data/queueSlots'

function CountdownText({ completeAt, fallback = '...' }) {
  const [secs, setSecs] = useState(() => secsUntil(completeAt))
  useEffect(() => {
    if (!completeAt) return
    const id = setInterval(() => setSecs(secsUntil(completeAt)), 1000)
    return () => clearInterval(id)
  }, [completeAt])
  if (!completeAt) return fallback
  return formatTime(secs)
}

function secsUntil(completeAt) {
  if (!completeAt) return 0
  return Math.max(0, Math.floor((new Date(completeAt) - Date.now()) / 1000))
}

export default function QueuePanel({
  title = 'Build queue',
  inFlight,        // { icon, label, completeAt } or null
  queue,           // [{ id, icon, label, duration, cost: {metal,crystal,deuterium} }, ...]
  slotInfo,        // { tiers, levels, boughtSlots, used }
  onCancel,        // (queueRowId) => void
  submitting,
}) {
  const tiers = slotInfo?.tiers ?? []
  const levels = slotInfo?.levels ?? {}
  const bought = slotInfo?.boughtSlots ?? 0
  const used = slotInfo?.used ?? 0

  const earnedFree = countEarnedFreeSlots(tiers, levels)
  const paidTierCount = tiers.filter(t => t.paid).length
  const unlocked = Math.min(earnedFree + bought, tiers.length)
  const canBuyMore = bought < paidTierCount
  const queuedCount = queue?.length ?? 0
  const showEmpty = !inFlight && queuedCount === 0

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <ListOrdered size={14} className="text-cyan-400" />
        <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">
          {title}
        </span>
        <span className="text-xs text-gray-500">
          {used} / {unlocked} slots in use
        </span>
      </div>

      {/* In-flight item */}
      {inFlight && (
        <div className="flex items-center gap-3 bg-cyan-950/50 border border-cyan-800 rounded-lg px-3 py-2 text-xs">
          <Clock size={14} className="text-cyan-400 animate-pulse shrink-0" />
          <span className="text-base">{inFlight.icon}</span>
          <span className="text-white flex-1 truncate">
            {inFlight.label}
          </span>
          <span className="text-cyan-300 font-mono">
            <CountdownText completeAt={inFlight.completeAt} fallback="Finishing..." />
          </span>
        </div>
      )}

      {/* Queued items */}
      {queue?.map((q, i) => (
        <div
          key={q.id}
          className="flex items-center gap-3 bg-gray-800/60 border border-gray-800 rounded-lg px-3 py-2 text-xs"
        >
          <span className="text-gray-500 font-mono w-5 text-right shrink-0">#{i + 1}</span>
          <span className="text-base shrink-0">{q.icon ?? '🏗️'}</span>
          <span className="text-white flex-1 truncate">
            {q.label} <span className="text-gray-500">·</span> {formatTime(q.duration)}
          </span>
          <span className="text-gray-500 hidden md:inline shrink-0">
            {q.cost?.metal     > 0 && <>⛏️ {q.cost.metal.toLocaleString()} </>}
            {q.cost?.crystal   > 0 && <>💎 {q.cost.crystal.toLocaleString()} </>}
            {q.cost?.deuterium > 0 && <>🔵 {q.cost.deuterium.toLocaleString()}</>}
          </span>
          <button
            onClick={() => onCancel?.(q.id)}
            disabled={submitting}
            className="flex items-center gap-1 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-gray-400 hover:bg-red-950/40 hover:border-red-900 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Cancel — refunds the reservation"
          >
            <X size={12} />
            <span>Cancel</span>
          </button>
        </div>
      ))}

      {/* Empty state */}
      {showEmpty && (
        <p className="text-xs text-gray-500 px-1">Nothing queued.</p>
      )}

      {/* Slot progression */}
      <div className="border-t border-gray-800 pt-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">Slots</span>
          <span className="text-xs text-gray-500 ml-auto">
            {unlocked} / {tiers.length} unlocked
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {tiers.map((t, idx) => {
            const earnedFreeTier = !t.paid && t.check?.(levels)
            // For paid tiers: tier is "owned" if its index among paid tiers
            // is less than the bought count.
            const paidTierIndex = t.paid
              ? tiers.slice(0, idx).filter(x => x.paid).length
              : -1
            const ownedPaid = t.paid && paidTierIndex < bought
            const owned = earnedFreeTier || ownedPaid

            const pillClass = owned
              ? 'border-green-700/60 bg-green-950/30 text-green-300'
              : t.paid
                ? 'border-yellow-800/60 bg-gray-900 text-gray-400'
                : 'border-gray-700 bg-gray-900 text-gray-500'

            // Tooltip: tell the player what this slot is and how to unlock.
            const tooltip = owned
              ? `Slot ${t.slot} — unlocked (${t.requirement})`
              : t.paid
                ? `Slot ${t.slot} — Buy with 1 Rush Token (Rush Token economy coming soon)`
                : `Slot ${t.slot} — Unlocks at ${t.requirement}`

            return (
              <div
                key={t.slot}
                title={tooltip}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-mono ${pillClass}`}
              >
                <span>#{t.slot}</span>
                {owned ? (
                  <span className="text-green-400">✓</span>
                ) : t.paid ? (
                  <Coins size={11} className="text-yellow-500" />
                ) : (
                  <Lock size={11} className="text-gray-600" />
                )}
              </div>
            )
          })}
        </div>

        {/* Next-unlock hint. Picks the next free tier the player hasn't earned;
            falls back to the paid-token messaging once all free tiers are done. */}
        {(() => {
          const nextFree = nextFreeTier(tiers, levels)
          if (nextFree) {
            return (
              <p className="text-xs text-gray-500 mt-2">
                <span className="text-gray-600">Next slot unlocks at:</span>{' '}
                <span className="text-gray-300">{nextFree.requirement}</span>
              </p>
            )
          }
          if (canBuyMore) {
            return (
              <p className="text-xs text-gray-500 mt-2">
                <span className="text-gray-600">Next slot:</span>{' '}
                <span className="text-gray-300">Buy with 1 Rush Token</span>
                <span className="text-gray-600"> (Rush Token economy coming soon)</span>
              </p>
            )
          }
          return null
        })()}

        {/* Single buy-next button. Disabled until Rush Token economy ships. */}
        {canBuyMore && (
          <button
            disabled
            title="Rush Token economy isn't built yet"
            className="w-full mt-3 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-500 text-xs cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Coins size={12} className="text-yellow-600" />
            Buy next slot — 1 Rush Token (soon)
          </button>
        )}
      </div>
    </div>
  )
}
