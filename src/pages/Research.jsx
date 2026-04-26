import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { FlaskConical, Clock, ChevronUp, Lock, AlertTriangle, X } from 'lucide-react'

// ─── Tech Tree Definition ───────────────────────────────────────────────────
const TECH_TREE = {
  Combat: [
    {
      type: 'energy_tech',
      name: 'Energy Technology',
      icon: '⚡',
      description: 'Improves energy efficiency across all systems.',
      baseCost: { metal: 0, crystal: 800, deuterium: 400 },
      requires: { lab: 1 },
      prereqs: [],
    },
    {
      type: 'laser_tech',
      name: 'Laser Technology',
      icon: '🔴',
      description: 'Develops focused laser weapons for combat.',
      baseCost: { metal: 200, crystal: 100, deuterium: 0 },
      requires: { lab: 1, energy_tech: 2 },
      prereqs: ['energy_tech'],
    },
    {
      type: 'ion_tech',
      name: 'Ion Technology',
      icon: '🌀',
      description: 'Harnesses ion particles for powerful weapons.',
      baseCost: { metal: 1000, crystal: 300, deuterium: 100 },
      requires: { lab: 4, energy_tech: 4, laser_tech: 5 },
      prereqs: ['laser_tech'],
    },
    {
      type: 'weapons_tech',
      name: 'Weapons Technology',
      icon: '⚔️',
      description: 'Increases the attack power of all ships.',
      baseCost: { metal: 800, crystal: 200, deuterium: 0 },
      requires: { lab: 4 },
      prereqs: [],
    },
    {
      type: 'shielding_tech',
      name: 'Shielding Technology',
      icon: '🛡️',
      description: 'Strengthens defensive shields on all ships.',
      baseCost: { metal: 200, crystal: 600, deuterium: 0 },
      requires: { lab: 6, energy_tech: 3 },
      prereqs: ['energy_tech'],
    },
    {
      type: 'armor_tech',
      name: 'Armor Technology',
      icon: '🔩',
      description: 'Reinforces hull integrity of all ships.',
      baseCost: { metal: 1000, crystal: 0, deuterium: 0 },
      requires: { lab: 2 },
      prereqs: [],
    },
  ],
  Propulsion: [
    {
      type: 'combustion_drive',
      name: 'Combustion Drive',
      icon: '🔥',
      description: 'Basic propulsion for small ships.',
      baseCost: { metal: 400, crystal: 0, deuterium: 600 },
      requires: { lab: 1, energy_tech: 1 },
      prereqs: ['energy_tech'],
    },
    {
      type: 'impulse_drive',
      name: 'Impulse Drive',
      icon: '💫',
      description: 'Advanced drive enabling faster fleet speeds.',
      baseCost: { metal: 2000, crystal: 4000, deuterium: 600 },
      requires: { lab: 2, energy_tech: 1 },
      prereqs: ['combustion_drive'],
    },
    {
      type: 'hyperspace_drive',
      name: 'Hyperspace Drive',
      icon: '🌌',
      description: 'Allows ships to travel at extreme speeds.',
      baseCost: { metal: 10000, crystal: 20000, deuterium: 6000 },
      requires: { lab: 7, hyperspace_tech: 3, impulse_drive: 3 },
      prereqs: ['impulse_drive', 'hyperspace_tech'],
    },
    {
      type: 'hyperspace_tech',
      name: 'Hyperspace Technology',
      icon: '🔮',
      description: 'Unlocks hyperspace research branch.',
      baseCost: { metal: 0, crystal: 4000, deuterium: 2000 },
      requires: { lab: 7, energy_tech: 5, shielding_tech: 5 },
      prereqs: ['shielding_tech'],
    },
    {
      type: 'graviton_tech',
      name: 'Graviton Technology',
      icon: '🌑',
      description: 'Manipulates gravitational fields for advanced weapons.',
      baseCost: { metal: 0, crystal: 0, deuterium: 300000 },
      requires: { lab: 12 },
      prereqs: ['hyperspace_drive'],
    },
  ],
  Economy: [
    {
      type: 'espionage_tech',
      name: 'Espionage Technology',
      icon: '🕵️',
      description: 'Improves spy probe effectiveness.',
      baseCost: { metal: 200, crystal: 1000, deuterium: 200 },
      requires: { lab: 3 },
      prereqs: [],
    },
    {
      type: 'computer_tech',
      name: 'Computer Technology',
      icon: '💻',
      description: 'Increases the number of fleet slots available.',
      baseCost: { metal: 0, crystal: 400, deuterium: 600 },
      requires: { lab: 1 },
      prereqs: [],
    },
    {
      type: 'astrophysics',
      name: 'Astrophysics',
      icon: '🔭',
      description: 'Enables colonization of new planets.',
      baseCost: { metal: 4000, crystal: 8000, deuterium: 4000 },
      requires: { lab: 3, espionage_tech: 4, impulse_drive: 3 },
      prereqs: ['espionage_tech', 'impulse_drive'],
    },
    {
      type: 'intergalactic_research',
      name: 'Intergalactic Research',
      icon: '🌐',
      description: 'Combines research labs across planets.',
      baseCost: { metal: 240000, crystal: 400000, deuterium: 160000 },
      requires: { lab: 10, computer_tech: 8, hyperspace_tech: 8 },
      prereqs: ['computer_tech', 'hyperspace_tech'],
    },
    {
      type: 'plasma_tech',
      name: 'Plasma Technology',
      icon: '🟣',
      description: 'Greatly increases resource production.',
      baseCost: { metal: 2000, crystal: 4000, deuterium: 1000 },
      requires: { lab: 4, energy_tech: 8, laser_tech: 10, ion_tech: 5 },
      prereqs: ['ion_tech'],
    },
  ],
}

const BRANCHES = ['Combat', 'Propulsion', 'Economy']

// ─── Helpers ────────────────────────────────────────────────────────────────
function getResearchCost(tech, currentLevel) {
  const mult = Math.pow(1.75, currentLevel)
  return {
    metal:     Math.floor((tech.baseCost.metal ?? 0) * mult),
    crystal:   Math.floor((tech.baseCost.crystal ?? 0) * mult),
    deuterium: Math.floor((tech.baseCost.deuterium ?? 0) * mult),
  }
}

function getResearchTime(cost, labLvl) {
  const base = (cost.metal + cost.crystal) / 1000
  const labFactor = Math.max(1, labLvl)
  return Math.max(5, Math.floor(base / labFactor * 3600))
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

// Per-planet feasibility check used by the picker and visual-state logic
function planetCanResearch(tech, cost, planetBuildings, planetResources) {
  const labLvl = planetBuildings?.find(b => b.building_type === 'research_lab')?.level ?? 0
  if (labLvl < (tech.requires.lab ?? 0)) {
    return { ok: false, msg: `Need Research Lab Lv. ${tech.requires.lab}`, labLvl }
  }
  if (cost.metal > (planetResources?.metal ?? 0)) {
    return { ok: false, msg: `Short ${(cost.metal - (planetResources?.metal ?? 0)).toLocaleString()} metal`, labLvl }
  }
  if (cost.crystal > (planetResources?.crystal ?? 0)) {
    return { ok: false, msg: `Short ${(cost.crystal - (planetResources?.crystal ?? 0)).toLocaleString()} crystal`, labLvl }
  }
  if (cost.deuterium > (planetResources?.deuterium ?? 0)) {
    return { ok: false, msg: `Short ${(cost.deuterium - (planetResources?.deuterium ?? 0)).toLocaleString()} deuterium`, labLvl }
  }
  return { ok: true, msg: null, labLvl }
}

// Compute the per-tech visual state given the active planet + every planet's data.
// State machine:
//   researching → handled separately by caller
//   available    → active planet has lab + resources (cyan border, click researches from active)
//   almost_ready → active CAN'T but at least one other planet CAN (yellow border, click opens picker)
//   locked       → no planet can research it yet (gray border, button disabled)
function getTechVisualState({ tech, level, researchMap, multiPlanet, activeBuildings, activeResources, activePlanetId, planets, livePlanetData }) {
  const cost = getResearchCost(tech, level)

  // Tech prereqs are account-wide → if missing, locked everywhere
  for (const [reqType, reqLvl] of Object.entries(tech.requires)) {
    if (reqType === 'lab') continue
    if ((researchMap[reqType] ?? 0) < reqLvl) {
      const reqTech = Object.values(TECH_TREE).flat().find(t => t.type === reqType)
      return { state: 'locked', msg: `Need ${reqTech?.name ?? reqType} Lv. ${reqLvl}`, cost }
    }
  }

  // Active planet check
  const activeCheck = planetCanResearch(tech, cost, activeBuildings, activeResources)
  if (activeCheck.ok) return { state: 'available', msg: null, cost }

  // Single-planet → no fallback, locked
  if (!multiPlanet) {
    return { state: 'locked', msg: activeCheck.msg, cost }
  }

  // Multi-planet → does any OTHER planet meet the bar?
  const anyOtherViable = (planets ?? []).some(p => {
    if (p.id === activePlanetId) return false
    const data = livePlanetData?.[p.id]
    if (!data?.resources) return false
    return planetCanResearch(tech, cost, data.buildings, data.resources).ok
  })

  if (anyOtherViable) {
    return { state: 'almost_ready', msg: 'Available on another planet', cost }
  }

  // No planet viable. Pick the most useful message.
  const maxLab = Math.max(0, ...((planets ?? []).map(p => {
    const data = livePlanetData?.[p.id]
    return data?.buildings?.find(b => b.building_type === 'research_lab')?.level ?? 0
  })))
  if (maxLab < (tech.requires.lab ?? 0)) {
    return { state: 'locked', msg: `Need Research Lab Lv. ${tech.requires.lab}`, cost }
  }
  return { state: 'locked', msg: 'Insufficient resources', cost }
}

// ─── Planet Picker Modal ─────────────────────────────────────────────────────
function PlanetPickerModal({ tech, cost, currentLevel, planets, planetData, onConfirm, onClose }) {
  const sorted = [...(planets ?? [])].sort((a, b) => {
    const aLab = planetData[a.id]?.buildings?.find(x => x.building_type === 'research_lab')?.level ?? 0
    const bLab = planetData[b.id]?.buildings?.find(x => x.building_type === 'research_lab')?.level ?? 0
    return bLab - aLab
  })

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-cyan-900/50 rounded-2xl p-5 max-w-md w-full max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <h3 className="text-white font-bold flex items-center gap-2 truncate">
              <span className="text-2xl">{tech.icon}</span>
              <span className="truncate">{tech.name} → Lv. {currentLevel + 1}</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
              <span>Cost:</span>
              {cost.metal > 0     && <span>⛏️ {cost.metal.toLocaleString()}</span>}
              {cost.crystal > 0   && <span>💎 {cost.crystal.toLocaleString()}</span>}
              {cost.deuterium > 0 && <span>🔵 {cost.deuterium.toLocaleString()}</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white shrink-0 ml-2">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Research from:</p>
        <div className="space-y-2">
          {sorted.map(p => {
            const data = planetData[p.id]
            if (!data || !data.resources) {
              return (
                <div key={p.id} className="border border-gray-800 rounded-lg p-3 text-xs text-gray-600 animate-pulse">
                  Loading {p.name}...
                </div>
              )
            }
            const check = planetCanResearch(tech, cost, data.buildings, data.resources)
            const time = getResearchTime(cost, check.labLvl)
            return (
              <button
                key={p.id}
                disabled={!check.ok}
                onClick={() => onConfirm(p, data.resources, data.buildings)}
                className={`w-full text-left border rounded-lg p-3 transition-all ${
                  check.ok
                    ? 'border-cyan-800 bg-gray-900 hover:border-cyan-600 hover:bg-cyan-950/30 cursor-pointer'
                    : 'border-gray-800 bg-gray-900/50 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-sm font-medium text-white truncate">
                    {p.is_homeworld ? '🏠 ' : '🌍 '}{p.name}
                  </span>
                  <span className="text-xs text-gray-500 font-mono shrink-0">[{p.galaxy}:{p.system}:{p.position}]</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Lab Lv. {check.labLvl}</span>
                  {check.ok ? (
                    <span className="text-cyan-400 font-mono flex items-center gap-1">
                      <Clock size={11} /> {formatTime(time)}
                    </span>
                  ) : (
                    <span className="text-yellow-500 flex items-center gap-1">
                      <AlertTriangle size={11} /> {check.msg}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── TechNode Component ──────────────────────────────────────────────────────
function TechNode({ tech, level, isResearching, researchCompleteAt, visualState, resources, onResearch, anyResearching, isLast }) {
  const [timeLeft, setTimeLeft] = useState(0)
  const { state, msg, cost } = visualState
  const isLocked = !isResearching && state === 'locked'
  const isAlmostReady = !isResearching && state === 'almost_ready'
  const isAvailable = !isResearching && state === 'available'

  useEffect(() => {
    if (!isResearching || !researchCompleteAt) return
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(researchCompleteAt) - Date.now()) / 1000))
      setTimeLeft(secs)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [isResearching, researchCompleteAt])

  const borderClass = isResearching   ? 'border-cyan-500 bg-cyan-950/30' :
                      isLocked        ? 'border-gray-800 bg-gray-900/50 opacity-60' :
                      isAlmostReady   ? 'border-yellow-800 bg-gray-900' :
                                        'border-cyan-800 bg-gray-900 hover:border-cyan-600'

  return (
    <div className="flex flex-col items-center">
      <div className={`w-full border rounded-xl p-4 transition-all relative ${borderClass}`}>
        {isLocked && (
          <div className="absolute top-3 right-3">
            <Lock size={14} className="text-gray-600" />
          </div>
        )}

        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{tech.icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-sm truncate ${isLocked ? 'text-gray-500' : 'text-white'}`}>
              {tech.name}
            </h3>
            <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{tech.description}</p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs text-gray-600">Lv.</span>
            <p className={`text-lg font-bold ${level > 0 ? 'text-cyan-400' : 'text-gray-600'}`}>{level}</p>
          </div>
        </div>

        {isResearching ? (
          <div className="bg-cyan-950/50 border border-cyan-800 rounded-lg p-2 flex items-center gap-2">
            <Clock size={14} className="text-cyan-400 animate-pulse" />
            <span className="text-cyan-400 text-xs font-mono">{formatTime(timeLeft)}</span>
            <span className="text-gray-500 text-xs ml-auto">→ Lv. {level + 1}</span>
          </div>
        ) : isLocked ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-2">
              <Lock size={12} className="text-gray-600 shrink-0" />
              <span className="text-gray-600 text-xs">{msg}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {cost.metal > 0     && <span className={cost.metal > (resources?.metal ?? 0)         ? 'text-red-400/60' : 'text-gray-600'}>⛏️ {cost.metal.toLocaleString()}</span>}
              {cost.crystal > 0   && <span className={cost.crystal > (resources?.crystal ?? 0)     ? 'text-red-400/60' : 'text-gray-600'}>💎 {cost.crystal.toLocaleString()}</span>}
              {cost.deuterium > 0 && <span className={cost.deuterium > (resources?.deuterium ?? 0) ? 'text-red-400/60' : 'text-gray-600'}>🔵 {cost.deuterium.toLocaleString()}</span>}
            </div>
          </div>
        ) : isAlmostReady ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-2">
              <AlertTriangle size={12} className="text-yellow-500 shrink-0" />
              <span className="text-yellow-500 text-xs">{msg}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {cost.metal > 0     && <span className={cost.metal > (resources?.metal ?? 0)         ? 'text-red-400' : 'text-gray-500'}>⛏️ {cost.metal.toLocaleString()}</span>}
              {cost.crystal > 0   && <span className={cost.crystal > (resources?.crystal ?? 0)     ? 'text-red-400' : 'text-gray-500'}>💎 {cost.crystal.toLocaleString()}</span>}
              {cost.deuterium > 0 && <span className={cost.deuterium > (resources?.deuterium ?? 0) ? 'text-red-400' : 'text-gray-500'}>🔵 {cost.deuterium.toLocaleString()}</span>}
            </div>
            <button
              onClick={() => onResearch(tech, cost)}
              disabled={anyResearching}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                !anyResearching
                  ? 'bg-yellow-800 hover:bg-yellow-700 text-yellow-100'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              <ChevronUp size={14} />
              Research Lv. {level + 1}
            </button>
          </div>
        ) : (
          /* available */
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              {cost.metal > 0     && <span className="text-gray-400">⛏️ {cost.metal.toLocaleString()}</span>}
              {cost.crystal > 0   && <span className="text-gray-400">💎 {cost.crystal.toLocaleString()}</span>}
              {cost.deuterium > 0 && <span className="text-gray-400">🔵 {cost.deuterium.toLocaleString()}</span>}
            </div>
            <button
              onClick={() => onResearch(tech, cost)}
              disabled={anyResearching}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                !anyResearching
                  ? 'bg-cyan-700 hover:bg-cyan-600 text-white'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              <ChevronUp size={14} />
              Research Lv. {level + 1}
            </button>
          </div>
        )}
      </div>

      {!isLast && (
        <div className={`w-0.5 h-6 my-1 ${level > 0 ? 'bg-cyan-700' : 'bg-gray-700'}`} />
      )}
    </div>
  )
}

// ─── Main Research Page ──────────────────────────────────────────────────────
export default function Research({ planet, planets, resources, buildings, research, setResearch, setResources }) {
  const [researching, setResearching] = useState(false)
  const [picker, setPicker] = useState(null)        // { tech, cost, currentLevel } when modal open
  const [planetData, setPlanetData] = useState({})  // { [planetId]: { buildings, resources } } — server snapshot

  const labLvl = buildings?.find(b => b.building_type === 'research_lab')?.level ?? 0
  const anyResearching = research?.some(r => r.is_researching) ?? false
  const multiPlanet = (planets?.length ?? 0) > 1

  const researchMap = {}
  research?.forEach(r => { researchMap[r.tech_type] = r.level })

  // Active planet's data is always live (resources tick locally); other planets come from the
  // 5s server snapshot. Merge so getTechVisualState always sees the freshest active values.
  const livePlanetData = useMemo(() => {
    if (!planet) return planetData
    return { ...planetData, [planet.id]: { buildings: buildings ?? [], resources } }
  }, [planetData, planet, buildings, resources])

  // Catch any research whose timer expired — runs on mount AND every 2s while on the page,
  // so a missed setTimeout (tab throttled, page reloaded, etc.) doesn't leave research stuck.
  useEffect(() => {
    let cancelled = false
    async function checkCompleted() {
      if (cancelled || !research?.length) return
      const now = new Date()
      const expired = research.filter(
        r => r.is_researching && r.research_complete_at && new Date(r.research_complete_at) <= now
      )
      for (const r of expired) {
        if (cancelled) return
        await supabase.from('research').update({
          level: r.level + 1,
          is_researching: false,
          research_complete_at: null,
        }).eq('id', r.id)
        setResearch(prev => prev.map(pr =>
          pr.tech_type === r.tech_type
            ? { ...pr, level: pr.level + 1, is_researching: false, research_complete_at: null }
            : pr
        ))
      }
    }
    checkCompleted()
    const interval = setInterval(checkCompleted, 2000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [research, setResearch])

  // Multi-planet: poll every 5s for all planets' building+resource snapshot.
  // Used by the visual-state logic AND by the picker.
  useEffect(() => {
    if (!multiPlanet || !planets?.length) return
    let cancelled = false
    async function loadAll() {
      const ids = planets.map(p => p.id)
      const [{ data: bld }, { data: res }] = await Promise.all([
        supabase.from('buildings').select('*').in('planet_id', ids),
        supabase.from('resources').select('*').in('planet_id', ids),
      ])
      if (cancelled) return
      const byPlanet = {}
      planets.forEach(p => {
        byPlanet[p.id] = {
          buildings: (bld ?? []).filter(b => b.planet_id === p.id),
          resources: (res ?? []).find(r => r.planet_id === p.id) ?? null,
        }
      })
      setPlanetData(byPlanet)
    }
    loadAll()
    const interval = setInterval(loadAll, 5000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [multiPlanet, planets])

  // Click → decide modal vs direct research.
  // Bypass the modal only when the ACTIVE planet is the only viable one (per earlier UX call).
  // Otherwise (active not viable but others are, or 2+ viable) show the modal so the user
  // explicitly confirms which planet they're researching from.
  async function onResearchClick(tech, cost) {
    if (anyResearching || researching) return
    const currentLevel = researchMap[tech.type] ?? 0

    if (!multiPlanet) {
      handleResearch(tech, cost, planet, resources, buildings)
      return
    }

    // Use the live snapshot (already kept fresh by the polling effect above)
    const activeData = livePlanetData[planet?.id] ?? { buildings, resources }
    const activeViable = planetCanResearch(tech, cost, activeData.buildings, activeData.resources).ok

    const viable = planets.filter(p => {
      const data = livePlanetData[p.id]
      if (!data?.resources) return false
      return planetCanResearch(tech, cost, data.buildings, data.resources).ok
    })

    if (activeViable && viable.length === 1) {
      // Active is the only viable → research directly, no modal
      handleResearch(tech, cost, planet, resources, buildings)
      return
    }

    // Otherwise: 2+ viable, or active isn't viable but another is → show modal
    setPicker({ tech, cost, currentLevel })
  }

  async function handleResearch(tech, cost, targetPlanet, targetResources, targetBuildings) {
    if (!targetPlanet || researching) return
    setResearching(true)
    setPicker(null)

    const targetLabLvl = targetBuildings?.find(b => b.building_type === 'research_lab')?.level ?? 0
    const researchTime = getResearchTime(cost, targetLabLvl)
    const completeAt = new Date(Date.now() + researchTime * 1000).toISOString()
    const isActivePlanet = targetPlanet.id === planet?.id

    if (isActivePlanet) {
      setResources(prev => prev ? ({
        ...prev,
        metal:     prev.metal - cost.metal,
        crystal:   prev.crystal - cost.crystal,
        deuterium: prev.deuterium - (cost.deuterium ?? 0),
      }) : prev)
    }

    const existing = research?.find(r => r.tech_type === tech.type)
    if (existing) {
      await supabase.from('research').update({
        is_researching: true,
        research_complete_at: completeAt,
      }).eq('id', existing.id)
    } else {
      await supabase.from('research').insert({
        owner_id: targetPlanet.owner_id,
        tech_type: tech.type,
        level: 0,
        is_researching: true,
        research_complete_at: completeAt,
      })
    }

    await supabase.from('resources').update({
      metal:     targetResources.metal - cost.metal,
      crystal:   targetResources.crystal - cost.crystal,
      deuterium: targetResources.deuterium - (cost.deuterium ?? 0),
    }).eq('planet_id', targetPlanet.id)

    setResearch(prev => {
      const exists = prev?.find(r => r.tech_type === tech.type)
      if (exists) {
        return prev.map(r => r.tech_type === tech.type
          ? { ...r, is_researching: true, research_complete_at: completeAt }
          : r
        )
      }
      return [...(prev ?? []), { tech_type: tech.type, level: 0, is_researching: true, research_complete_at: completeAt }]
    })

    setTimeout(async () => {
      const currentLvl = researchMap[tech.type] ?? 0
      await supabase.from('research').update({
        level: currentLvl + 1,
        is_researching: false,
        research_complete_at: null,
      }).eq('owner_id', targetPlanet.owner_id).eq('tech_type', tech.type)

      setResearch(prev => prev.map(r => r.tech_type === tech.type
        ? { ...r, level: r.level + 1, is_researching: false, research_complete_at: null }
        : r
      ))
      setResearching(false)
    }, researchTime * 1000)
  }

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-3 flex-wrap">
        <FlaskConical size={20} className="text-cyan-400" />
        <h2 className="text-xl font-bold text-white">Research</h2>
        <span className="text-xs text-gray-500">
          {multiPlanet
            ? `${planets.length} planets · pick one when researching`
            : `Research Lab Lv. ${labLvl}`}
        </span>
        {anyResearching && (
          <span className="text-xs bg-cyan-900/50 border border-cyan-700 text-cyan-400 px-2 py-1 rounded-full">
            1 researching
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-600 inline-block" /> Available</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-600 inline-block" /> Almost Ready</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-700 inline-block" /> Locked</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {BRANCHES.map(branch => (
          <div key={branch} className="space-y-0">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-cyan-900/40" />
              <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest px-2">{branch}</h3>
              <div className="flex-1 h-px bg-cyan-900/40" />
            </div>

            {TECH_TREE[branch].map((tech, i) => {
              const data = research?.find(r => r.tech_type === tech.type)
              const level = data?.level ?? 0
              const visualState = getTechVisualState({
                tech, level, researchMap,
                multiPlanet,
                activeBuildings: buildings,
                activeResources: resources,
                activePlanetId: planet?.id,
                planets,
                livePlanetData,
              })
              return (
                <TechNode
                  key={tech.type}
                  tech={tech}
                  level={level}
                  isResearching={data?.is_researching ?? false}
                  researchCompleteAt={data?.research_complete_at}
                  visualState={visualState}
                  resources={resources}
                  onResearch={onResearchClick}
                  anyResearching={anyResearching || researching}
                  isLast={i === TECH_TREE[branch].length - 1}
                />
              )
            })}
          </div>
        ))}
      </div>

      {picker && (
        <PlanetPickerModal
          tech={picker.tech}
          cost={picker.cost}
          currentLevel={picker.currentLevel}
          planets={planets}
          planetData={livePlanetData}
          onConfirm={(p, res, bld) => handleResearch(picker.tech, picker.cost, p, res, bld)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}
