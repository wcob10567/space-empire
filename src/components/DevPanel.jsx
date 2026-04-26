import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Terminal, ChevronDown, ChevronUp, Zap, Coins, Building2, FlaskConical, Rocket, RotateCcw } from 'lucide-react'

const BUILDING_TYPES = [
  'metal_mine', 'crystal_mine', 'deuterium_synthesizer', 'solar_plant',
  'fusion_reactor', 'metal_storage', 'crystal_storage', 'deuterium_tank',
  'robotics_factory', 'shipyard', 'research_lab', 'nanite_factory', 
  'missile_silo', 'underground_vault',
]

const TECH_TYPES = [
  'energy_tech', 'laser_tech', 'ion_tech', 'weapons_tech', 'shielding_tech', 'armor_tech',
  'combustion_drive', 'impulse_drive', 'hyperspace_drive', 'hyperspace_tech', 'graviton_tech',
  'espionage_tech', 'computer_tech', 'astrophysics', 'intergalactic_research', 'plasma_tech',
]

const SHIP_TYPES = [
  'light_fighter', 'heavy_fighter', 'cruiser', 'battleship', 'bomber',
  'destroyer', 'deathstar', 'colony_ship', 'recycler', 'espionage_probe',
]

const SPEED_OPTIONS = [
  { label: '1x (normal)', value: 1 },
  { label: '10x faster', value: 0.1 },
  { label: '100x faster', value: 0.01 },
  { label: 'Instant (0.001x)', value: 0.001 },
]

// Global speed multiplier — imported by Buildings, Research, Shipyard
export let devSpeedMultiplier = 1

export default function DevPanel({ planet, resources, buildings, research, ships, setResources, setBuildings, setResearch, setShips }) {
  const [open, setOpen] = useState(false)
  const [activeSection, setActiveSection] = useState(null)
  const [speed, setSpeed] = useState(1)
  const [metalAmt, setMetalAmt] = useState(100000)
  const [crystalAmt, setCrystalAmt] = useState(100000)
  const [deuteriumAmt, setDeuteriumAmt] = useState(100000)
  const [buildingType, setBuildingType] = useState('metal_mine')
  const [buildingLevel, setBuildingLevel] = useState(10)
  const [techType, setTechType] = useState('energy_tech')
  const [techLevel, setTechLevel] = useState(5)
  const [shipType, setShipType] = useState('light_fighter')
  const [shipQty, setShipQty] = useState(100)
  const [log, setLog] = useState([])

  if (!import.meta.env.DEV) return null

  function addLog(msg) {
    setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 9)])
  }

  function setSpeedMultiplier(val) {
  setSpeed(val)
  window.__devSpeed = val
  addLog(`Speed set to ${1/val}x faster`)
}

  async function addResources() {
    if (!planet) return
    const newMetal = Math.min((resources?.metal ?? 0) + metalAmt, resources?.metal_cap ?? 10000000)
    const newCrystal = Math.min((resources?.crystal ?? 0) + crystalAmt, resources?.crystal_cap ?? 10000000)
    const newDeuterium = Math.min((resources?.deuterium ?? 0) + deuteriumAmt, resources?.deuterium_cap ?? 10000000)
    await supabase.from('resources').update({ metal: newMetal, crystal: newCrystal, deuterium: newDeuterium }).eq('planet_id', planet.id)
    setResources(prev => ({ ...prev, metal: newMetal, crystal: newCrystal, deuterium: newDeuterium }))
    addLog(`Added ${metalAmt.toLocaleString()} metal, ${crystalAmt.toLocaleString()} crystal, ${deuteriumAmt.toLocaleString()} deuterium`)
  }

  async function maxResources() {
    if (!planet) return
    const cap = 999999999
    await supabase.from('resources').update({
      metal: cap, crystal: cap, deuterium: cap,
      metal_cap: cap, crystal_cap: cap, deuterium_cap: cap,
    }).eq('planet_id', planet.id)
    setResources(prev => ({ ...prev, metal: cap, crystal: cap, deuterium: cap, metal_cap: cap, crystal_cap: cap, deuterium_cap: cap }))
    addLog('Resources maxed out!')
  }

  async function setBuilding() {
    if (!planet) return
    await supabase.from('buildings').update({ level: buildingLevel, is_upgrading: false, upgrade_complete_at: null })
      .eq('planet_id', planet.id).eq('building_type', buildingType)
    setBuildings(prev => prev.map(b => b.building_type === buildingType ? { ...b, level: buildingLevel, is_upgrading: false, upgrade_complete_at: null } : b))
    addLog(`${buildingType} set to level ${buildingLevel}`)
  }

  async function maxAllBuildings() {
    if (!planet) return
    for (const type of BUILDING_TYPES) {
      await supabase.from('buildings').update({ level: 30, is_upgrading: false, upgrade_complete_at: null })
        .eq('planet_id', planet.id).eq('building_type', type)
    }
    setBuildings(prev => prev.map(b => ({ ...b, level: 30, is_upgrading: false, upgrade_complete_at: null })))
    addLog('All buildings set to level 30!')
  }

  async function setTech() {
    if (!planet) return
    const existing = research?.find(r => r.tech_type === techType)
    if (existing) {
      await supabase.from('research').update({ level: techLevel, is_researching: false, research_complete_at: null }).eq('id', existing.id)
      setResearch(prev => prev.map(r => r.tech_type === techType ? { ...r, level: techLevel, is_researching: false, research_complete_at: null } : r))
    } else {
      const { data } = await supabase.from('research').insert({ owner_id: planet.owner_id, tech_type: techType, level: techLevel }).select().single()
      if (data) setResearch(prev => [...(prev ?? []), data])
    }
    addLog(`${techType} set to level ${techLevel}`)
  }

  async function maxAllTech() {
    if (!planet) return
    for (const type of TECH_TYPES) {
      const existing = research?.find(r => r.tech_type === type)
      if (existing) {
        await supabase.from('research').update({ level: 25, is_researching: false, research_complete_at: null }).eq('id', existing.id)
      } else {
        await supabase.from('research').insert({ owner_id: planet.owner_id, tech_type: type, level: 25 })
      }
    }
    const { data } = await supabase.from('research').select('*').eq('owner_id', planet.owner_id)
    if (data) setResearch(data)
    addLog('All research maxed to level 25!')
  }

  async function addShips() {
    if (!planet) return
    const existing = ships?.find(s => s.ship_type === shipType)
    if (existing) {
      await supabase.from('ships').update({ quantity: existing.quantity + shipQty }).eq('planet_id', planet.id).eq('ship_type', shipType)
      setShips(prev => prev.map(s => s.ship_type === shipType ? { ...s, quantity: s.quantity + shipQty } : s))
    } else {
      const { data } = await supabase.from('ships').insert({ planet_id: planet.id, ship_type: shipType, quantity: shipQty }).select().single()
      if (data) setShips(prev => [...(prev ?? []), data])
    }
    addLog(`Added ${shipQty}x ${shipType}`)
  }

  async function addAllShips() {
    if (!planet) return
    for (const type of SHIP_TYPES) {
      const existing = ships?.find(s => s.ship_type === type)
      if (existing) {
        await supabase.from('ships').update({ quantity: existing.quantity + 100 }).eq('planet_id', planet.id).eq('ship_type', type)
      } else {
        await supabase.from('ships').insert({ planet_id: planet.id, ship_type: type, quantity: 100 })
      }
    }
    const { data } = await supabase.from('ships').select('*').eq('planet_id', planet.id)
    if (data) setShips(data)
    addLog('Added 100 of every ship type!')
  }

  async function clearFleets() {
    if (!planet) return
    await supabase.from('fleets').delete().eq('owner_id', planet.owner_id)
    addLog('All fleets cleared!')
  }

  async function resetPlanet() {
    if (!planet) return
    await supabase.from('resources').update({ metal: 500, crystal: 300, deuterium: 100, metal_cap: 10000, crystal_cap: 10000, deuterium_cap: 10000 }).eq('planet_id', planet.id)
    for (const type of BUILDING_TYPES) {
      await supabase.from('buildings').update({ level: 0, is_upgrading: false, upgrade_complete_at: null }).eq('planet_id', planet.id).eq('building_type', type)
    }
    await supabase.from('research').delete().eq('owner_id', planet.owner_id)
    await supabase.from('ships').delete().eq('planet_id', planet.id)
    await supabase.from('fleets').delete().eq('owner_id', planet.owner_id)
    setResources(prev => ({ ...prev, metal: 500, crystal: 300, deuterium: 100, metal_cap: 10000, crystal_cap: 10000, deuterium_cap: 10000 }))
    setBuildings(prev => prev.map(b => ({ ...b, level: 0, is_upgrading: false, upgrade_complete_at: null })))
    setResearch([])
    setShips([])
    addLog('Planet reset to starting state!')
  }

  function Section({ id, label, icon: Icon, children }) {
    const isOpen = activeSection === id
    return (
      <div className="border border-gray-700 rounded-lg overflow-hidden">
        <button onClick={() => setActiveSection(isOpen ? null : id)} className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-750 text-left">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Icon size={14} className="text-green-400" />
            {label}
          </div>
          {isOpen ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
        </button>
        {isOpen && <div className="p-3 space-y-3 bg-gray-900">{children}</div>}
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 bg-green-900/80 border border-green-700 rounded-xl text-green-400 text-sm font-mono font-bold hover:bg-green-900 transition-all mb-2"
      >
        <div className="flex items-center gap-2">
          <Terminal size={16} />
          DEV PANEL
        </div>
        <span className="text-green-600 text-xs">{speed < 1 ? `${1/speed}x speed` : 'normal'}</span>
      </button>

      {open && (
        <div className="bg-gray-900 border border-green-800/50 rounded-xl p-3 space-y-2 max-h-96 overflow-y-auto">

          {/* Speed */}
          <Section id="speed" label="Speed Controls" icon={Zap}>
            <div className="grid grid-cols-2 gap-2">
              {SPEED_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setSpeedMultiplier(opt.value)}
                  className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${speed === opt.value ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Resources */}
          <Section id="resources" label="Resources" icon={Coins}>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1">
                {[['Metal', metalAmt, setMetalAmt], ['Crystal', crystalAmt, setCrystalAmt], ['Deut', deuteriumAmt, setDeuteriumAmt]].map(([label, val, setter]) => (
                  <div key={label}>
                    <label className="text-xs text-gray-500 block mb-0.5">{label}</label>
                    <input type="number" value={val} onChange={e => setter(parseInt(e.target.value) || 0)}
                      className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={addResources} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-green-400 rounded text-xs font-medium">+ Add</button>
                <button onClick={maxResources} className="flex-1 py-1.5 bg-green-900/50 hover:bg-green-800/50 text-green-400 rounded text-xs font-medium border border-green-800">MAX ALL</button>
              </div>
            </div>
          </Section>

          {/* Buildings */}
          <Section id="buildings" label="Buildings" icon={Building2}>
            <div className="space-y-2">
              <div className="flex gap-2">
                <select value={buildingType} onChange={e => setBuildingType(e.target.value)}
                  className="flex-1 bg-gray-800 text-white text-xs rounded px-2 py-1">
                  {BUILDING_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
                <input type="number" value={buildingLevel} onChange={e => setBuildingLevel(parseInt(e.target.value) || 0)}
                  className="w-16 bg-gray-800 text-white text-xs rounded px-2 py-1 text-center" />
              </div>
              <div className="flex gap-2">
                <button onClick={setBuilding} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-green-400 rounded text-xs font-medium">Set Level</button>
                <button onClick={maxAllBuildings} className="flex-1 py-1.5 bg-green-900/50 hover:bg-green-800/50 text-green-400 rounded text-xs font-medium border border-green-800">MAX ALL</button>
              </div>
            </div>
          </Section>

          {/* Research */}
          <Section id="research" label="Research" icon={FlaskConical}>
            <div className="space-y-2">
              <div className="flex gap-2">
                <select value={techType} onChange={e => setTechType(e.target.value)}
                  className="flex-1 bg-gray-800 text-white text-xs rounded px-2 py-1">
                  {TECH_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
                <input type="number" value={techLevel} onChange={e => setTechLevel(parseInt(e.target.value) || 0)}
                  className="w-16 bg-gray-800 text-white text-xs rounded px-2 py-1 text-center" />
              </div>
              <div className="flex gap-2">
                <button onClick={setTech} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-green-400 rounded text-xs font-medium">Set Level</button>
                <button onClick={maxAllTech} className="flex-1 py-1.5 bg-green-900/50 hover:bg-green-800/50 text-green-400 rounded text-xs font-medium border border-green-800">MAX ALL</button>
              </div>
            </div>
          </Section>

          {/* Ships */}
          <Section id="ships" label="Ships" icon={Rocket}>
            <div className="space-y-2">
              <div className="flex gap-2">
                <select value={shipType} onChange={e => setShipType(e.target.value)}
                  className="flex-1 bg-gray-800 text-white text-xs rounded px-2 py-1">
                  {SHIP_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
                <input type="number" value={shipQty} onChange={e => setShipQty(parseInt(e.target.value) || 0)}
                  className="w-16 bg-gray-800 text-white text-xs rounded px-2 py-1 text-center" />
              </div>
              <div className="flex gap-2">
                <button onClick={addShips} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-green-400 rounded text-xs font-medium">Add Ships</button>
                <button onClick={addAllShips} className="flex-1 py-1.5 bg-green-900/50 hover:bg-green-800/50 text-green-400 rounded text-xs font-medium border border-green-800">ALL ×100</button>
              </div>
            </div>
          </Section>

          {/* Danger zone */}
          <Section id="danger" label="Danger Zone" icon={RotateCcw}>
            <div className="space-y-2">
              <button onClick={clearFleets} className="w-full py-1.5 bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400 rounded text-xs font-medium border border-yellow-800">
                🗑️ Clear All Fleets
              </button>
              <button onClick={resetPlanet} className="w-full py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-xs font-medium border border-red-800">
                ⚠️ Reset Planet to Start
              </button>
            </div>
          </Section>

          {/* Log */}
          {log.length > 0 && (
            <div className="bg-black/50 rounded-lg p-2 space-y-1">
              {log.map((entry, i) => (
                <p key={i} className="text-xs font-mono text-green-500">{entry}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}