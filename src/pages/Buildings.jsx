import { useState, useEffect, useCallback } from 'react'
import { Building2, Clock, ChevronUp, Zap } from 'lucide-react'
import { BUILDINGS, BUILDING_CATEGORIES as CATEGORIES, BUILDING_BY_TYPE } from '../data/buildings'
import { addToBuildingQueue, cancelBuildingQueue } from '../services/buildQueue'
import { completeBuildingUpgrade } from '../services/completion'
import { useCompletionPoll } from '../hooks/useCompletionPoll'
import { BUILDING_SLOT_TIERS, countEarnedFreeSlots } from '../data/queueSlots'
import { formatTime } from '../utils/format'
import { scaleCost, computeDuration } from '../utils/formulas'
import QueuePanel from '../components/QueuePanel'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getUpgradeCost = (building, currentLevel) => scaleCost(building.baseCost, 1.5, currentLevel)

const getBuildTime = (cost, roboticsLvl) => computeDuration({
  cost,
  divisor: 2500,
  factor: 1 + roboticsLvl,
  applyDevSpeed: true,
})

function canAfford(cost, available) {
  return (
    (available?.metal     ?? 0) >= cost.metal &&
    (available?.crystal   ?? 0) >= cost.crystal &&
    (available?.deuterium ?? 0) >= (cost.deuterium ?? 0)
  )
}

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

  // Catch any upgrade whose timer expired — generic 2s poll guards against
  // missed setTimeouts / dev-speed changes / page reloads.
  const completeBuilding = useCallback(
    (id, level) => completeBuildingUpgrade(id, level),
    []
  )
  useCompletionPoll({
    items: buildings,
    setItems: setBuildings,
    flagKey: 'is_upgrading',
    completeAtKey: 'upgrade_complete_at',
    complete: completeBuilding,
  })

  // Add to queue. The server-side process_building_queue() picks up the head
  // on the next 3s tick, deducts from balance, and starts the upgrade.
  async function handleQueue(building, cost) {
    if (!planet || submitting) return
    if (slotsFull) return

    const buildSeconds = getBuildTime(cost, roboticsLvl)

    setSubmitting(true)
    try {
      const row = await addToBuildingQueue({
        planetId: planet.id,
        buildingType: building.type,
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

      {/* Combined queue + slot panel: in-flight upgrade at the top, queued items
          underneath, then slot progression. Cancel is per-row on queued items. */}
      <QueuePanel
        title="Build queue"
        inFlight={(() => {
          const upgrading = buildings?.find(b => b.is_upgrading)
          if (!upgrading) return null
          const meta = BUILDING_BY_TYPE[upgrading.building_type]
          return {
            icon: meta?.icon ?? '🏗️',
            label: `${meta?.name ?? upgrading.building_type} → Lv. ${upgrading.level + 1}`,
            completeAt: upgrading.upgrade_complete_at,
          }
        })()}
        queue={buildingQueue?.map(q => {
          const meta = BUILDING_BY_TYPE[q.building_type]
          return {
            id: q.id,
            icon: meta?.icon ?? '🏗️',
            label: meta?.name ?? q.building_type,
            duration: q.build_seconds,
            cost: { metal: q.cost_metal, crystal: q.cost_crystal, deuterium: q.cost_deuterium },
          }
        })}
        slotInfo={{
          tiers: BUILDING_SLOT_TIERS,
          levels: { robotics: roboticsLvl },
          boughtSlots: 0,
          used: slotsUsed,
        }}
        onCancel={handleCancel}
        submitting={submitting}
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
