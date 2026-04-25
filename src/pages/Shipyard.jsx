import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Rocket, Lock, AlertTriangle, Clock, Plus, Minus } from 'lucide-react'

// ─── Ship & Defense Definitions ──────────────────────────────────────────────
const SHIPS = [
  {
    type: 'light_fighter',
    name: 'Light Fighter',
    icon: '✈️',
    category: 'Ships',
    description: 'Fast and cheap. The backbone of any early fleet.',
    cost: { metal: 3000, crystal: 1000, deuterium: 0 },
    requires: { shipyard: 1 },
    prereqs: {},
    stats: { attack: 50, shield: 10, hull: 400, speed: 12500, cargo: 50 },
  },
  {
    type: 'heavy_fighter',
    name: 'Heavy Fighter',
    icon: '🛩️',
    category: 'Ships',
    description: 'More firepower and durability than light fighters.',
    cost: { metal: 6000, crystal: 4000, deuterium: 0 },
    requires: { shipyard: 3, armor_tech: 2, impulse_drive: 2 },
    prereqs: { armor_tech: 2, impulse_drive: 2 },
    stats: { attack: 150, shield: 25, hull: 1000, speed: 10000, cargo: 100 },
  },
  {
    type: 'cruiser',
    name: 'Cruiser',
    icon: '🚀',
    category: 'Ships',
    description: 'A fast warship that dominates light fighters.',
    cost: { metal: 20000, crystal: 7000, deuterium: 2000 },
    requires: { shipyard: 5, impulse_drive: 4, ion_tech: 2 },
    prereqs: { impulse_drive: 4, ion_tech: 2 },
    stats: { attack: 400, shield: 50, hull: 2700, speed: 15000, cargo: 800 },
  },
  {
    type: 'battleship',
    name: 'Battleship',
    icon: '⚓',
    category: 'Ships',
    description: 'The king of combat. Heavy firepower and shields.',
    cost: { metal: 45000, crystal: 15000, deuterium: 0 },
    requires: { shipyard: 7, hyperspace_drive: 4 },
    prereqs: { hyperspace_drive: 4 },
    stats: { attack: 1000, shield: 200, hull: 6000, speed: 10000, cargo: 1500 },
  },
  {
    type: 'bomber',
    name: 'Bomber',
    icon: '💣',
    category: 'Ships',
    description: 'Specialized in destroying planetary defenses.',
    cost: { metal: 50000, crystal: 25000, deuterium: 15000 },
    requires: { shipyard: 8, impulse_drive: 6, plasma_tech: 5 },
    prereqs: { impulse_drive: 6, plasma_tech: 5 },
    stats: { attack: 1000, shield: 500, hull: 7500, speed: 4000, cargo: 500 },
  },
  {
    type: 'destroyer',
    name: 'Destroyer',
    icon: '🛸',
    category: 'Ships',
    description: 'Anti-cruiser warship with massive firepower.',
    cost: { metal: 60000, crystal: 50000, deuterium: 15000 },
    requires: { shipyard: 9, hyperspace_drive: 6, hyperspace_tech: 5 },
    prereqs: { hyperspace_drive: 6, hyperspace_tech: 5 },
    stats: { attack: 2000, shield: 500, hull: 11000, speed: 5000, cargo: 2000 },
  },
  {
    type: 'deathstar',
    name: 'Deathstar',
    icon: '🌑',
    category: 'Ships',
    description: 'The ultimate weapon. Can destroy entire fleets.',
    cost: { metal: 5000000, crystal: 4000000, deuterium: 1000000 },
    requires: { shipyard: 12, hyperspace_drive: 7, hyperspace_tech: 6, graviton_tech: 1 },
    prereqs: { hyperspace_drive: 7, hyperspace_tech: 6, graviton_tech: 1 },
    stats: { attack: 200000, shield: 50000, hull: 900000, speed: 100, cargo: 1000000 },
  },
  {
    type: 'colony_ship',
    name: 'Colony Ship',
    icon: '🏗️',
    category: 'Civil',
    description: 'Used to colonize new planets.',
    cost: { metal: 10000, crystal: 20000, deuterium: 10000 },
    requires: { shipyard: 4, impulse_drive: 3 },
    prereqs: { impulse_drive: 3 },
    stats: { attack: 50, shield: 100, hull: 3000, speed: 2500, cargo: 7500 },
  },
  {
    type: 'recycler',
    name: 'Recycler',
    icon: '♻️',
    category: 'Civil',
    description: 'Harvests debris fields after combat.',
    cost: { metal: 10000, crystal: 6000, deuterium: 2000 },
    requires: { shipyard: 4, combustion_drive: 6 },
    prereqs: { combustion_drive: 6 },
    stats: { attack: 1, shield: 10, hull: 1600, speed: 2000, cargo: 20000 },
  },
  {
    type: 'espionage_probe',
    name: 'Espionage Probe',
    icon: '🔍',
    category: 'Civil',
    description: 'Gathers intelligence on enemy planets.',
    cost: { metal: 0, crystal: 1000, deuterium: 0 },
    requires: { shipyard: 3, espionage_tech: 2 },
    prereqs: { espionage_tech: 2 },
    stats: { attack: 0, shield: 0, hull: 100, speed: 100000000, cargo: 5 },
  },
]

const DEFENSES = [
  {
    type: 'rocket_launcher',
    name: 'Rocket Launcher',
    icon: '🚀',
    category: 'Defense',
    description: 'Basic defense. Cheap and effective in numbers.',
    cost: { metal: 2000, crystal: 0, deuterium: 0 },
    requires: { shipyard: 1 },
    prereqs: {},
    stats: { attack: 80, shield: 20, hull: 200 },
  },
  {
    type: 'light_laser',
    name: 'Light Laser',
    icon: '🔴',
    category: 'Defense',
    description: 'Fast-firing laser turret.',
    cost: { metal: 1500, crystal: 500, deuterium: 0 },
    requires: { shipyard: 2, laser_tech: 3 },
    prereqs: { laser_tech: 3 },
    stats: { attack: 100, shield: 25, hull: 200 },
  },
  {
    type: 'heavy_laser',
    name: 'Heavy Laser',
    icon: '🟠',
    category: 'Defense',
    description: 'Powerful laser with high damage output.',
    cost: { metal: 6000, crystal: 2000, deuterium: 0 },
    requires: { shipyard: 4, laser_tech: 6, energy_tech: 5 },
    prereqs: { laser_tech: 6, energy_tech: 5 },
    stats: { attack: 250, shield: 100, hull: 800 },
  },
  {
    type: 'ion_cannon',
    name: 'Ion Cannon',
    icon: '🌀',
    category: 'Defense',
    description: 'Disrupts ship shields with ion bursts.',
    cost: { metal: 5000, crystal: 3000, deuterium: 0 },
    requires: { shipyard: 4, ion_tech: 4 },
    prereqs: { ion_tech: 4 },
    stats: { attack: 150, shield: 500, hull: 800 },
  },
  {
    type: 'plasma_turret',
    name: 'Plasma Turret',
    icon: '🟣',
    category: 'Defense',
    description: 'Devastating anti-ship plasma cannon.',
    cost: { metal: 50000, crystal: 50000, deuterium: 30000 },
    requires: { shipyard: 8, plasma_tech: 7 },
    prereqs: { plasma_tech: 7 },
    stats: { attack: 3000, shield: 300, hull: 3000 },
  },
  {
    type: 'shield_dome_small',
    name: 'Small Shield Dome',
    icon: '🔵',
    category: 'Defense',
    description: 'Protects the planet with an energy shield.',
    cost: { metal: 10000, crystal: 10000, deuterium: 0 },
    requires: { shipyard: 1, shielding_tech: 2 },
    prereqs: { shielding_tech: 2 },
    stats: { attack: 1, shield: 2000, hull: 2000 },
  },
  {
    type: 'shield_dome_large',
    name: 'Large Shield Dome',
    icon: '🟦',
    category: 'Defense',
    description: 'A massive shield protecting the entire planet.',
    cost: { metal: 50000, crystal: 50000, deuterium: 0 },
    requires: { shipyard: 6, shielding_tech: 6 },
    prereqs: { shielding_tech: 6 },
    stats: { attack: 1, shield: 50000, hull: 50000 },
  },
]

const CATEGORIES = ['Ships', 'Civil', 'Defense']

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

    // Deduct resources locally
    setResources(prev => ({
      ...prev,
      metal:     prev.metal - cost.metal,
      crystal:   prev.crystal - cost.crystal,
      deuterium: prev.deuterium - cost.deuterium,
    }))

    // Deduct resources in DB
    await supabase.from('resources').update({
      metal:     resources.metal - cost.metal,
      crystal:   resources.crystal - cost.crystal,
      deuterium: resources.deuterium - cost.deuterium,
    }).eq('planet_id', planet.id)

    // Set build queue locally
    setBuildQueue(prev => ({ ...prev, [item.type]: { qty, completeAt } }))

    // Complete after timer
    setTimeout(async () => {
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
      setBuildQueue(prev => { const n = { ...prev }; delete n[item.type]; return n })
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