import { useState } from 'react'
import { Rocket, Lock, AlertTriangle, Plus, Minus } from 'lucide-react'
import { SHIPS, DEFENSES, SHIPYARD_CATEGORIES as CATEGORIES, SHIP_BY_TYPE, DEFENSE_BY_TYPE } from '../data/ships'
import { addToShipQueue, cancelShipQueue } from '../services/shipQueue'
import { SHIP_SLOT_TIERS, countEarnedFreeSlots } from '../data/queueSlots'
import { formatTime } from '../utils/format'
import { computeDuration } from '../utils/formulas'
import QueuePanel from '../components/QueuePanel'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getBuildTimePerShip = (cost, shipyardLvl, naniteLvl) => computeDuration({
  cost,
  divisor: 2500,
  factor: Math.max(1, shipyardLvl) * Math.pow(2, naniteLvl ?? 0),
  applyDevSpeed: true,
})

function getBlocker(item, researchMap, shipyardLvl, available, qty) {
  if (shipyardLvl < (item.requires.shipyard ?? 0)) {
    return { type: 'building', msg: `Need Shipyard Lv. ${item.requires.shipyard}` }
  }
  for (const [reqType, reqLvl] of Object.entries(item.prereqs)) {
    const have = researchMap[reqType] ?? 0
    if (have < reqLvl) {
      const allItems = [...SHIPS, ...DEFENSES]
      const name = allItems.find(s => s.type === reqType)?.name ?? reqType
      return { type: 'research', msg: `Need ${name} Lv. ${reqLvl}` }
    }
  }
  const totalCost = {
    metal:     item.cost.metal * qty,
    crystal:   item.cost.crystal * qty,
    deuterium: (item.cost.deuterium ?? 0) * qty,
  }
  const missing = []
  if (totalCost.metal     > (available?.metal     ?? 0)) missing.push(`${(totalCost.metal     - (available?.metal     ?? 0)).toLocaleString()} metal`)
  if (totalCost.crystal   > (available?.crystal   ?? 0)) missing.push(`${(totalCost.crystal   - (available?.crystal   ?? 0)).toLocaleString()} crystal`)
  if (totalCost.deuterium > (available?.deuterium ?? 0)) missing.push(`${(totalCost.deuterium - (available?.deuterium ?? 0)).toLocaleString()} deuterium`)
  if (missing.length > 0) return { type: 'resources', msg: `Need ${missing[0]} more` }
  return null
}

// Resolve an item's metadata from either ships or defenses
function metaFor(type) {
  return SHIP_BY_TYPE[type] ?? DEFENSE_BY_TYPE[type] ?? null
}

// ─── Item Card ────────────────────────────────────────────────────────────────
function ItemCard({ item, quantity, available, researchMap, shipyardLvl, naniteLvl, onQueue, slotsFull, submitting }) {
  const [qty, setQty] = useState(1)
  const blocker = getBlocker(item, researchMap, shipyardLvl, available, qty)
  const isLocked = blocker?.type === 'building' || blocker?.type === 'research'
  const isAlmostReady = blocker?.type === 'resources'
  const isAffordable = !blocker
  const buildTimePerShip = getBuildTimePerShip(item.cost, shipyardLvl, naniteLvl)
  const buttonDisabled = !isAffordable || slotsFull || submitting

  return (
    <div className={`bg-gray-900 border rounded-xl p-4 transition-all ${
      isLocked      ? 'border-gray-800 opacity-60' :
      isAlmostReady ? 'border-yellow-800' :
                      'border-gray-800 hover:border-gray-700'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{item.icon}</span>
          <div>
            <h3 className={`font-semibold text-sm ${isLocked ? 'text-gray-500' : 'text-white'}`}>
              {item.name}
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">{item.description}</p>
          </div>
        </div>
        {quantity > 0 && (
          <div className="text-right shrink-0">
            <span className="text-xs text-gray-500">Owned</span>
            <p className="text-lg font-bold text-cyan-400">{quantity}</p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
        {item.stats.attack > 0 && <span>⚔️ {item.stats.attack.toLocaleString()}</span>}
        {item.stats.shield > 0 && <span>🛡️ {item.stats.shield.toLocaleString()}</span>}
        <span>❤️ {item.stats.hull.toLocaleString()}</span>
        {item.stats.speed && <span>💨 {item.stats.speed.toLocaleString()}</span>}
        {item.stats.cargo && <span>📦 {item.stats.cargo.toLocaleString()}</span>}
      </div>

      {isLocked ? (
        <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-2">
          <Lock size={12} className="text-gray-600 shrink-0" />
          <span className="text-gray-600 text-xs">{blocker?.msg}</span>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Cost (red if insufficient `available`) */}
          <div className="flex flex-wrap gap-2 text-xs">
            {item.cost.metal > 0 && (
              <span className={(item.cost.metal * qty) > (available?.metal ?? 0) ? 'text-red-400' : 'text-gray-400'}>
                ⛏️ {(item.cost.metal * qty).toLocaleString()}
              </span>
            )}
            {item.cost.crystal > 0 && (
              <span className={(item.cost.crystal * qty) > (available?.crystal ?? 0) ? 'text-red-400' : 'text-gray-400'}>
                💎 {(item.cost.crystal * qty).toLocaleString()}
              </span>
            )}
            {item.cost.deuterium > 0 && (
              <span className={(item.cost.deuterium * qty) > (available?.deuterium ?? 0) ? 'text-red-400' : 'text-gray-400'}>
                🔵 {(item.cost.deuterium * qty).toLocaleString()}
              </span>
            )}
            <span className="text-gray-600 ml-auto">⏱ {formatTime(buildTimePerShip * qty)}</span>
          </div>

          {/* Almost-ready warning */}
          {isAlmostReady && (
            <div className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-2">
              <AlertTriangle size={12} className="text-yellow-500 shrink-0" />
              <span className="text-yellow-500 text-xs">{blocker?.msg}</span>
            </div>
          )}

          {/* Quantity selector */}
          <div className="flex items-center gap-2">
            <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-7 h-7 rounded bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400">
              <Minus size={12} />
            </button>
            <input
              type="number"
              min={1}
              max={999}
              value={qty}
              onChange={e => setQty(Math.max(1, Math.min(999, parseInt(e.target.value) || 1)))}
              className="flex-1 bg-gray-800 text-white text-center text-sm rounded px-2 py-1 w-16"
            />
            <button onClick={() => setQty(q => Math.min(999, q + 1))} className="w-7 h-7 rounded bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400">
              <Plus size={12} />
            </button>
          </div>

          {/* Queue button (was "Build" — same flow now goes through ship_queue) */}
          <button
            onClick={() => onQueue(item, qty, buildTimePerShip)}
            disabled={buttonDisabled}
            title={
              slotsFull       ? 'Ship queue is full' :
              !isAffordable   ? 'Not enough available resources (after pending reservations)' :
              undefined
            }
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              !buttonDisabled
                ? 'bg-cyan-700 hover:bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            <Rocket size={14} />
            Queue {qty > 1 ? `x${qty}` : ''}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Shipyard Page ───────────────────────────────────────────────────────
export default function Shipyard({
  planet, resources, buildings, research, ships,
  shipQueue, setShipQueue, reservation,
}) {
  const [submitting, setSubmitting] = useState(false)

  const shipyardLvl = buildings?.find(b => b.building_type === 'shipyard')?.level ?? 0
  const naniteLvl   = buildings?.find(b => b.building_type === 'nanite_factory')?.level ?? 0
  const roboticsLvl = buildings?.find(b => b.building_type === 'robotics_factory')?.level ?? 0

  const researchMap = {}
  research?.forEach(r => { researchMap[r.tech_type] = r.level })

  const shipMap = {}
  ships?.forEach(s => { shipMap[s.ship_type] = s.quantity })

  // Slots: in-flight = the row that has started_at set (i.e. been pulled to head),
  // queued = waiting rows with started_at null.
  const inFlightRow = shipQueue?.find(q => q.started_at) ?? null
  const queuedRows  = shipQueue?.filter(q => !q.started_at) ?? []
  const maxSlots    = countEarnedFreeSlots(SHIP_SLOT_TIERS, { shipyard: shipyardLvl, robotics: roboticsLvl })
  const slotsUsed   = (inFlightRow ? 1 : 0) + queuedRows.length
  const slotsFull   = slotsUsed >= maxSlots

  const available = {
    metal:     (resources?.metal     ?? 0) - (reservation?.metal     ?? 0),
    crystal:   (resources?.crystal   ?? 0) - (reservation?.crystal   ?? 0),
    deuterium: (resources?.deuterium ?? 0) - (reservation?.deuterium ?? 0),
  }

  async function handleQueue(item, qty, buildSecondsPerShip) {
    if (!planet || submitting) return
    if (slotsFull) return

    const cost = {
      metal:     item.cost.metal * qty,
      crystal:   item.cost.crystal * qty,
      deuterium: (item.cost.deuterium ?? 0) * qty,
    }

    setSubmitting(true)
    try {
      const row = await addToShipQueue({
        planetId: planet.id,
        shipType: item.type,
        qty,
        cost,
        buildSecondsPerShip,
      })
      setShipQueue(prev => [...prev, row])
    } catch (err) {
      console.error('Add to ship queue failed:', err)
      alert(`Couldn't queue: ${err.message ?? 'unknown error'}.`)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(queueRowId) {
    if (submitting) return
    setSubmitting(true)
    try {
      await cancelShipQueue(queueRowId)
      setShipQueue(prev => prev.filter(q => q.id !== queueRowId))
    } catch (err) {
      console.error('Cancel ship queue failed:', err)
      alert(`Couldn't cancel: ${err.message ?? 'unknown error'}.`)
    } finally {
      setSubmitting(false)
    }
  }

  // In-flight item label for QueuePanel: e.g. "Light Fighter · 12 / 50"
  const inFlight = (() => {
    if (!inFlightRow) return null
    const meta = metaFor(inFlightRow.ship_type)
    const completed = inFlightRow.ships_completed ?? 0
    const total = inFlightRow.qty
    // completeAt = started_at + (total × per-ship). Stored values in DB are
    // canonical; we don't have the per-ship time on the row directly here so
    // we rely on the DB/processor to tick ships_completed up. The countdown
    // shown is the time to NEXT ship (best UX while sequential ships pop out).
    const startedMs = new Date(inFlightRow.started_at).getTime()
    const nextShipMs = startedMs + (completed + 1) * inFlightRow.build_seconds_per_ship * 1000
    return {
      icon: meta?.icon ?? '🚀',
      label: `${meta?.name ?? inFlightRow.ship_type} · ${completed} / ${total}`,
      completeAt: new Date(nextShipMs).toISOString(),
    }
  })()

  const queue = queuedRows.map(q => {
    const meta = metaFor(q.ship_type)
    return {
      id: q.id,
      icon: meta?.icon ?? '🚀',
      label: `${meta?.name ?? q.ship_type} × ${q.qty}`,
      duration: q.build_seconds_per_ship * q.qty,
      cost: { metal: q.cost_metal, crystal: q.cost_crystal, deuterium: q.cost_deuterium },
    }
  })

  const allItems = [...SHIPS, ...DEFENSES]

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-3 flex-wrap">
        <Rocket size={20} className="text-cyan-400" />
        <h2 className="text-xl font-bold text-white">Shipyard</h2>
        <span className="text-xs text-gray-500">Shipyard Lv. {shipyardLvl}</span>
        {inFlightRow && (
          <span className="text-xs bg-cyan-900/50 border border-cyan-700 text-cyan-400 px-2 py-1 rounded-full">
            1 building
          </span>
        )}
        {slotsFull && (
          <span className="text-xs bg-yellow-900/50 border border-yellow-800 text-yellow-400 px-2 py-1 rounded-full">
            queue full
          </span>
        )}
      </div>

      <QueuePanel
        title="Ship queue"
        inFlight={inFlight}
        queue={queue}
        slotInfo={{
          tiers: SHIP_SLOT_TIERS,
          levels: { shipyard: shipyardLvl, robotics: roboticsLvl },
          boughtSlots: 0,
          used: slotsUsed,
        }}
        onCancel={handleCancel}
        submitting={submitting}
      />

      {shipyardLvl === 0 && (
        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-yellow-500 shrink-0" />
          <p className="text-yellow-400 text-sm">You need to build a <span className="font-semibold">Shipyard</span> before you can construct ships or defenses.</p>
        </div>
      )}

      {CATEGORIES.map(cat => (
        <div key={cat}>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-widest">{cat}</h3>
            <div className="flex-1 h-px bg-cyan-900/40" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {allItems.filter(i => i.category === cat).map(item => (
              <ItemCard
                key={item.type}
                item={item}
                quantity={shipMap[item.type] ?? 0}
                available={available}
                researchMap={researchMap}
                shipyardLvl={shipyardLvl}
                naniteLvl={naniteLvl}
                onQueue={handleQueue}
                slotsFull={slotsFull}
                submitting={submitting}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
