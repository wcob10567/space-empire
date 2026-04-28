import { useState, useEffect, useMemo, useCallback } from 'react'
import { FlaskConical, Clock, ChevronUp, Lock, AlertTriangle, X } from 'lucide-react'
import { TECH_TREE, TECH_BRANCHES as BRANCHES } from '../data/techTree'
import { TICK } from '../config/tick'
import { queries } from '../services/queries'
import { addToResearchQueue, cancelResearchQueue, sumResearchReservationByPlanet } from '../services/researchQueue'
import { completeResearchTech } from '../services/completion'
import { useCompletionPoll } from '../hooks/useCompletionPoll'
import { RESEARCH_SLOT_TIERS, countEarnedFreeSlots } from '../data/queueSlots'
import { formatTime } from '../utils/format'
import { scaleCost, computeDuration } from '../utils/formulas'
import QueuePanel from '../components/QueuePanel'

// ─── Helpers ────────────────────────────────────────────────────────────────
const getResearchCost = (tech, currentLevel) => scaleCost(tech.baseCost, 1.75, currentLevel)

const getResearchTime = (cost, labLvl) => computeDuration({
  cost,
  divisor: 1000,
  factor: labLvl,
  minSeconds: 5,
  // research historically didn't apply dev-speed; preserving that parity.
})

// Per-planet feasibility: lab level + AVAILABLE resources (balance − reservation
// FOR THAT PLANET). The picker shows planets where the user can fund the cost
// after subtracting the queue reservation already against that planet.
function planetCanResearch(tech, cost, planetBuildings, planetResources, planetReservation) {
  const labLvl = planetBuildings?.find(b => b.building_type === 'research_lab')?.level ?? 0
  if (labLvl < (tech.requires.lab ?? 0)) {
    return { ok: false, msg: `Need Research Lab Lv. ${tech.requires.lab}`, labLvl }
  }
  const av = {
    metal:     (planetResources?.metal     ?? 0) - (planetReservation?.metal     ?? 0),
    crystal:   (planetResources?.crystal   ?? 0) - (planetReservation?.crystal   ?? 0),
    deuterium: (planetResources?.deuterium ?? 0) - (planetReservation?.deuterium ?? 0),
  }
  if (cost.metal     > av.metal)     return { ok: false, msg: `Short ${(cost.metal     - av.metal    ).toLocaleString()} metal`,     labLvl }
  if (cost.crystal   > av.crystal)   return { ok: false, msg: `Short ${(cost.crystal   - av.crystal  ).toLocaleString()} crystal`,   labLvl }
  if (cost.deuterium > av.deuterium) return { ok: false, msg: `Short ${(cost.deuterium - av.deuterium).toLocaleString()} deuterium`, labLvl }
  return { ok: true, msg: null, labLvl }
}

// effectiveLevel = stored level + queued count + (1 if currently researching the row).
// Cost preview at queue time uses effectiveLevel so a 2nd queue entry for the
// same tech costs the post-1st-queue level.
function effectiveResearchLevel(techType, researchMap, queueRows) {
  const base = researchMap[techType] ?? 0
  const isResearchingThis = (researchMap[`__researching__${techType}`] ?? false) ? 1 : 0
  const queuedThis = (queueRows ?? []).filter(q => q.tech_type === techType).length
  return base + isResearchingThis + queuedThis
}

// Visual state for a tech row. State:
//   researching   → handled by caller (data.is_researching)
//   queued        → at least one row in research_queue for this tech
//   available     → active planet has lab + available resources
//   almost_ready  → multi-planet AND another planet meets the bar
//   locked        → no planet can fund / lab too low / prereqs missing
function getTechVisualState({
  tech, researchMap, queueRows,
  multiPlanet, activeBuildings, activeResources, activeReservation,
  activePlanetId, planets, livePlanetData, reservationByPlanet,
}) {
  const effLvl = effectiveResearchLevel(tech.type, researchMap, queueRows)
  const cost = getResearchCost(tech, effLvl)

  for (const [reqType, reqLvl] of Object.entries(tech.requires)) {
    if (reqType === 'lab') continue
    if ((researchMap[reqType] ?? 0) < reqLvl) {
      const reqTech = Object.values(TECH_TREE).flat().find(t => t.type === reqType)
      return { state: 'locked', msg: `Need ${reqTech?.name ?? reqType} Lv. ${reqLvl}`, cost, effLvl }
    }
  }

  const activeCheck = planetCanResearch(tech, cost, activeBuildings, activeResources, activeReservation)
  if (activeCheck.ok) return { state: 'available', msg: null, cost, effLvl }

  if (!multiPlanet) {
    return { state: 'locked', msg: activeCheck.msg, cost, effLvl }
  }

  const anyOtherViable = (planets ?? []).some(p => {
    if (p.id === activePlanetId) return false
    const data = livePlanetData?.[p.id]
    if (!data?.resources) return false
    const otherRes = reservationByPlanet?.[p.id] ?? { metal: 0, crystal: 0, deuterium: 0 }
    return planetCanResearch(tech, cost, data.buildings, data.resources, otherRes).ok
  })

  if (anyOtherViable) {
    return { state: 'almost_ready', msg: 'Available on another planet', cost, effLvl }
  }

  const maxLab = Math.max(0, ...((planets ?? []).map(p => {
    const data = livePlanetData?.[p.id]
    return data?.buildings?.find(b => b.building_type === 'research_lab')?.level ?? 0
  })))
  if (maxLab < (tech.requires.lab ?? 0)) {
    return { state: 'locked', msg: `Need Research Lab Lv. ${tech.requires.lab}`, cost, effLvl }
  }
  return { state: 'locked', msg: 'Insufficient resources', cost, effLvl }
}

// ─── Planet Picker Modal ─────────────────────────────────────────────────────
function PlanetPickerModal({ tech, cost, currentLevel, planets, planetData, reservationByPlanet, onConfirm, onClose }) {
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
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Queue from:</p>
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
            const planetReservation = reservationByPlanet?.[p.id] ?? { metal: 0, crystal: 0, deuterium: 0 }
            const check = planetCanResearch(tech, cost, data.buildings, data.resources, planetReservation)
            const time = getResearchTime(cost, check.labLvl)
            return (
              <button
                key={p.id}
                disabled={!check.ok}
                onClick={() => onConfirm(p, time)}
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
function TechNode({ tech, level, isResearching, researchCompleteAt, queuedCount, visualState, onResearch, slotsFull, submitting, isLast }) {
  const [timeLeft, setTimeLeft] = useState(0)
  const { state, msg, cost, effLvl } = visualState
  const isLocked = !isResearching && state === 'locked'
  const isAlmostReady = !isResearching && state === 'almost_ready'

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

  const targetLvl = effLvl + 1
  const buttonDisabled = isLocked || slotsFull || submitting

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
            {queuedCount > 0 && (
              <p className="text-xs text-yellow-400">+{queuedCount} queued</p>
            )}
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
              {cost.metal > 0     && <span className="text-gray-600">⛏️ {cost.metal.toLocaleString()}</span>}
              {cost.crystal > 0   && <span className="text-gray-600">💎 {cost.crystal.toLocaleString()}</span>}
              {cost.deuterium > 0 && <span className="text-gray-600">🔵 {cost.deuterium.toLocaleString()}</span>}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {isAlmostReady && (
              <div className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-2">
                <AlertTriangle size={12} className="text-yellow-500 shrink-0" />
                <span className="text-yellow-500 text-xs">{msg}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              {cost.metal > 0     && <span className="text-gray-400">⛏️ {cost.metal.toLocaleString()}</span>}
              {cost.crystal > 0   && <span className="text-gray-400">💎 {cost.crystal.toLocaleString()}</span>}
              {cost.deuterium > 0 && <span className="text-gray-400">🔵 {cost.deuterium.toLocaleString()}</span>}
            </div>
            <button
              onClick={() => onResearch(tech, cost)}
              disabled={buttonDisabled}
              title={
                slotsFull ? 'Research queue is full' :
                undefined
              }
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                !buttonDisabled
                  ? (isAlmostReady
                      ? 'bg-yellow-800 hover:bg-yellow-700 text-yellow-100'
                      : 'bg-cyan-700 hover:bg-cyan-600 text-white')
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              <ChevronUp size={14} />
              Queue Lv. {targetLvl}
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
export default function Research({
  planet, planets, resources, buildings, research, setResearch,
  researchQueue, setResearchQueue, reservation,
}) {
  const [submitting, setSubmitting] = useState(false)
  const [picker, setPicker] = useState(null)        // { tech, cost, currentLevel, effLvl } when modal open
  const [planetData, setPlanetData] = useState({})  // { [planetId]: { buildings, resources } } — server snapshot

  const labLvl = buildings?.find(b => b.building_type === 'research_lab')?.level ?? 0
  const anyResearching = research?.some(r => r.is_researching) ?? false
  const multiPlanet = (planets?.length ?? 0) > 1

  const researchMap = {}
  research?.forEach(r => {
    researchMap[r.tech_type] = r.level
    if (r.is_researching) researchMap[`__researching__${r.tech_type}`] = true
  })

  // Slot count: research is account-wide, max-across-planets levels for slot tier checks.
  const labLevels = (planets ?? []).map(p => {
    const data = planet?.id === p.id ? { buildings } : planetData[p.id]
    return data?.buildings?.find(b => b.building_type === 'research_lab')?.level ?? 0
  })
  const roboticsLevels = (planets ?? []).map(p => {
    const data = planet?.id === p.id ? { buildings } : planetData[p.id]
    return data?.buildings?.find(b => b.building_type === 'robotics_factory')?.level ?? 0
  })
  const maxResearchLab = Math.max(0, labLvl, ...labLevels)
  const maxRobotics    = Math.max(0, ...roboticsLevels)

  const maxSlots = countEarnedFreeSlots(RESEARCH_SLOT_TIERS, { researchLab: maxResearchLab, robotics: maxRobotics })
  const queueLen = researchQueue?.length ?? 0
  const slotsUsed = (anyResearching ? 1 : 0) + queueLen
  const slotsFull = slotsUsed >= maxSlots

  // Per-planet reservation map (research costs only — building/ship reservations
  // are summed against resources separately by App.jsx for the active planet).
  const researchReservationByPlanet = useMemo(
    () => sumResearchReservationByPlanet(researchQueue),
    [researchQueue]
  )

  // Active planet's reservation = the App-level reservation that's already
  // been merged for this planet (build + ship + research).
  const activeReservation = reservation ?? { metal: 0, crystal: 0, deuterium: 0 }

  // Live snapshot: active planet uses fresh state, other planets use 5s server poll.
  const livePlanetData = useMemo(() => {
    if (!planet) return planetData
    return { ...planetData, [planet.id]: { buildings: buildings ?? [], resources } }
  }, [planetData, planet, buildings, resources])

  // 2s completion check (catches missed setTimeouts after speed change / reload).
  // Uses tech_type as matchKey because research is keyed account-wide on it.
  const completeResearch = useCallback(
    (id, level) => completeResearchTech(id, level),
    []
  )
  useCompletionPoll({
    items: research,
    setItems: setResearch,
    flagKey: 'is_researching',
    completeAtKey: 'research_complete_at',
    complete: completeResearch,
    matchKey: 'tech_type',
  })

  // Multi-planet poll (every 5s) — used by visual state + picker
  useEffect(() => {
    if (!multiPlanet || !planets?.length) return
    let cancelled = false
    async function loadAll() {
      const ids = planets.map(p => p.id)
      const [{ data: bld }, { data: res }] = await Promise.all([
        queries.buildingsForPlanets(ids),
        queries.resourcesForPlanets(ids),
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
    const interval = setInterval(loadAll, TICK.RESEARCH_PLANET_DATA_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [multiPlanet, planets])

  function onResearchClick(tech, cost) {
    if (slotsFull || submitting) return
    const currentLevel = researchMap[tech.type] ?? 0
    const effLvl = effectiveResearchLevel(tech.type, researchMap, researchQueue)

    if (!multiPlanet) {
      handleQueue(tech, cost, planet, getResearchTime(cost, labLvl))
      return
    }

    // Use the live snapshot
    const activeData = livePlanetData[planet?.id] ?? { buildings, resources }
    const activeReservation = researchReservationByPlanet[planet?.id] ?? { metal: 0, crystal: 0, deuterium: 0 }
    const activeViable = planetCanResearch(tech, cost, activeData.buildings, activeData.resources, activeReservation).ok

    const viable = planets.filter(p => {
      const data = livePlanetData[p.id]
      if (!data?.resources) return false
      const planetRes = researchReservationByPlanet[p.id] ?? { metal: 0, crystal: 0, deuterium: 0 }
      return planetCanResearch(tech, cost, data.buildings, data.resources, planetRes).ok
    })

    if (activeViable && viable.length === 1) {
      handleQueue(tech, cost, planet, getResearchTime(cost, labLvl))
      return
    }

    setPicker({ tech, cost, currentLevel, effLvl })
  }

  async function handleQueue(tech, cost, sourcePlanet, researchSeconds) {
    if (!sourcePlanet || submitting) return
    setSubmitting(true)
    setPicker(null)

    try {
      const row = await addToResearchQueue({
        ownerId: sourcePlanet.owner_id,
        techType: tech.type,
        sourcePlanetId: sourcePlanet.id,
        cost,
        researchSeconds,
      })
      setResearchQueue(prev => [...prev, row])
    } catch (err) {
      console.error('Add to research queue failed:', err)
      alert(`Couldn't queue: ${err.message ?? 'unknown error'}.`)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(queueRowId) {
    if (submitting) return
    setSubmitting(true)
    try {
      await cancelResearchQueue(queueRowId)
      setResearchQueue(prev => prev.filter(q => q.id !== queueRowId))
    } catch (err) {
      console.error('Cancel research queue failed:', err)
      alert(`Couldn't cancel: ${err.message ?? 'unknown error'}.`)
    } finally {
      setSubmitting(false)
    }
  }

  // Build inFlight + queue items for QueuePanel
  const activeResearch = research?.find(r => r.is_researching) ?? null
  const inFlight = activeResearch ? (() => {
    const tech = Object.values(TECH_TREE).flat().find(t => t.type === activeResearch.tech_type)
    return {
      icon: tech?.icon ?? '🔬',
      label: `${tech?.name ?? activeResearch.tech_type} → Lv. ${activeResearch.level + 1}`,
      completeAt: activeResearch.research_complete_at,
    }
  })() : null

  const queue = (researchQueue ?? []).map(q => {
    const tech = Object.values(TECH_TREE).flat().find(t => t.type === q.tech_type)
    const sourcePlanet = planets?.find(p => p.id === q.source_planet_id)
    return {
      id: q.id,
      icon: tech?.icon ?? '🔬',
      label: `${tech?.name ?? q.tech_type}${sourcePlanet ? ` · from ${sourcePlanet.name}` : ''}`,
      duration: q.research_seconds,
      cost: { metal: q.cost_metal, crystal: q.cost_crystal, deuterium: q.cost_deuterium },
    }
  })

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-3 flex-wrap">
        <FlaskConical size={20} className="text-cyan-400" />
        <h2 className="text-xl font-bold text-white">Research</h2>
        <span className="text-xs text-gray-500">
          {multiPlanet
            ? `${planets.length} planets · pick one when queuing`
            : `Research Lab Lv. ${labLvl}`}
        </span>
        {anyResearching && (
          <span className="text-xs bg-cyan-900/50 border border-cyan-700 text-cyan-400 px-2 py-1 rounded-full">
            1 researching
          </span>
        )}
        {slotsFull && (
          <span className="text-xs bg-yellow-900/50 border border-yellow-800 text-yellow-400 px-2 py-1 rounded-full">
            queue full
          </span>
        )}
      </div>

      <QueuePanel
        title="Research queue"
        inFlight={inFlight}
        queue={queue}
        slotInfo={{
          tiers: RESEARCH_SLOT_TIERS,
          levels: { researchLab: maxResearchLab, robotics: maxRobotics },
          boughtSlots: 0,
          used: slotsUsed,
        }}
        onCancel={handleCancel}
        submitting={submitting}
      />

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
              const queuedCount = (researchQueue ?? []).filter(q => q.tech_type === tech.type).length
              const visualState = getTechVisualState({
                tech, researchMap,
                queueRows: researchQueue,
                multiPlanet,
                activeBuildings: buildings,
                activeResources: resources,
                activeReservation,
                activePlanetId: planet?.id,
                planets,
                livePlanetData,
                reservationByPlanet: researchReservationByPlanet,
              })
              return (
                <TechNode
                  key={tech.type}
                  tech={tech}
                  level={level}
                  isResearching={data?.is_researching ?? false}
                  researchCompleteAt={data?.research_complete_at}
                  queuedCount={queuedCount}
                  visualState={visualState}
                  onResearch={onResearchClick}
                  slotsFull={slotsFull}
                  submitting={submitting}
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
          currentLevel={picker.effLvl}
          planets={planets}
          planetData={livePlanetData}
          reservationByPlanet={researchReservationByPlanet}
          onConfirm={(p, time) => handleQueue(picker.tech, picker.cost, p, time)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}
