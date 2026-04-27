import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Rocket, Lock, AlertTriangle, Clock, Plus, Minus } from 'lucide-react'
import { SHIPS, DEFENSES, SHIPYARD_CATEGORIES as CATEGORIES } from '../data/ships'
import { debitResources } from '../services/resources'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getBuildTime(cost, shipyardLvl, naniteLvl) {
  const base = (cost.metal + cost.crystal) / 2500
  const factor = Math.max(1, shipyardLvl) * Math.pow(2, naniteLvl ?? 0)
  const speed = window.__devSpeed ?? 1
  return Math.max(1, Math.floor(base / factor * 3600 * speed))
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

function getBlocker(item, researchMap, shipyardLvl, resources, qty) {
  // Check shipyard level
  if (shipyardLvl < (item.requires.shipyard ?? 0)) {
    return { type: 'building', msg: `Need Shipyard Lv. ${item.requires.shipyard}` }
  }
  // Check research prereqs
  for (const [reqType, reqLvl] of Object.entries(item.prereqs)) {
    const have = researchMap[reqType] ?? 0
    if (have < reqLvl) {
      const allItems = [...SHIPS, ...DEFENSES]
      const name = allItems.find(s => s.type === reqType)?.name ?? reqType
      return { type: 'research', msg: `Need ${name} Lv. ${reqLvl}` }
    }
  }
  // Check resources
  const totalCost = {
    metal:     item.cost.metal * qty,
    crystal:   item.cost.crystal * qty,
    deuterium: (item.cost.deuterium ?? 0) * qty,
  }
  const missing = []
  if (totalCost.metal > (resources?.metal ?? 0)) missing.push(`${(totalCost.metal - (resources?.metal ?? 0)).toLocaleString()} metal`)
  if (totalCost.crystal > (resources?.crystal ?? 0)) missing.push(`${(totalCost.crystal - (resources?.crystal ?? 0)).toLocaleString()} crystal`)
  if (totalCost.deuterium > (resources?.deuterium ?? 0)) missing.push(`${(totalCost.deuterium - (resources?.deuterium ?? 0)).toLocaleString()} deuterium`)
  if (missing.length > 0) return { type: 'resources', msg: `Need ${missing[0]} more` }
  return null
}

// ─── Item Card ────────────────────────────────────────────────────────────────
function ItemCard({ item, quantity, resources, researchMap, shipyardLvl, naniteLvl, onBuild, building }) {
  const [qty, setQty] = useState(1)
  const [timeLeft, setTimeLeft] = useState(0)
  const blocker = getBlocker(item, researchMap, shipyardLvl, resources, qty)
  const isLocked = blocker?.type === 'building' || blocker?.type === 'research'
  const isAlmostReady = blocker?.type === 'resources'
  const isAffordable = !blocker
  const buildTime = getBuildTime(item.cost, shipyardLvl, naniteLvl)

  useEffect(() => {
    if (!building) return
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(building.completeAt) - Date.now()) / 1000))
      setTimeLeft(secs)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [building])

  return (
    <div className={`bg-gray-900 border rounded-xl p-4 transition-all ${
      building    ? 'border-cyan-600' :
      isLocked    ? 'border-gray-800 opacity-60' :
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

      {/* Building in progress */}
      {building ? (
        <div className="bg-cyan-950/50 border border-cyan-800 rounded-lg p-2 flex items-center gap-2">
          <Clock size={14} className="text-cyan-400 animate-pulse" />
          <span className="text-cyan-400 text-xs font-mono">{formatTime(timeLeft)}</span>
          <span className="text-gray-500 text-xs ml-auto">Building x{building.qty}</span>
        </div>
      ) : isLocked ? (
        <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-2">
          <Lock size={12} className="text-gray-600 shrink-0" />
          <span className="text-gray-600 text-xs">{blocker?.msg}</span>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Cost */}
          <div className="flex flex-wrap gap-2 text-xs">
            {item.cost.metal > 0 && (
              <span className={(item.cost.metal * qty) > (resources?.metal ?? 0) ? 'text-red-400' : 'text-gray-400'}>
                ⛏️ {(item.cost.metal * qty).toLocaleString()}
              </span>
            )}
            {item.cost.crystal > 0 && (
              <span className={(item.cost.crystal * qty) > (resources?.crystal ?? 0) ? 'text-red-400' : 'text-gray-400'}>
                💎 {(item.cost.crystal * qty).toLocaleString()}
              </span>
            )}
            {item.cost.deuterium > 0 && (
              <span className={(item.cost.deuterium * qty) > (resources?.deuterium ?? 0) ? 'text-red-400' : 'text-gray-400'}>
                🔵 {(item.cost.deuterium * qty).toLocaleString()}
              </span>
            )}
            <span className="text-gray-600 ml-auto">⏱ {formatTime(buildTime * qty)}</span>
          </div>

          {/* Almost ready warning */}
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

          {/* Build button */}
          <button
            onClick={() => onBuild(item, qty)}
            disabled={!isAffordable}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              isAffordable
                ? 'bg-cyan-700 hover:bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            <Rocket size={14} />
            Build {qty > 1 ? `x${qty}` : ''}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Shipyard Page ───────────────────────────────────────────────────────
export default function Shipyard({ planet, resources, buildings, research, ships, setShips, setResources }) {
  const [buildQueue, setBuildQueue] = useState({})

  const shipyardLvl = buildings?.find(b => b.building_type === 'shipyard')?.level ?? 0
  const naniteLvl   = buildings?.find(b => b.building_type === 'nanite_factory')?.level ?? 0

  const researchMap = {}
  research?.forEach(r => { researchMap[r.tech_type] = r.level })

  const shipMap = {}
  ships?.forEach(s => { shipMap[s.ship_type] = s.quantity })

  async function handleBuild(item, qty) {
    if (!planet) return
    const cost = {
      metal:     item.cost.metal * qty,
      crystal:   item.cost.crystal * qty,
      deuterium: (item.cost.deuterium ?? 0) * qty,
    }
    const buildTime = getBuildTime(item.cost, shipyardLvl, naniteLvl) * qty
    const completeAt = new Date(Date.now() + buildTime * 1000).toISOString()

    try {
      setResources(prev => ({
        ...prev,
        metal:     prev.metal - cost.metal,
        crystal:   prev.crystal - cost.crystal,
        deuterium: prev.deuterium - cost.deuterium,
      }))

      await debitResources(planet.id, resources, cost)

      // Build queue is local-only state; lost on reload (known limitation, see DevPanel comment).
      setBuildQueue(prev => ({ ...prev, [item.type]: { qty, completeAt } }))
    } catch (err) {
      console.error('Build dispatch failed:', err)
      alert(`Couldn't start build: ${err.message ?? 'unknown error'}. Reload to refresh state.`)
      setResources(prev => ({
        ...prev,
        metal:     prev.metal + cost.metal,
        crystal:   prev.crystal + cost.crystal,
        deuterium: prev.deuterium + cost.deuterium,
      }))
      return
    }

    // Complete after timer (no on-mount completer for shipyard yet — TODO)
    setTimeout(async () => {
      try {
        const existing = ships?.find(s => s.ship_type === item.type)
        if (existing) {
          await supabase.from('ships').update({
            quantity: existing.quantity + qty,
          }).eq('planet_id', planet.id).eq('ship_type', item.type)
          setShips(prev => prev.map(s => s.ship_type === item.type
            ? { ...s, quantity: s.quantity + qty }
            : s
          ))
        } else {
          await supabase.from('ships').insert({
            planet_id: planet.id,
            ship_type: item.type,
            quantity: qty,
          })
          setShips(prev => [...(prev ?? []), { ship_type: item.type, quantity: qty }])
        }
      } catch (err) {
        console.error('Build completion failed:', err)
      } finally {
        setBuildQueue(prev => { const n = { ...prev }; delete n[item.type]; return n })
      }
    }, buildTime * 1000)
  }

  const allItems = [...SHIPS, ...DEFENSES]

  return (
    <div className="space-y-8 w-full">
      <div className="flex items-center gap-3">
        <Rocket size={20} className="text-cyan-400" />
        <h2 className="text-xl font-bold text-white">Shipyard</h2>
        <span className="text-xs text-gray-500">Shipyard Lv. {shipyardLvl}</span>
        {Object.keys(buildQueue).length > 0 && (
          <span className="text-xs bg-cyan-900/50 border border-cyan-700 text-cyan-400 px-2 py-1 rounded-full">
            {Object.keys(buildQueue).length} building
          </span>
        )}
      </div>

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
                resources={resources}
                researchMap={researchMap}
                shipyardLvl={shipyardLvl}
                naniteLvl={naniteLvl}
                onBuild={handleBuild}
                building={buildQueue[item.type] ?? null}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}