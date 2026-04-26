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

function ShipList({ ships, label, color }) {
  if (!ships || Object.keys(ships).length === 0) return (
    <p className="text-xs text-gray-600 italic">None</p>
  )
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(ships).map(([type, qty]) => (
        <span key={type} className={`text-xs px-2 py-1 rounded bg-gray-800 ${color}`}>
          {SHIP_NAMES[type] ?? type} ×{qty}
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

  return (
    <div className="bg-gray-900 border border-cyan-900/50 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50 transition-all"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-cyan-900/50 flex items-center justify-center">
            <Search size={16} className="text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-cyan-400">🔍 Espionage Report</p>
            <p className="text-xs text-gray-500 mt-0.5">{formatTime(report.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400 hidden sm:flex gap-2">
            {res.metal > 0 && <span>⛏️ {Math.floor(res.metal).toLocaleString()}</span>}
            {res.crystal > 0 && <span>💎 {Math.floor(res.crystal).toLocaleString()}</span>}
            {res.deuterium > 0 && <span>🔵 {Math.floor(res.deuterium).toLocaleString()}</span>}
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

      {expanded && (
        <div className="border-t border-gray-800 p-4 space-y-3">
          {/* Resources */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Resources</p>
            <div className="flex gap-4 text-xs">
              <span className="text-gray-300">⛏️ {Math.floor(res.metal ?? 0).toLocaleString()} metal</span>
              <span className="text-gray-300">💎 {Math.floor(res.crystal ?? 0).toLocaleString()} crystal</span>
              <span className="text-gray-300">🔵 {Math.floor(res.deuterium ?? 0).toLocaleString()} deuterium</span>
            </div>
          </div>

          {/* Ships */}
          {report.ships_seen ? (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ships</p>
              <ShipList ships={report.ships_seen} color="text-orange-300" />
            </div>
          ) : (
            <p className="text-xs text-gray-600">Ships hidden — need higher Espionage Tech or more probes</p>
          )}

          {/* Defenses */}
          {report.defenses_seen ? (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Defenses</p>
              <ShipList ships={report.defenses_seen} color="text-red-300" />
            </div>
          ) : (
            <p className="text-xs text-gray-600">Defenses hidden — need Espionage Tech Lv. 4+</p>
          )}

          {/* Buildings */}
          {report.buildings_seen && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Buildings</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(report.buildings_seen).map(([type, lvl]) => (
                  <span key={type} className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
                    {type.replace(/_/g, ' ')} Lv.{lvl}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Research */}
          {report.research_seen && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Research</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(report.research_seen).map(([type, lvl]) => (
                  <span key={type} className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
                    {type.replace(/_/g, ' ')} Lv.{lvl}
                  </span>
                ))}
              </div>
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
        .select('*')
        .or(`attacker_id.eq.${user.id},defender_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('espionage_reports')
        .select('*')
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