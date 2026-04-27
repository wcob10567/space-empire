import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Building2, Clock, ChevronUp, Zap } from 'lucide-react'
import { BUILDINGS, ALL_BUILDING_TYPES as BUILDING_TYPES, BUILDING_CATEGORIES as CATEGORIES } from '../data/buildings'
import { TICK } from '../config/tick'
import { debitResources } from '../services/resources'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getUpgradeCost(building, currentLevel) {
  const mult = Math.pow(1.5, currentLevel)
  return {
    metal:     Math.floor((building.baseCost.metal ?? 0) * mult),
    crystal:   Math.floor((building.baseCost.crystal ?? 0) * mult),
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

function canAfford(cost, resources) {
  return (
    (resources?.metal ?? 0) >= cost.metal &&
    (resources?.crystal ?? 0) >= cost.crystal &&
    (resources?.deuterium ?? 0) >= (cost.deuterium ?? 0)
  )
}

// ─── Building Card ────────────────────────────────────────────────────────────
function BuildingCard({ building, level, resources, isUpgrading, upgradeCompleteAt, onUpgrade, anyUpgrading }) {
  const [timeLeft, setTimeLeft] = useState(0)
  const cost = getUpgradeCost(building, level)
  const affordable = canAfford(cost, resources)

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
  const nextVaultBonus = isVault ? building.vaultBonus(level + 1) : null
  const currentVaultBonus = isVault ? building.vaultBonus(level) : null

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

      {/* Upgrading state */}
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
          {/* Cost display */}
          <div className="flex flex-wrap gap-2 text-xs mb-2">
            {cost.metal > 0 && (
              <span className={cost.metal > (resources?.metal ?? 0) ? 'text-red-400' : 'text-gray-400'}>
                ⛏️ {cost.metal.toLocaleString()}
              </span>
            )}
            {cost.crystal > 0 && (
              <span className={cost.crystal > (resources?.crystal ?? 0) ? 'text-red-400' : 'text-gray-400'}>
                💎 {cost.crystal.toLocaleString()}
              </span>
            )}
            {cost.deuterium > 0 && (
              <span className={cost.deuterium > (resources?.deuterium ?? 0) ? 'text-red-400' : 'text-gray-400'}>
                🔵 {cost.deuterium.toLocaleString()}
              </span>
            )}
            {/* Show vault bonus preview */}
            {isVault && (
              <span className="text-amber-500 ml-auto">
                → {nextVaultBonus}% protection
              </span>
            )}
          </div>

          {/* Upgrade button */}
          <button
            onClick={() => onUpgrade(building, cost)}
            disabled={!affordable || anyUpgrading}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              affordable && !anyUpgrading
                ? 'bg-cyan-700 hover:bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            <ChevronUp size={14} />
            Upgrade to Lv. {level + 1}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Buildings Page ──────────────────────────────────────────────────────
export default function Buildings({ planet, resources, buildings, setBuildings, setResources }) {
  const [upgrading, setUpgrading] = useState(false)

  const roboticsLvl = buildings?.find(b => b.building_type === 'robotics_factory')?.level ?? 0
  const anyUpgrading = buildings?.some(b => b.is_upgrading) ?? false

  // Catch any upgrade whose timer expired — runs on mount AND every 2s while on the page,
  // so a missed setTimeout (tab throttled, page reloaded, etc.) doesn't leave a build stuck.
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
        await supabase.from('buildings').update({
          level: b.level + 1,
          is_upgrading: false,
          upgrade_complete_at: null,
        }).eq('id', b.id)
        setBuildings(prev => prev.map(pb =>
          pb.id === b.id
            ? { ...pb, level: pb.level + 1, is_upgrading: false, upgrade_complete_at: null }
            : pb
        ))
      }
    }
    checkCompleted()
    const interval = setInterval(checkCompleted, TICK.COMPLETION_POLL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [planet, buildings, setBuildings])

  async function handleUpgrade(building, cost) {
    if (!planet || upgrading) return
    setUpgrading(true)

    const buildTime = getBuildTime(cost, roboticsLvl)
    const completeAt = new Date(Date.now() + buildTime * 1000).toISOString()

    try {
      // Deduct resources locally for snappy UI; refunded in catch on failure
      setResources(prev => ({
        ...prev,
        metal:     prev.metal - cost.metal,
        crystal:   prev.crystal - cost.crystal,
        deuterium: prev.deuterium - (cost.deuterium ?? 0),
      }))

      // Mark upgrading in DB
      const { error: bldErr } = await supabase.from('buildings').update({
        is_upgrading: true,
        upgrade_complete_at: completeAt,
      }).eq('planet_id', planet.id).eq('building_type', building.type)
      if (bldErr) throw bldErr

      // Debit resources in DB (uses cached snapshot — same staleness risk as before)
      await debitResources(planet.id, resources, cost)

      setBuildings(prev => prev.map(b =>
        b.building_type === building.type
          ? { ...b, is_upgrading: true, upgrade_complete_at: completeAt }
          : b
      ))
    } catch (err) {
      console.error('Upgrade failed:', err)
      alert(`Couldn't start the upgrade: ${err.message ?? 'unknown error'}. Reload to refresh state.`)
      // Refund the optimistic deduct so the resource bar isn't a lie
      setResources(prev => ({
        ...prev,
        metal:     prev.metal + cost.metal,
        crystal:   prev.crystal + cost.crystal,
        deuterium: prev.deuterium + (cost.deuterium ?? 0),
      }))
      setUpgrading(false)
      return
    }

    // Complete after timer (also caught by the on-mount/2s completer for missed timeouts)
    setTimeout(async () => {
      try {
        const { data: updated } = await supabase
          .from('buildings')
          .select('*')
          .eq('planet_id', planet.id)
          .eq('building_type', building.type)
          .single()

        if (updated) {
          await supabase.from('buildings').update({
            level: updated.level + 1,
            is_upgrading: false,
            upgrade_complete_at: null,
          }).eq('planet_id', planet.id).eq('building_type', building.type)

          setBuildings(prev => prev.map(b =>
            b.building_type === building.type
              ? { ...b, level: updated.level + 1, is_upgrading: false, upgrade_complete_at: null }
              : b
          ))
        }
      } catch (err) {
        console.error('Upgrade completion failed:', err)
        // The 2s interval completer (TICK.COMPLETION_POLL_MS) will retry.
      } finally {
        setUpgrading(false)
      }
    }, buildTime * 1000)
  }

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Building2 size={20} className="text-cyan-400" />
        <h2 className="text-xl font-bold text-white">Buildings</h2>
        {anyUpgrading && (
          <span className="text-xs bg-cyan-900/50 border border-cyan-700 text-cyan-400 px-2 py-1 rounded-full">
            1 upgrading
          </span>
        )}
      </div>

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
              return (
                <BuildingCard
                  key={building.type}
                  building={building}
                  level={data?.level ?? 0}
                  resources={resources}
                  isUpgrading={data?.is_upgrading ?? false}
                  upgradeCompleteAt={data?.upgrade_complete_at}
                  onUpgrade={handleUpgrade}
                  anyUpgrading={anyUpgrading}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}