import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { FileText, Shield, Sword, Search, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

const SHIP_NAMES = {
  light_fighter: 'Light Fighter', heavy_fighter: 'Heavy Fighter',
  cruiser: 'Cruiser', battleship: 'Battleship', bomber: 'Bomber',
  destroyer: 'Destroyer', deathstar: 'Deathstar', colony_ship: 'Colony Ship',
  recycler: 'Recycler', espionage_probe: 'Espionage Probe',
  rocket_launcher: 'Rocket Launcher', light_laser: 'Light Laser',
  heavy_laser: 'Heavy Laser', ion_cannon: 'Ion Cannon',
  plasma_turret: 'Plasma Turret', shield_dome_small: 'Small Shield Dome',
  shield_dome_large: 'Large Shield Dome',
}

function formatTime(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleString()
}

// ─── Helper to format a number with ~ if estimate ────────────────────────────
function formatValue(value, isEstimate) {
  if (value === undefined || value === null) return '?'
  const num = Math.floor(value).toLocaleString()
  return isEstimate ? `~${num}` : num
}

function ShipList({ ships, label, color, isEstimate }) {
  if (!ships) return null
  // Filter out the is_estimate flag key
  const entries = Object.entries(ships).filter(([key]) => key !== 'is_estimate' && ships[key] > 0)
  if (entries.length === 0) return (
    <p className="text-xs text-gray-600 italic">None</p>
  )
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([type, qty]) => (
        <span key={type} className={`text-xs px-2 py-1 rounded bg-gray-800 ${color} ${isEstimate ? 'opacity-80' : ''}`}>
          {isEstimate && <span className="text-yellow-500 mr-1">~</span>}
          {SHIP_NAMES[type] ?? type} ×{Math.floor(qty)}
        </span>
      ))}
    </div>
  )
}

// ─── Combat Report Card ───────────────────────────────────────────────────────
function CombatReportCard({ report, currentUserId, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const isAttacker = report.attacker_id === currentUserId
  const won = isAttacker ? report.attacker_won : !report.attacker_won
  const plunder = report.resources_plundered ?? {}
  const debris = report.debris_created ?? {}
  const hasPlunder = plunder.metal > 0 || plunder.crystal > 0 || plunder.deuterium > 0
  const hasDebris = debris.metal > 0 || debris.crystal > 0

  return (
    <div className={`bg-gray-900 border rounded-xl overflow-hidden transition-all ${
      won ? 'border-green-800' : 'border-red-900'
    }`}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50 transition-all"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            won ? 'bg-green-900/50' : 'bg-red-900/50'
          }`}>
            {isAttacker
              ? <Sword size={16} className={won ? 'text-green-400' : 'text-red-400'} />
              : <Shield size={16} className={won ? 'text-green-400' : 'text-red-400'} />
            }
          </div>
          <div>
           <p className={`text-sm font-semibold ${won ? 'text-green-400' : 'text-red-400'}`}>
              {won ? '⚔️ Victory' : '💀 Defeat'} — {isAttacker ? 'Attack' : 'Defense'}
            </p>
            {report.planets && (
              <p className="text-xs text-gray-400/70 mt-0.5">
                {report.planets.name} · <span className="font-mono">[{report.planets.galaxy}:{report.planets.system}:{report.planets.position}]</span>
              </p>
            )}
            <p className="text-xs text-gray-500 mt-0.5">{formatTime(report.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasPlunder && (
            <div className="text-xs text-yellow-400 hidden sm:flex gap-2">
              {plunder.metal > 0 && <span>⛏️ {Math.floor(plunder.metal).toLocaleString()}</span>}
              {plunder.crystal > 0 && <span>💎 {Math.floor(plunder.crystal).toLocaleString()}</span>}
              {plunder.deuterium > 0 && <span>🔵 {Math.floor(plunder.deuterium).toLocaleString()}</span>}
            </div>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDelete(report.id) }}
            className="text-gray-700 hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-800 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Attacker side */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Attacker {isAttacker ? '(You)' : ''}
              </p>
              <div>
                <p className="text-xs text-gray-500 mb-1">Fleet sent:</p>
                <ShipList ships={report.attacker_ships} color="text-cyan-300" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Losses:</p>
                <ShipList ships={report.attacker_losses} color="text-red-300" />
              </div>
            </div>

            {/* Defender side */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Defender {!isAttacker ? '(You)' : ''}
              </p>
              <div>
                <p className="text-xs text-gray-500 mb-1">Fleet present:</p>
                <ShipList ships={report.defender_ships} color="text-orange-300" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Losses:</p>
                <ShipList ships={report.defender_losses} color="text-red-300" />
              </div>
            </div>
          </div>

          {/* Plunder */}
          {hasPlunder && (
            <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3">
              <p className="text-xs font-semibold text-yellow-400 mb-2">Resources Plundered</p>
              <div className="flex gap-4 text-xs">
                {plunder.metal > 0 && <span className="text-gray-300">⛏️ {Math.floor(plunder.metal).toLocaleString()} metal</span>}
                {plunder.crystal > 0 && <span className="text-gray-300">💎 {Math.floor(plunder.crystal).toLocaleString()} crystal</span>}
                {plunder.deuterium > 0 && <span className="text-gray-300">🔵 {Math.floor(plunder.deuterium).toLocaleString()} deuterium</span>}
              </div>
            </div>
          )}

          {/* Debris */}
          {hasDebris && (
            <div className="bg-orange-900/20 border border-orange-800/50 rounded-lg p-3">
              <p className="text-xs font-semibold text-orange-400 mb-2">🌌 Debris Field Created</p>
              <div className="flex gap-4 text-xs">
                {debris.metal > 0 && <span className="text-gray-300">⛏️ {Math.floor(debris.metal).toLocaleString()} metal</span>}
                {debris.crystal > 0 && <span className="text-gray-300">💎 {Math.floor(debris.crystal).toLocaleString()} crystal</span>}
              </div>
              <p className="text-xs text-orange-600 mt-1">Send recyclers to harvest!</p>
            </div>
          )}

          {/* Combat rounds */}
          {report.combat_rounds?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Combat Rounds ({report.combat_rounds.length})
              </p>
              <div className="space-y-2">
                {report.combat_rounds.map((round, i) => (
                  <div key={i} className="bg-gray-800/50 rounded-lg p-2 text-xs">
                    <p className="text-gray-400 font-medium mb-1">Round {round.round}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-gray-600">Attacker lost:</p>
                        {Object.keys(round.attacker_losses ?? {}).length === 0
                          ? <p className="text-green-600">Nothing</p>
                          : Object.entries(round.attacker_losses).map(([t, q]) => (
                            <p key={t} className="text-red-400">{SHIP_NAMES[t] ?? t} ×{q}</p>
                          ))
                        }
                      </div>
                      <div>
                        <p className="text-gray-600">Defender lost:</p>
                        {Object.keys(round.defender_losses ?? {}).length === 0
                          ? <p className="text-green-600">Nothing</p>
                          : Object.entries(round.defender_losses).map(([t, q]) => (
                            <p key={t} className="text-red-400">{SHIP_NAMES[t] ?? t} ×{q}</p>
                          ))
                        }
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Espionage Report Card ────────────────────────────────────────────────────
function EspionageReportCard({ report, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const res = report.resources_seen ?? {}
  const ships = report.ships_seen
  const defenses = report.defenses_seen
  const buildings = report.buildings_seen
  const research = report.research_seen

  // Check estimate flags
  const resourcesEstimate = res.is_estimate === true
  const shipsEstimate = ships?.is_estimate === true
  const defensesEstimate = defenses?.is_estimate === true

  // Filter out is_estimate key from display
  const shipEntries = ships ? Object.entries(ships).filter(([k]) => k !== 'is_estimate') : null
  const defenseEntries = defenses ? Object.entries(defenses).filter(([k]) => k !== 'is_estimate') : null

  return (
    <div className="bg-gray-900 border border-cyan-900/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50 transition-all"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-cyan-900/50 flex items-center justify-center">
            <Search size={16} className="text-cyan-400" />
          </div>
         <div>
            <p className="text-sm font-semibold text-cyan-400">
              🔍 Espionage Report
              {resourcesEstimate && (
                <span className="ml-2 text-xs text-yellow-500 font-normal">~ estimates</span>
              )}
            </p>
            {report.planets && (
              <p className="text-xs text-cyan-300/70 mt-0.5">
                {report.planets.name} · <span className="font-mono">[{report.planets.galaxy}:{report.planets.system}:{report.planets.position}]</span>
              </p>
            )}
            <p className="text-xs text-gray-500 mt-0.5">{formatTime(report.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400 hidden sm:flex gap-2">
            {res.metal > 0 && (
              <span className={resourcesEstimate ? 'text-yellow-500/70' : ''}>
                ⛏️ {formatValue(res.metal, resourcesEstimate)}
              </span>
            )}
            {res.crystal > 0 && (
              <span className={resourcesEstimate ? 'text-yellow-500/70' : ''}>
                💎 {formatValue(res.crystal, resourcesEstimate)}
              </span>
            )}
            {res.deuterium > 0 && (
              <span className={resourcesEstimate ? 'text-yellow-500/70' : ''}>
                🔵 {formatValue(res.deuterium, resourcesEstimate)}
              </span>
            )}
          </div>
          <button
            onClick={e => { e.stopPropagation(); onDelete(report.id) }}
            className="text-gray-700 hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-800 p-4 space-y-3">

          {/* Estimate warning */}
          {resourcesEstimate && (
            <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-2 text-xs text-yellow-500 flex items-center gap-2">
              <span>⚠</span>
              <span>Values marked with ~ are estimates. Increase Espionage Tech or send more probes for exact readings.</span>
            </div>
          )}

         {/* Resources */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Resources</p>
            <div className="flex gap-4 text-xs flex-wrap">
              <span className={resourcesEstimate ? 'text-yellow-400' : 'text-gray-300'}>
                ⛏️ {formatValue(res.metal, resourcesEstimate)} metal
              </span>
              <span className={resourcesEstimate ? 'text-yellow-400' : 'text-gray-300'}>
                💎 {formatValue(res.crystal, resourcesEstimate)} crystal
              </span>
              <span className={resourcesEstimate ? 'text-yellow-400' : 'text-gray-300'}>
                🔵 {formatValue(res.deuterium, resourcesEstimate)} deuterium
              </span>
            </div>

            {/* Bunker protection info */}
            {res.bunker_pct > 0 && (
              <div className="mt-2 bg-amber-900/20 border border-amber-800/50 rounded-lg p-2">
                <p className="text-xs text-amber-400 font-semibold mb-1">
                  🔒 Vault Protection: {res.bunker_pct}% of resources are hidden
                </p>
                <div className="flex gap-3 text-xs text-amber-300/70">
                  <span>Max loot: ⛏️ {formatValue(res.lootable_metal, resourcesEstimate)}</span>
                  <span>💎 {formatValue(res.lootable_crystal, resourcesEstimate)}</span>
                  <span>🔵 {formatValue(res.lootable_deuterium, resourcesEstimate)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Ships */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Ships {shipsEstimate && <span className="text-yellow-500 font-normal normal-case">~ estimated</span>}
            </p>
            {ships !== null && ships !== undefined ? (
              shipEntries && shipEntries.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {shipEntries.map(([type, qty]) => (
                    <span key={type} className={`text-xs px-2 py-1 rounded bg-gray-800 ${shipsEstimate ? 'text-yellow-400' : 'text-orange-300'}`}>
                      {shipsEstimate && '~'}{SHIP_NAMES[type] ?? type} ×{Math.floor(qty)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-600 italic">None</p>
              )
            ) : (
              <p className="text-xs text-gray-600 italic">
                Hidden — send more probes or increase Espionage Tech
              </p>
            )}
          </div>

          {/* Defenses */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Defenses {defensesEstimate && <span className="text-yellow-500 font-normal normal-case">~ estimated</span>}
            </p>
            {defenses !== null && defenses !== undefined ? (
              defenseEntries && defenseEntries.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {defenseEntries.map(([type, qty]) => (
                    <span key={type} className={`text-xs px-2 py-1 rounded bg-gray-800 ${defensesEstimate ? 'text-yellow-400' : 'text-red-300'}`}>
                      {defensesEstimate && '~'}{SHIP_NAMES[type] ?? type} ×{Math.floor(qty)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-600 italic">None</p>
              )
            ) : (
              <p className="text-xs text-gray-600 italic">
                Hidden — send more probes or increase Espionage Tech
              </p>
            )}
          </div>

          {/* Buildings */}
          {buildings ? (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Buildings</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(buildings)
                  .filter(([k]) => k !== 'is_estimate')
                  .map(([type, lvl]) => (
                    <span key={type} className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
                      {type.replace(/_/g, ' ')} Lv.{lvl}
                    </span>
                  ))}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Buildings</p>
              <p className="text-xs text-gray-600 italic">Hidden — need higher Espionage Tech advantage</p>
            </div>
          )}

          {/* Research */}
          {research ? (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Research</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(research)
                  .filter(([k]) => k !== 'is_estimate')
                  .map(([type, lvl]) => (
                    <span key={type} className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
                      {type.replace(/_/g, ' ')} Lv.{lvl}
                    </span>
                  ))}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Research</p>
              <p className="text-xs text-gray-600 italic">Hidden — need higher Espionage Tech advantage</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Reports Page ────────────────────────────────────────────────────────
export default function Reports() {
  const { user } = useAuth()
  const [combatReports, setCombatReports] = useState([])
  const [espionageReports, setEspionageReports] = useState([])
  const [activeTab, setActiveTab] = useState('combat')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadReports()
  }, [user])

    async function loadReports() {
        setLoading(true)
        const [{ data: combat }, { data: espionage }] = await Promise.all([
        supabase.from('combat_reports')
            .select('*, planets!planet_id(name, galaxy, system, position)')
            .or(`attacker_id.eq.${user.id},defender_id.eq.${user.id}`)
            .order('created_at', { ascending: false })
            .limit(50),
        supabase.from('espionage_reports')
            .select('*, planets!target_planet_id(name, galaxy, system, position)')
            .eq('spy_owner_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50),
        ])
        setCombatReports(combat ?? [])
        setEspionageReports(espionage ?? [])
        setLoading(false)
    }

  async function deleteCombatReport(id) {
    await supabase.from('combat_reports').delete().eq('id', id)
    setCombatReports(prev => prev.filter(r => r.id !== id))
  }

  async function deleteEspionageReport(id) {
    await supabase.from('espionage_reports').delete().eq('id', id)
    setEspionageReports(prev => prev.filter(r => r.id !== id))
  }

  async function deleteAllReports() {
    if (activeTab === 'combat') {
      await supabase.from('combat_reports')
        .delete()
        .or(`attacker_id.eq.${user.id},defender_id.eq.${user.id}`)
      setCombatReports([])
    } else {
      await supabase.from('espionage_reports')
        .delete()
        .eq('spy_owner_id', user.id)
      setEspionageReports([])
    }
  }

  const activeReports = activeTab === 'combat' ? combatReports : espionageReports

  return (
    <div className="space-y-4 w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileText size={20} className="text-cyan-400" />
          <h2 className="text-xl font-bold text-white">Reports</h2>
          <span className="text-xs text-gray-500">
            {activeTab === 'combat' ? combatReports.length : espionageReports.length} reports
          </span>
        </div>
        {activeReports.length > 0 && (
          <button
            onClick={deleteAllReports}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-900/30 border border-red-800 text-red-400 rounded-lg text-xs hover:bg-red-900/50 transition-all"
          >
            <Trash2 size={14} /> Delete All
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('combat')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'combat' ? 'bg-cyan-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          <Sword size={14} /> Combat ({combatReports.length})
        </button>
        <button
          onClick={() => setActiveTab('espionage')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'espionage' ? 'bg-cyan-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          <Search size={14} /> Espionage ({espionageReports.length})
        </button>
      </div>

      {/* Reports list */}
      {loading ? (
        <div className="text-center py-12 text-gray-600 animate-pulse">Loading reports...</div>
      ) : activeReports.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-800 rounded-2xl">
          <FileText size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">No {activeTab} reports yet</p>
          <p className="text-gray-700 text-xs mt-1">
            {activeTab === 'combat'
              ? 'Send a fleet to attack an enemy planet'
              : 'Send espionage probes to spy on enemy planets'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeTab === 'combat'
            ? combatReports.map(r => (
              <CombatReportCard
                key={r.id}
                report={r}
                currentUserId={user.id}
                onDelete={deleteCombatReport}
              />
            ))
            : espionageReports.map(r => (
              <EspionageReportCard
                key={r.id}
                report={r}
                onDelete={deleteEspionageReport}
              />
            ))
          }
        </div>
      )}
    </div>
  )
}