import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Building2, Clock, ChevronUp, Zap, X, ListOrdered, Lock, Coins } from 'lucide-react'
import { BUILDINGS, BUILDING_CATEGORIES as CATEGORIES, BUILDING_BY_TYPE } from '../data/buildings'
import { TICK } from '../config/tick'
import { addToBuildingQueue, cancelBuildingQueue } from '../services/buildQueue'
import { BUILDING_SLOT_TIERS, countEarnedFreeSlots } from '../data/queueSlots'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getUpgradeCost(building, currentLevel) {
  const mult = Math.pow(1.5, currentLevel)
  return {
    metal:     Math.floor((building.baseCost.metal     ?? 0) * mult),
    crystal:   Math.floor((building.baseCost.crystal   ?? 0) * mult),
    deuterium: Math.floor((building.baseCost.deuterium ?? 0) * mult),
  }
}

function getBuildTime(cost, roboticsLvl) {
  const base = (cost.metal + cost.crystal) / 2500
  const roboFactor = Math.max(1, 1 + roboticsLvl)
  const speed = import.meta.env.DEV ? (window.__devSpeed ?? 1) : 1
  return Math.max(1, Math.floor(base / roboFactor * 3600 * speed))
}

function formatTime(seconds) {
  if (seconds <= 0) return 'Complete!'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function canAfford(cost, available) {
  return (
    (available?.metal     ?? 0) >= cost.metal &&
    (available?.crystal   ?? 0) >= cost.crystal &&
    (available?.deuterium ?? 0) >= (cost.deuterium ?? 0)
  )
}

// Slot count is computed from BUILDING_SLOT_TIERS in src/data/queueSlots.js.
// The single source of truth lives there so the SlotProgress panel below and
// the slotsFull gate stay in lockstep.

// ─── Building Card ────────────────────────────────────────────────────────────
function BuildingCard({
  building, level, effectiveLevel, queuedCount,
  available, isUpgrading, upgradeCompleteAt, onQueue,
  slotsFull, submitting,
}) {
  const [timeLeft, setTimeLeft] = useState(0)
  // Cost reflects the next queue addition's target — one above effectiveLevel.
  const cost = getUpgradeCost(building, effectiveLevel)
  const affordable = canAfford(cost, available)

  useEffect(() => {
    if (!isUpgrading || !upgradeCompleteAt) return
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(upgradeCompleteAt) - Date.now()) / 1000))
      setTimeLeft(secs)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [isUpgrading, upgradeCompleteAt])

  const isVault = building.type === 'underground_vault'
  const nextVaultBonus = isVault ? building.vaultBonus(effectiveLevel + 1) : null
  const currentVaultBonus = isVault ? building.vaultBonus(level) : null

  const targetLvl = effectiveLevel + 1
  const buttonDisabled = !affordable || slotsFull || submitting

  return (
    <div className={`bg-gray-900 border rounded-xl p-4 transition-all ${
      isUpgrading ? 'border-cyan-600' : 'border-gray-800 hover:border-gray-700'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{building.icon}</span>
          <div>
            <h3 className="font-semibold text-white text-sm">{building.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{building.description}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-xs text-gray-500">Level</span>
          <p className="text-lg font-bold text-cyan-400">{level}</p>
          {queuedCount > 0 && (
            <p className="text-xs text-yellow-400">+{queuedCount} queued</p>
          )}
        </div>
      </div>

      {/* Production info */}
      {building.baseProd(level) > 0 && (
        <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
          <span>+{building.baseProd(level).toLocaleString()}/hr</span>
          {building.energyUse(level) > 0 && (
            <span className="flex items-center gap-1 text-yellow-500">
              <Zap size={10} /> {building.energyUse(level)}
            </span>
          )}
        </div>
      )}

      {/* Vault bonus info */}
      {isVault && level > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-400">
          <span>🔒 Protecting {currentVaultBonus}% of resources</span>
        </div>
      )}

      {/* In-progress state takes priority over the queue button */}
      {isUpgrading ? (
        <div className="mt-3 bg-cyan-950/50 border border-cyan-800 rounded-lg p-2 flex items-center gap-2">
          <Clock size={14} className="text-cyan-400 animate-pulse" />
          <span className="text-cyan-400 text-xs font-mono">
            {timeLeft > 0 ? formatTime(timeLeft) : 'Finishing...'}
          </span>
          <span className="text-gray-500 text-xs ml-auto">Upgrading to Lv. {level + 1}</span>
        </div>
      ) : (
        <div className="mt-3">
          {/* Cost display — uses `available = balance − reservation` for the red/normal color */}
          <div className="flex flex-wrap gap-2 text-xs mb-2">
            {cost.metal > 0 && (
              <span className={cost.metal > (available?.metal ?? 0) ? 'text-red-400' : 'text-gray-400'}>
                ⛏️ {cost.metal.toLocaleString()}
              </span>
            )}
            {cost.crystal > 0 && (
              <span className={cost.crystal > (available?.crystal ?? 0) ? 'text-red-400' : 'text-gray-400'}>
                💎 {cost.crystal.toLocaleString()}
              </span>
            )}
            {cost.deuterium > 0 && (
              <span className={cost.deuterium > (available?.deuterium ?? 0) ? 'text-red-400' : 'text-gray-400'}>
                🔵 {cost.deuterium.toLocaleString()}
              </span>
            )}
            {isVault && (
              <span className="text-amber-500 ml-auto">
                → {nextVaultBonus}% protection
              </span>
            )}
          </div>

          <button
            onClick={() => onQueue(building, cost)}
            disabled={buttonDisabled}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              !buttonDisabled
                ? 'bg-cyan-700 hover:bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
            title={
              slotsFull        ? 'Build queue is full' :
              !affordable      ? 'Not enough available resources (after pending reservations)' :
              undefined
            }
          >
            <ChevronUp size={14} />
            Queue Lv. {targetLvl}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Slot progression panel ─────────────────────────────────────────────────
// Always visible so the player can see how the slot system works. Earned tiers
// are checked off; un-earned tiers show what they need; paid tiers show a
// disabled "Buy with Rush Tokens" button until that economy lands.
function SlotProgress({ tiers, levels, slotsUsed }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Building2 size={14} className="text-cyan-400" />
        <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">Build queue slots</span>
        <span className="text-xs text-gray-500 ml-auto">{slotsUsed} in use</span>
      </div>
      <div className="space-y-1">
        {tiers.map(t => {
          const earned = !t.paid && t.check?.(levels)
          return (
            <div key={t.slot} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
              earned ? 'text-gray-300' :
              t.paid ? 'text-gray-500'  :
                       'text-gray-500'
            }`}>
              <span className="font-mono w-5 text-right">#{t.slot}</span>
              {earned ? (
                <span className="text-green-400">✓</span>
              ) : t.paid ? (
                <Coins size={12} className="text-yellow-500" />
              ) : (
                <Lock size={12} className="text-gray-600" />
              )}
              <span className="flex-1 truncate">{t.requirement}</span>
              {t.paid && (
                <button
                  disabled
                  title="Rush Tokens economy isn't built yet"
                  className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-500 text-xs cursor-not-allowed"
                >
                  Buy (soon)
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Queue list ──────────────────────────────────────────────────────────────
function BuildingQueueList({ queue, onCancel, submitting }) {
  if (!queue?.length) return null
  return (
    <div className="bg-gray-900 border border-yellow-900/40 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <ListOrdered size={14} className="text-yellow-500" />
        <span className="text-xs font-semibold text-yellow-500 uppercase tracking-wide">Build queue</span>
        <span className="text-xs text-gray-500">{queue.length} waiting</span>
      </div>
      <div className="space-y-1.5">
        {queue.map((q, i) => {
          const meta = BUILDING_BY_TYPE[q.building_type]
          return (
            <div key={q.id} className="flex items-center gap-3 bg-gray-800/60 rounded-lg px-3 py-2 text-xs">
              <span className="text-gray-500 font-mono w-5 text-right">#{i + 1}</span>
              <span className="text-base">{meta?.icon ?? '🏗️'}</span>
              <span className="text-white flex-1 truncate">
                {meta?.name ?? q.building_type} <span className="text-gray-500">·</span> {formatTime(q.build_seconds)}
              </span>
              <span className="text-gray-500 hidden sm:inline">
                ⛏️ {q.cost_metal.toLocaleString()} 💎 {q.cost_crystal.toLocaleString()}
                {q.cost_deuterium > 0 && <> 🔵 {q.cost_deuterium.toLocaleString()}</>}
              </span>
              <button
                onClick={() => onCancel(q.id)}
                disabled={submitting}
                className="text-gray-500 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Cancel — refunds the reservation"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Buildings Page ──────────────────────────────────────────────────────
export default function Buildings({
  planet, resources, buildings, setBuildings,
  buildingQueue, setBuildingQueue, reservation,
}) {
  const [submitting, setSubmitting] = useState(false)

  const roboticsLvl = buildings?.find(b => b.building_type === 'robotics_factory')?.level ?? 0
  const anyUpgrading = buildings?.some(b => b.is_upgrading) ?? false

  const maxSlots = countEarnedFreeSlots(BUILDING_SLOT_TIERS, { robotics: roboticsLvl })
  const queueLen = buildingQueue?.length ?? 0
  const slotsUsed = (anyUpgrading ? 1 : 0) + queueLen
  const slotsFull = slotsUsed >= maxSlots

  // Available = balance − reservation. Used for affordability and per-cost color.
  const available = {
    metal:     (resources?.metal     ?? 0) - (reservation?.metal     ?? 0),
    crystal:   (resources?.crystal   ?? 0) - (reservation?.crystal   ?? 0),
    deuterium: (resources?.deuterium ?? 0) - (reservation?.deuterium ?? 0),
  }

  // For each building type, the level that the *next* queue item would target − 1
  // (this is what getUpgradeCost expects as `currentLevel`).
  function effectiveCurrentLevel(buildingType) {
    const data = buildings?.find(b => b.building_type === buildingType)
    const baseLvl = data?.level ?? 0
    const isUpgradingThis = data?.is_upgrading ?? false
    const queuedCountThis = buildingQueue?.filter(q => q.building_type === buildingType).length ?? 0
    return baseLvl + (isUpgradingThis ? 1 : 0) + queuedCountThis
  }

  // Catch any upgrade whose timer expired — runs on mount AND every 2s while on the page,
  // so a missed setTimeout / dev-speed change doesn't leave a build stuck.
  useEffect(() => {
    if (!planet) return
    let cancelled = false
    async function checkCompleted() {
      if (cancelled || !buildings?.length) return
      const now = new Date()
      const completed = buildings.filter(
        b => b.is_upgrading && b.upgrade_complete_at && new Date(b.upgrade_complete_at) <= now
      )
      for (const b of completed) {
        if (cancelled) return
        const { error } = await supabase.from('buildings').update({
          level: b.level + 1,
          is_upgrading: false,
          upgrade_complete_at: null,
        })
          .eq('id', b.id)
          .eq('is_upgrading', true)
        if (error) continue
        setBuildings(prev => prev.map(pb =>
          pb.id === b.id && pb.is_upgrading
            ? { ...pb, level: pb.level + 1, is_upgrading: false, upgrade_complete_at: null }
            : pb
        ))
      }
    }
    checkCompleted()
    const interval = setInterval(checkCompleted, TICK.COMPLETION_POLL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [planet, buildings, setBuildings])

  // Add to queue. The server-side process_building_queue() picks up the head
  // on the next 3s tick, deducts from balance, and starts the upgrade.
  async function handleQueue(building, cost) {
    if (!planet || submitting) return
    if (slotsFull) return

    const currentLvl = effectiveCurrentLevel(building.type)
    const buildSeconds = getBuildTime(cost, roboticsLvl)

    setSubmitting(true)
    try {
      const row = await addToBuildingQueue({
        planetId: planet.id,
        buildingType: building.type,
        position: queueLen,
        cost,
        buildSeconds,
      })
      // Local optimistic insert; server-validated via the next tick.
      setBuildingQueue(prev => [...prev, row])
    } catch (err) {
      console.error('Add to queue failed:', err)
      alert(`Couldn't queue: ${err.message ?? 'unknown error'}.`)
    } finally {
      setSubmitting(false)
    }

    // currentLvl is unused here but exists for parity with how cost is computed —
    // keeping it explicit in case we later want to send it to the server for validation.
    void currentLvl
  }

  async function handleCancel(queueRowId) {
    if (submitting) return
    setSubmitting(true)
    try {
      await cancelBuildingQueue(queueRowId)
      setBuildingQueue(prev => prev.filter(q => q.id !== queueRowId))
    } catch (err) {
      console.error('Cancel failed:', err)
      alert(`Couldn't cancel: ${err.message ?? 'unknown error'}.`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Building2 size={20} className="text-cyan-400" />
        <h2 className="text-xl font-bold text-white">Buildings</h2>
        <span className="text-xs text-gray-500">
          Slots {slotsUsed} / {maxSlots}
        </span>
        {anyUpgrading && (
          <span className="text-xs bg-cyan-900/50 border border-cyan-700 text-cyan-400 px-2 py-1 rounded-full">
            1 upgrading
          </span>
        )}
        {slotsFull && (
          <span className="text-xs bg-yellow-900/50 border border-yellow-800 text-yellow-400 px-2 py-1 rounded-full">
            queue full
          </span>
        )}
      </div>

      {/* Queue list (only the *waiting* items — the active upgrade shows on its own card) */}
      <BuildingQueueList queue={buildingQueue} onCancel={handleCancel} submitting={submitting} />

      {/* Slot progression — always visible so the player learns the system */}
      <SlotProgress
        tiers={BUILDING_SLOT_TIERS}
        levels={{ robotics: roboticsLvl }}
        slotsUsed={slotsUsed}
      />

      {/* Building categories */}
      {CATEGORIES.map(cat => (
        <div key={cat}>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-widest">{cat}</h3>
            <div className="flex-1 h-px bg-cyan-900/40" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {BUILDINGS.filter(b => b.category === cat).map(building => {
              const data = buildings?.find(b => b.building_type === building.type)
              const queuedCount = buildingQueue?.filter(q => q.building_type === building.type).length ?? 0
              return (
                <BuildingCard
                  key={building.type}
                  building={building}
                  level={data?.level ?? 0}
                  effectiveLevel={effectiveCurrentLevel(building.type)}
                  queuedCount={queuedCount}
                  available={available}
                  isUpgrading={data?.is_upgrading ?? false}
                  upgradeCompleteAt={data?.upgrade_complete_at}
                  onQueue={handleQueue}
                  slotsFull={slotsFull}
                  submitting={submitting}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
