import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { FlaskConical, Clock, ChevronUp, Lock, AlertTriangle } from 'lucide-react'

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

// Returns the single most important blocker for this tech
function getBlocker(tech, researchMap, labLvl, resources, cost) {
  // Check lab level
  if (labLvl < (tech.requires.lab ?? 0)) {
    return { type: 'building', msg: `Need Research Lab Lv. ${tech.requires.lab}` }
  }
  // Check tech prerequisites
  for (const [reqType, reqLvl] of Object.entries(tech.requires)) {
    if (reqType === 'lab') continue
    const have = researchMap[reqType] ?? 0
    if (have < reqLvl) {
      const reqTech = Object.values(TECH_TREE).flat().find(t => t.type === reqType)
      return { type: 'research', msg: `Need ${reqTech?.name ?? reqType} Lv. ${reqLvl}` }
    }
  }
  // Check resources
  const missing = []
  if (cost.metal > (resources?.metal ?? 0)) missing.push(`${(cost.metal - (resources?.metal ?? 0)).toLocaleString()} metal`)
  if (cost.crystal > (resources?.crystal ?? 0)) missing.push(`${(cost.crystal - (resources?.crystal ?? 0)).toLocaleString()} crystal`)
  if (cost.deuterium > (resources?.deuterium ?? 0)) missing.push(`${(cost.deuterium - (resources?.deuterium ?? 0)).toLocaleString()} deuterium`)
  if (missing.length > 0) return { type: 'resources', msg: `Need ${missing[0]} more` }
  return null
}

// ─── TechNode Component ──────────────────────────────────────────────────────
function TechNode({ tech, level, isResearching, researchCompleteAt, researchMap, labLvl, resources, onResearch, anyResearching, isLast }) {
  const [timeLeft, setTimeLeft] = useState(0)
  const cost = getResearchCost(tech, level)
  const blocker = getBlocker(tech, researchMap, labLvl, resources, cost)
  const isLocked = blocker?.type === 'building' || blocker?.type === 'research'
  const isAffordable = !blocker
  const isAlmostReady = blocker?.type === 'resources'

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

  return (
    <div className="flex flex-col items-center">
      {/* Node card */}
      <div className={`w-full border rounded-xl p-4 transition-all relative ${
        isResearching ? 'border-cyan-500 bg-cyan-950/30' :
        isLocked      ? 'border-gray-800 bg-gray-900/50 opacity-60' :
        isAlmostReady ? 'border-yellow-800 bg-gray-900' :
        isAffordable  ? 'border-cyan-800 bg-gray-900 hover:border-cyan-600' :
                        'border-gray-800 bg-gray-900'
      }`}>
        {/* Lock icon */}
        {isLocked && (
          <div className="absolute top-3 right-3">
            <Lock size={14} className="text-gray-600" />
          </div>
        )}

        {/* Header */}
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

        {/* Researching state */}
        {isResearching ? (
          <div className="bg-cyan-950/50 border border-cyan-800 rounded-lg p-2 flex items-center gap-2">
            <Clock size={14} className="text-cyan-400 animate-pulse" />
            <span className="text-cyan-400 text-xs font-mono">{formatTime(timeLeft)}</span>
            <span className="text-gray-500 text-xs ml-auto">→ Lv. {level + 1}</span>
          </div>
        ) : isLocked ? (
          /* Locked state */
          <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-2">
            <Lock size={12} className="text-gray-600 shrink-0" />
            <span className="text-gray-600 text-xs">{blocker?.msg}</span>
          </div>
        ) : isAlmostReady ? (
          /* Almost ready state */
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-2">
              <AlertTriangle size={12} className="text-yellow-500 shrink-0" />
              <span className="text-yellow-500 text-xs">{blocker?.msg}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {cost.metal > 0 && <span className={cost.metal > (resources?.metal ?? 0) ? 'text-red-400' : 'text-gray-500'}>⛏️ {cost.metal.toLocaleString()}</span>}
              {cost.crystal > 0 && <span className={cost.crystal > (resources?.crystal ?? 0) ? 'text-red-400' : 'text-gray-500'}>💎 {cost.crystal.toLocaleString()}</span>}
              {cost.deuterium > 0 && <span className={cost.deuterium > (resources?.deuterium ?? 0) ? 'text-red-400' : 'text-gray-500'}>🔵 {cost.deuterium.toLocaleString()}</span>}
            </div>
            <button disabled className="w-full py-2 rounded-lg text-xs font-semibold bg-gray-800 text-gray-600 cursor-not-allowed">
              Insufficient Resources
            </button>
          </div>
        ) : (
          /* Available state */
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              {cost.metal > 0 && <span className="text-gray-400">⛏️ {cost.metal.toLocaleString()}</span>}
              {cost.crystal > 0 && <span className="text-gray-400">💎 {cost.crystal.toLocaleString()}</span>}
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

      {/* Connector line to next node */}
      {!isLast && (
        <div className={`w-0.5 h-6 my-1 ${level > 0 ? 'bg-cyan-700' : 'bg-gray-700'}`} />
      )}
    </div>
  )
}

// ─── Main Research Page ──────────────────────────────────────────────────────
export default function Research({ planet, resources, buildings, research, setResearch, setResources }) {
  const [researching, setResearching] = useState(false)

  const labLvl = buildings?.find(b => b.building_type === 'research_lab')?.level ?? 0
  const anyResearching = research?.some(r => r.is_researching) ?? false

  // Map research types to levels for easy lookup
  const researchMap = {}
  research?.forEach(r => { researchMap[r.tech_type] = r.level })

  async function handleResearch(tech, cost) {
    if (!planet || researching) return
    setResearching(true)

    const researchTime = getResearchTime(cost, labLvl)
    const completeAt = new Date(Date.now() + researchTime * 1000).toISOString()

    // Deduct resources locally
    setResources(prev => ({
      ...prev,
      metal:     prev.metal - cost.metal,
      crystal:   prev.crystal - cost.crystal,
      deuterium: prev.deuterium - (cost.deuterium ?? 0),
    }))

    // Check if research row exists
    const existing = research?.find(r => r.tech_type === tech.type)

    if (existing) {
      await supabase.from('research').update({
        is_researching: true,
        research_complete_at: completeAt,
      }).eq('id', existing.id)
    } else {
      await supabase.from('research').insert({
        owner_id: planet.owner_id,
        tech_type: tech.type,
        level: 0,
        is_researching: true,
        research_complete_at: completeAt,
      })
    }

    // Deduct resources in DB
    await supabase.from('resources').update({
      metal:     resources.metal - cost.metal,
      crystal:   resources.crystal - cost.crystal,
      deuterium: resources.deuterium - (cost.deuterium ?? 0),
    }).eq('planet_id', planet.id)

    // Update local research state
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

    // Complete after timer
    setTimeout(async () => {
      const currentLvl = researchMap[tech.type] ?? 0
      await supabase.from('research').update({
        level: currentLvl + 1,
        is_researching: false,
        research_complete_at: null,
      }).eq('owner_id', planet.owner_id).eq('tech_type', tech.type)

      setResearch(prev => prev.map(r => r.tech_type === tech.type
        ? { ...r, level: r.level + 1, is_researching: false, research_complete_at: null }
        : r
      ))
      setResearching(false)
    }, researchTime * 1000)
  }

  return (
    <div className="space-y-4 w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FlaskConical size={20} className="text-cyan-400" />
        <h2 className="text-xl font-bold text-white">Research</h2>
        <span className="text-xs text-gray-500">Research Lab Lv. {labLvl}</span>
        {anyResearching && (
          <span className="text-xs bg-cyan-900/50 border border-cyan-700 text-cyan-400 px-2 py-1 rounded-full">
            1 researching
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-600 inline-block" /> Available</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-600 inline-block" /> Almost Ready</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-700 inline-block" /> Locked</span>
      </div>

      {/* Three branch columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {BRANCHES.map(branch => (
          <div key={branch} className="space-y-0">
            {/* Branch header */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-cyan-900/40" />
              <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest px-2">{branch}</h3>
              <div className="flex-1 h-px bg-cyan-900/40" />
            </div>

            {/* Tech nodes */}
            {TECH_TREE[branch].map((tech, i) => {
              const data = research?.find(r => r.tech_type === tech.type)
              return (
                <TechNode
                  key={tech.type}
                  tech={tech}
                  level={data?.level ?? 0}
                  isResearching={data?.is_researching ?? false}
                  researchCompleteAt={data?.research_complete_at}
                  researchMap={researchMap}
                  labLvl={labLvl}
                  resources={resources}
                  onResearch={handleResearch}
                  anyResearching={anyResearching}
                  isLast={i === TECH_TREE[branch].length - 1}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}