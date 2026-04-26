import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Send, Clock, X, Rocket, Package, Search, Target, Globe, Recycle, Home } from 'lucide-react'

// ─── Ship definitions ─────────────────────────────────────────────────────────
const SHIP_STATS = {
  light_fighter:   { name: 'Light Fighter',   icon: '✈️',  speed: 12500,     cargo: 50      },
  heavy_fighter:   { name: 'Heavy Fighter',   icon: '🛩️', speed: 10000,     cargo: 100     },
  cruiser:         { name: 'Cruiser',         icon: '🚀',  speed: 15000,     cargo: 800     },
  battleship:      { name: 'Battleship',      icon: '⚓',  speed: 10000,     cargo: 1500    },
  bomber:          { name: 'Bomber',          icon: '💣',  speed: 4000,      cargo: 500     },
  destroyer:       { name: 'Destroyer',       icon: '🛸',  speed: 5000,      cargo: 2000    },
  deathstar:       { name: 'Deathstar',       icon: '🌑',  speed: 100,       cargo: 1000000 },
  colony_ship:     { name: 'Colony Ship',     icon: '🏗️', speed: 2500,      cargo: 7500    },
  recycler:        { name: 'Recycler',        icon: '♻️',  speed: 2000,      cargo: 20000   },
  espionage_probe: { name: 'Espionage Probe', icon: '🔍',  speed: 100000000, cargo: 5       },
}

// Which ships are allowed per mission (null = all ships)
const MISSION_SHIPS = {
  // Attack: every ship except espionage probes (probes have 0 attack and die instantly)
  attack:    ['light_fighter', 'heavy_fighter', 'cruiser', 'battleship', 'bomber', 'destroyer', 'deathstar', 'colony_ship', 'recycler'],
  espionage: ['espionage_probe'],
  transport: null,
  colonize:  ['colony_ship'],
  harvest:   ['recycler'],
  defend:    null,
}

const MISSION_HINTS = {
  espionage: 'Only Espionage Probes can be sent on spy missions.',
  colonize:  'Only Colony Ships can colonize new planets.',
  harvest:   'Only Recyclers can harvest debris fields.',
}

const MISSIONS = [
  { type: 'attack',    label: 'Attack',    icon: Target,  color: 'text-red-400',    bg: 'bg-red-900/30 border-red-800'       },
  { type: 'espionage', label: 'Espionage', icon: Search,  color: 'text-cyan-400',   bg: 'bg-cyan-900/30 border-cyan-800'     },
  { type: 'transport', label: 'Transport', icon: Package, color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-800' },
  { type: 'colonize',  label: 'Colonize',  icon: Globe,   color: 'text-green-400',  bg: 'bg-green-900/30 border-green-800'   },
  { type: 'harvest',   label: 'Harvest',   icon: Recycle, color: 'text-orange-400', bg: 'bg-orange-900/30 border-orange-800' },
  { type: 'defend',    label: 'Defend',    icon: Home,    color: 'text-blue-400',   bg: 'bg-blue-900/30 border-blue-800'     },
]

function formatTime(seconds) {
  if (seconds <= 0) return 'Arrived'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function calcFlightTime(originPlanet, targetCoords, ships, researchMap) {
  if (!originPlanet || !targetCoords) return 0
  const { galaxy: g1, system: s1, position: p1 } = originPlanet
  const { galaxy: g2, system: s2, position: p2 } = targetCoords
  const distance = Math.abs(g1 - g2) * 20000 + Math.abs(s1 - s2) * 95 + Math.abs(p1 - p2) * 5 + 1000
  let minSpeed = Infinity
  Object.entries(ships).forEach(([type, qty]) => {
    if (qty > 0 && SHIP_STATS[type]) {
      let speed = SHIP_STATS[type].speed
      if (['light_fighter', 'heavy_fighter', 'recycler'].includes(type)) speed *= 1 + (researchMap.combustion_drive ?? 0) * 0.1
      if (['cruiser', 'colony_ship', 'bomber'].includes(type)) speed *= 1 + (researchMap.impulse_drive ?? 0) * 0.2
      if (['battleship', 'destroyer', 'deathstar'].includes(type)) speed *= 1 + (researchMap.hyperspace_drive ?? 0) * 0.3
      minSpeed = Math.min(minSpeed, speed)
    }
  })
  if (minSpeed === Infinity) return 0
  const devSpeed = import.meta.env.DEV ? (window.__devSpeed ?? 1) : 1
  return Math.max(5, Math.floor((10 + (35000 / 500) * Math.sqrt(distance * 10 / minSpeed)) * devSpeed))
}

// ─── Active Fleet Card ────────────────────────────────────────────────────────
function FleetCard({ fleet, planet }) {
  const [timeLeft, setTimeLeft] = useState(0)
  const [phase, setPhase] = useState('outbound')

  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      const arrives = new Date(fleet.arrives_at).getTime()
      const returns = new Date(fleet.returns_at).getTime()
      if (!fleet.is_returning && now < arrives) {
        setPhase('outbound')
        setTimeLeft(Math.max(0, Math.floor((arrives - now) / 1000)))
      } else if (fleet.is_returning && now < returns) {
        setPhase('returning')
        setTimeLeft(Math.max(0, Math.floor((returns - now) / 1000)))
      } else {
        setPhase('arrived')
        setTimeLeft(0)
      }
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [fleet])

  const mission = MISSIONS.find(m => m.type === fleet.mission_type)
  const Icon = mission?.icon ?? Rocket
  const shipList = Object.entries(fleet.ship_payload ?? {}).filter(([, q]) => q > 0)
  const cargo = fleet.cargo ?? {}
  const hasCargoResources = !cargo.intel && Object.values(cargo).some(v => v > 0)

  const phaseLabel = {
    outbound: mission?.label ?? fleet.mission_type,
    returning: '← Returning Home',
    arrived: '✓ Arrived',
  }[phase]

  const phaseColor = phase === 'returning' ? 'text-green-400' : mission?.color ?? 'text-gray-300'

  const outboundPct = Math.min(100, ((Date.now() - new Date(fleet.departs_at)) / (new Date(fleet.arrives_at) - new Date(fleet.departs_at))) * 100)
  const returnPct = Math.min(100, ((Date.now() - new Date(fleet.arrives_at)) / (new Date(fleet.returns_at) - new Date(fleet.arrives_at))) * 100)

  return (
    <div className={`bg-gray-900 border rounded-xl p-4 transition-all ${
      phase === 'returning' ? 'border-green-900' : mission?.bg ?? 'border-gray-800'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={16} className={phaseColor} />
          <div>
            <span className={`text-sm font-semibold ${phaseColor}`}>{phaseLabel}</span>
            {phase === 'outbound' && fleet.target_coords && (
              <p className="text-xs text-gray-600">→ [{fleet.target_coords}]</p>
            )}
            {phase === 'returning' && (
              <p className="text-xs text-gray-600">← Returning to {planet?.name ?? 'Homeworld'}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Clock size={12} className={phase === 'returning' ? 'text-green-400' : 'text-gray-400'} />
          <span className={`font-mono ${phase === 'returning' ? 'text-green-400' : 'text-gray-400'}`}>
            {phase === 'arrived' ? 'Processing...' : formatTime(timeLeft)}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-800 rounded-full mb-3 overflow-hidden">
        {phase === 'outbound' && <div className="h-full bg-cyan-600 rounded-full" style={{ width: `${outboundPct}%` }} />}
        {phase === 'returning' && <div className="h-full bg-green-600 rounded-full" style={{ width: `${returnPct}%` }} />}
        {phase === 'arrived' && <div className="h-full bg-yellow-600 rounded-full w-full animate-pulse" />}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {shipList.map(([type, qty]) => (
          <span key={type} className="bg-gray-800 px-2 py-1 rounded text-gray-300">
            {SHIP_STATS[type]?.icon} {SHIP_STATS[type]?.name ?? type} ×{qty}
          </span>
        ))}
      </div>

      {hasCargoResources && (
        <div className="mt-2 flex gap-3 text-xs text-gray-500">
          <span>Carrying:</span>
          {cargo.metal > 0 && <span>⛏️ {Math.floor(cargo.metal).toLocaleString()}</span>}
          {cargo.crystal > 0 && <span>💎 {Math.floor(cargo.crystal).toLocaleString()}</span>}
          {cargo.deuterium > 0 && <span>🔵 {Math.floor(cargo.deuterium).toLocaleString()}</span>}
        </div>
      )}
    </div>
  )
}

// ─── Quick Dispatch Form ──────────────────────────────────────────────────────
function QuickDispatchForm({ planet, ships, resources, research, pendingMission, onDispatch, onClose }) {
  const { user } = useAuth()
  const [selectedShips, setSelectedShips] = useState({})
  const [mission, setMission] = useState(pendingMission?.type ?? 'attack')
  const [target, setTarget] = useState(pendingMission?.target ?? { galaxy: 1, system: 1, position: 1 })
  const [cargo, setCargo] = useState({ metal: 0, crystal: 0, deuterium: 0 })
  const [sending, setSending] = useState(false)

  const researchMap = {}
  research?.forEach(r => { researchMap[r.tech_type] = r.level })

  // Filter ships based on mission type
  const missionShipFilter = MISSION_SHIPS[mission]
  const availableShips = (ships?.filter(s => s.quantity > 0) ?? [])
    .filter(s => !missionShipFilter || missionShipFilter.includes(s.ship_type))

  const totalSelected = Object.values(selectedShips).reduce((a, b) => a + b, 0)
  const flightTime = calcFlightTime(planet, target, selectedShips, researchMap)
  const totalCargo = Object.entries(selectedShips).reduce((sum, [type, qty]) => sum + (SHIP_STATS[type]?.cargo ?? 0) * qty, 0)
  const usedCargo = cargo.metal + cargo.crystal + cargo.deuterium
  const missionInfo = MISSIONS.find(m => m.type === mission)

  // Clear ship selection when mission changes
  const handleMissionChange = (newMission) => {
    setMission(newMission)
    setSelectedShips({})
  }

  async function handleSend() {
    if (totalSelected === 0 || sending) return
    setSending(true)

    const departsAt = new Date().toISOString()
    const arrivesAt = new Date(Date.now() + flightTime * 1000).toISOString()
    const returnsAt = new Date(Date.now() + flightTime * 2000).toISOString()

    const { data: targetPlanet } = await supabase
      .from('planets')
      .select('id')
      .eq('galaxy', target.galaxy)
      .eq('system', target.system)
      .eq('position', target.position)
      .single()

    if (!targetPlanet && mission !== 'colonize') {
      alert(`No planet found at [${target.galaxy}:${target.system}:${target.position}]. Select a valid target on the galaxy map.`)
      setSending(false)
      return
    }

    if (mission === 'colonize' && targetPlanet) {
      alert(`Position [${target.galaxy}:${target.system}:${target.position}] is already occupied. Pick an empty slot.`)
      setSending(false)
      return
    }

    await supabase.from('fleets').insert({
      owner_id: user?.id,
      origin_planet_id: planet.id,
      target_planet_id: mission === 'colonize' ? null : (targetPlanet?.id ?? null),
      mission_type: mission,
      ship_payload: selectedShips,
      cargo,
      departs_at: departsAt,
      arrives_at: arrivesAt,
      returns_at: returnsAt,
      status: 'in_flight',
      target_coords: `${target.galaxy}:${target.system}:${target.position}`,
    })

    for (const [type, qty] of Object.entries(selectedShips)) {
      if (qty <= 0) continue
      const ship = ships.find(s => s.ship_type === type)
      if (ship) {
        await supabase.from('ships').update({ quantity: ship.quantity - qty })
          .eq('planet_id', planet.id).eq('ship_type', type)
      }
    }

    onDispatch()
    setSending(false)
  }

  return (
    <div className="bg-gray-900 border border-cyan-900/50 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold flex items-center gap-2">
          <Send size={16} className="text-cyan-400" /> Dispatch Fleet
        </h3>
        <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
      </div>

      {/* Target coordinates */}
      <div className="bg-gray-800 rounded-xl p-3">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Target Coordinates</p>
        <div className="grid grid-cols-3 gap-2">
          {['galaxy', 'system', 'position'].map(field => (
            <div key={field}>
              <label className="text-xs text-gray-500 capitalize block mb-1">{field}</label>
              <input
                type="number"
                min={1} max={field === 'galaxy' ? 5 : field === 'position' ? 15 : 499}
                value={target[field]}
                onChange={e => setTarget(p => ({ ...p, [field]: parseInt(e.target.value) || 1 }))}
                className="w-full bg-gray-700 text-white text-center rounded-lg px-2 py-1.5 text-sm"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-2">
          <span className="text-cyan-400 font-mono">[{target.galaxy}:{target.system}:{target.position}]</span>
          {flightTime > 0 && <span className="ml-2">· <span className="text-cyan-400 font-mono">{formatTime(flightTime)}</span></span>}
        </p>
      </div>

      {/* Mission type */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Mission</p>
        <div className="grid grid-cols-3 gap-2">
          {MISSIONS.map(m => (
            <button key={m.type} onClick={() => handleMissionChange(m.type)}
              className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-medium transition-all ${
                mission === m.type ? m.bg : 'border-gray-800 bg-gray-800/50 hover:border-gray-700'
              }`}>
              <m.icon size={14} className={m.color} />
              <span className={m.color}>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Ship selection */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
          Ships <span className="text-yellow-400 ml-1">{totalSelected > 0 ? `— ${totalSelected} selected` : ''}</span>
          {totalCargo > 0 && <span className="text-gray-600 ml-2">· Cargo: {totalCargo.toLocaleString()}</span>}
        </p>
        {MISSION_HINTS[mission] && (
          <p className="text-xs text-yellow-600 mb-2">⚠ {MISSION_HINTS[mission]}</p>
        )}
        {availableShips.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-4">
            {missionShipFilter
              ? `No ${missionShipFilter.map(s => SHIP_STATS[s]?.name).join(' or ')} available. Build them in the Shipyard first.`
              : 'No ships available. Build ships in the Shipyard first.'}
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {availableShips.map(ship => {
              const stats = SHIP_STATS[ship.ship_type]
              if (!stats) return null
              const selected = selectedShips[ship.ship_type] ?? 0
              return (
                <div key={ship.ship_type} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2">
                  <span className="text-lg">{stats.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{stats.name}</p>
                    <p className="text-xs text-gray-500">×{ship.quantity} available</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setSelectedShips(p => ({ ...p, [ship.ship_type]: Math.max(0, (p[ship.ship_type] ?? 0) - 1) }))}
                      className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white flex items-center justify-center">-</button>
                    <input type="number" min={0} max={ship.quantity} value={selected}
                      onChange={e => setSelectedShips(p => ({ ...p, [ship.ship_type]: Math.min(ship.quantity, Math.max(0, parseInt(e.target.value) || 0)) }))}
                      className="w-14 bg-gray-700 text-white text-center text-xs rounded px-1 py-1" />
                    <button onClick={() => setSelectedShips(p => ({ ...p, [ship.ship_type]: ship.quantity }))}
                      className="px-2 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs">All</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cargo for transport */}
      {mission === 'transport' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Cargo ({usedCargo.toLocaleString()} / {totalCargo.toLocaleString()})</p>
          {['metal', 'crystal', 'deuterium'].map(res => (
            <div key={res} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-20 capitalize">{res}</span>
              <input type="number" min={0}
                max={Math.min(resources?.[res] ?? 0, totalCargo - usedCargo + (cargo[res] ?? 0))}
                value={cargo[res]}
                onChange={e => setCargo(p => ({ ...p, [res]: Math.max(0, parseInt(e.target.value) || 0) }))}
                className="flex-1 bg-gray-800 text-white rounded px-3 py-1.5 text-sm" />
              <span className="text-xs text-gray-600">/ {(resources?.[res] ?? 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      <button onClick={handleSend} disabled={totalSelected === 0 || sending}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
          totalSelected > 0 && !sending
            ? `${missionInfo?.bg ?? 'bg-cyan-700 border-cyan-600'} text-white hover:opacity-90`
            : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'
        }`}>
        {missionInfo?.icon && <missionInfo.icon size={16} className={missionInfo.color} />}
        {sending ? 'Launching...' : `Launch ${missionInfo?.label ?? 'Fleet'}`}
      </button>
    </div>
  )
}

// ─── Ships on Planet ──────────────────────────────────────────────────────────
function ShipsOnPlanet({ ships, planet }) {
  const ownedShips = ships?.filter(s => s.quantity > 0) ?? []
  if (ownedShips.length === 0) return (
    <div className="text-center py-6 border border-dashed border-gray-800 rounded-xl">
      <p className="text-gray-600 text-xs">No ships on this planet</p>
    </div>
  )
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <Rocket size={12} className="text-cyan-400" />
        Ships at {planet?.name ?? 'Homeworld'}
      </p>
      <div className="flex flex-wrap gap-2">
        {ownedShips.map(ship => {
          const stats = SHIP_STATS[ship.ship_type]
          if (!stats) return null
          return (
            <div key={ship.ship_type} className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded-lg">
              <span className="text-base">{stats.icon}</span>
              <div>
                <p className="text-xs text-white">{stats.name}</p>
                <p className="text-xs text-cyan-400 font-bold">×{ship.quantity.toLocaleString()}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Fleet Page ──────────────────────────────────────────────────────────
export default function Fleet({ planet, ships, resources, research, setShips }) {
  const { user } = useAuth()
  const [fleets, setFleets] = useState([])
  const [showDispatch, setShowDispatch] = useState(false)
  const [pendingMission, setPendingMission] = useState(null)
  const [loading, setLoading] = useState(true)

useEffect(() => {
    if (!user?.id) return
    loadFleets()
    // ✅ Only poll for fleet status updates — App.jsx handles process_arrived_fleets
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('fleets')
        .select('*')
        .eq('owner_id', user?.id)
        .eq('status', 'in_flight')
        .order('arrives_at', { ascending: true })
      if (data) {
        setFleets(prev => {
          const prevIds = prev.map(f => f.id + f.is_returning).join()
          const newIds = data.map(f => f.id + f.is_returning).join()
          if (prevIds === newIds) return prev
          return data
        })
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [user?.id])

  useEffect(() => {
    if (window.__pendingMission) {
      setPendingMission(window.__pendingMission)
      setShowDispatch(true)
      window.__pendingMission = null
    }
  }, [])

  async function loadFleets() {
    setLoading(true)
    const { data } = await supabase
      .from('fleets')
      .select('*')
      .eq('owner_id', user?.id)
      .eq('status', 'in_flight')
      .order('arrives_at', { ascending: true })
    setFleets(data ?? [])
    setLoading(false)
  }

  async function handleDispatch() {
    setShowDispatch(false)
    setPendingMission(null)
    await loadFleets()
    const { data } = await supabase.from('ships').select('*').eq('planet_id', planet.id)
    if (data) setShips(data)
  }

  const totalFleetSlots = 1 + (research?.find(r => r.tech_type === 'computer_tech')?.level ?? 0)

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Rocket size={20} className="text-cyan-400" />
          <h2 className="text-xl font-bold text-white">Fleet Command</h2>
          <span className="text-xs text-gray-500">{fleets.length} / {totalFleetSlots} slots used</span>
        </div>
        <button
          onClick={() => { setPendingMission(null); setShowDispatch(!showDispatch) }}
          disabled={fleets.length >= totalFleetSlots}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            fleets.length < totalFleetSlots ? 'bg-cyan-700 hover:bg-cyan-600 text-white' : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
        >
          <Send size={16} />
          {showDispatch ? 'Cancel' : 'Dispatch Fleet'}
        </button>
      </div>

      {fleets.length >= totalFleetSlots && (
        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-xl p-3 text-xs text-yellow-400">
          All fleet slots used. Research Computer Technology to unlock more.
        </div>
      )}

      <ShipsOnPlanet ships={ships} planet={planet} />

      {showDispatch && (
        <QuickDispatchForm
          planet={planet}
          ships={ships}
          resources={resources}
          research={research}
          pendingMission={pendingMission}
          onDispatch={handleDispatch}
          onClose={() => { setShowDispatch(false); setPendingMission(null) }}
        />
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Active Fleets</h3>
        {loading ? (
          <div className="text-center py-8 text-gray-600 text-sm animate-pulse">Loading fleets...</div>
        ) : fleets.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-800 rounded-2xl">
            <Rocket size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">No active fleets</p>
            <p className="text-gray-700 text-xs mt-1">Launch an attack or send probes from the Galaxy map</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {fleets.map(fleet => <FleetCard key={fleet.id} fleet={fleet} />)}
          </div>
        )}
      </div>
    </div>
  )
}