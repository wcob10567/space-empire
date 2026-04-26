import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Target, Search, Package, Send, Home } from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────
const SYSTEMS_PER_GALAXY = 499
const CANVAS_W = 3000
const CANVAS_H = 1800
const DOT_RADIUS = 4

const PLANET_CONFIGS = [
  { size: 18, color: '#c87941', ringColor: null,      type: 'rocky'    },
  { size: 22, color: '#8b6914', ringColor: null,      type: 'rocky'    },
  { size: 16, color: '#a0522d', ringColor: null,      type: 'barren'   },
  { size: 28, color: '#4682b4', ringColor: null,      type: 'ocean'    },
  { size: 32, color: '#228b22', ringColor: null,      type: 'terran'   },
  { size: 38, color: '#cd853f', ringColor: '#a0522d', type: 'gas'      },
  { size: 42, color: '#daa520', ringColor: '#b8860b', type: 'gas'      },
  { size: 35, color: '#4169e1', ringColor: '#191970', type: 'gas'      },
  { size: 30, color: '#20b2aa', ringColor: null,      type: 'ice'      },
  { size: 24, color: '#708090', ringColor: null,      type: 'barren'   },
  { size: 20, color: '#9370db', ringColor: null,      type: 'volcanic' },
  { size: 18, color: '#696969', ringColor: null,      type: 'barren'   },
  { size: 15, color: '#8fbc8f', ringColor: null,      type: 'rocky'    },
  { size: 14, color: '#bc8f8f', ringColor: null,      type: 'barren'   },
  { size: 12, color: '#778899', ringColor: null,      type: 'frozen'   },
]

function getStarPos(system) {
  const seed = system * 2654435761
  const x = 80 + (Math.abs((seed ^ (seed >> 16)) % (CANVAS_W - 160)))
  const y = 80 + (Math.abs(((seed * 1234567) ^ (seed >> 8)) % (CANVAS_H - 160)))
  return { x, y }
}

function getStarConfig(system) {
  const types = [
    { color: '#fff7e6', glow: '#ffcc44', size: 60, type: 'G-type' },
    { color: '#ffd0a0', glow: '#ff8800', size: 80, type: 'K-type' },
    { color: '#ffe0e0', glow: '#ff4444', size: 100, type: 'M-type' },
    { color: '#e0f0ff', glow: '#88ccff', size: 55, type: 'F-type' },
    { color: '#ffffff', glow: '#aaddff', size: 45, type: 'A-type' },
  ]
  return types[system % types.length]
}

// ─── Intel helpers ───────────────────────────────────────────────────────────
function formatAge(dateStr) {
  if (!dateStr) return ''
  const secs = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000))
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function fmtNum(value, isEstimate) {
  if (value === undefined || value === null) return '?'
  return (isEstimate ? '~' : '') + Math.floor(value).toLocaleString()
}

function shipPairs(obj) {
  if (!obj) return null
  return Object.entries(obj).filter(([k, v]) => k !== 'is_estimate' && v > 0)
}

function IntelPanel({ intel }) {
  const res = intel.resources_seen ?? {}
  const ships = intel.ships_seen
  const defenses = intel.defenses_seen
  const buildings = intel.buildings_seen
  const research = intel.research_seen

  const resEst = res.is_estimate === true
  const shipsEst = ships?.is_estimate === true
  const defEst = defenses?.is_estimate === true

  const shipEntries = shipPairs(ships)
  const defEntries = shipPairs(defenses)
  const buildingEntries = buildings ? Object.entries(buildings).filter(([k]) => k !== 'is_estimate') : null
  const researchEntries = research ? Object.entries(research).filter(([k]) => k !== 'is_estimate') : null

  return (
    <div className="mb-3 bg-cyan-950/30 border border-cyan-900/40 rounded-lg p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-cyan-400 font-semibold flex items-center gap-1">
          🔍 Intel
          {resEst && <span className="text-[9px] text-yellow-500 font-normal">~estimate</span>}
        </span>
        <span className="text-[10px] text-gray-600">{formatAge(intel.last_scanned_at)}</span>
      </div>

      {/* Resources */}
      <div className="text-[11px]">
        <div className={`flex flex-wrap gap-x-2 ${resEst ? 'text-yellow-400' : 'text-gray-300'}`}>
          <span>⛏️ {fmtNum(res.metal, resEst)}</span>
          <span>💎 {fmtNum(res.crystal, resEst)}</span>
          <span>🔵 {fmtNum(res.deuterium, resEst)}</span>
        </div>
        {res.bunker_pct > 0 && (
          <div className="text-[10px] text-amber-400/80 mt-0.5">
            🔒 {res.bunker_pct}% protected · max loot ⛏️{fmtNum(res.lootable_metal, resEst)} 💎{fmtNum(res.lootable_crystal, resEst)} 🔵{fmtNum(res.lootable_deuterium, resEst)}
          </div>
        )}
      </div>

      {/* Ships */}
      <div className="text-[10px]">
        <span className="text-gray-500">Ships: </span>
        {ships ? (
          shipEntries.length === 0 ? (
            <span className="text-gray-600">None</span>
          ) : (
            <span className={shipsEst ? 'text-yellow-400' : 'text-orange-300'}>
              {shipEntries.map(([t, q]) => `${shipsEst ? '~' : ''}${q} ${t.replace(/_/g, ' ')}`).join(', ')}
            </span>
          )
        ) : (
          <span className="text-gray-600 italic">hidden — need higher Espionage Tech</span>
        )}
      </div>

      {/* Defenses */}
      <div className="text-[10px]">
        <span className="text-gray-500">Defenses: </span>
        {defenses ? (
          defEntries.length === 0 ? (
            <span className="text-gray-600">None</span>
          ) : (
            <span className={defEst ? 'text-yellow-400' : 'text-red-300'}>
              {defEntries.map(([t, q]) => `${defEst ? '~' : ''}${q} ${t.replace(/_/g, ' ')}`).join(', ')}
            </span>
          )
        ) : (
          <span className="text-gray-600 italic">hidden — need higher Espionage Tech</span>
        )}
      </div>

      {/* Buildings + Research (compact, only if revealed) */}
      {buildingEntries && buildingEntries.length > 0 && (
        <div className="text-[10px] text-gray-400">
          <span className="text-gray-500">Buildings: </span>
          {buildingEntries.map(([t, lvl]) => `${t.replace(/_/g, ' ')} ${lvl}`).join(', ')}
        </div>
      )}
      {researchEntries && researchEntries.length > 0 && (
        <div className="text-[10px] text-gray-400">
          <span className="text-gray-500">Research: </span>
          {researchEntries.map(([t, lvl]) => `${t.replace(/_/g, ' ')} ${lvl}`).join(', ')}
        </div>
      )}
    </div>
  )
}

// ─── Galaxy Canvas ────────────────────────────────────────────────────────────
function GalaxyCanvas({ galaxy, myPlanet, occupiedSystems, selectedSystem, onSelectSystem }) {
  const canvasRef = useRef(null)
  const stateRef = useRef({ pan: { x: 0, y: 0 }, zoom: 1, dragging: false, dragStart: { x: 0, y: 0 }, panStart: { x: 0, y: 0 }, hover: null, initialized: false })
  const rafRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  const systems = []
  for (let s = 1; s <= SYSTEMS_PER_GALAXY; s++) {
    systems.push({ system: s, ...getStarPos(s), occupied: occupiedSystems[s] ?? null })
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { pan, zoom, hover } = stateRef.current
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#030712'
    ctx.fillRect(0, 0, W, H)

    for (let i = 0; i < 250; i++) {
      const bx = ((i * 7919 + 1234) % CANVAS_W) * zoom + pan.x
      const by = ((i * 6271 + 5678) % CANVAS_H) * zoom + pan.y
      if (bx < 0 || bx > W || by < 0 || by > H) continue
      ctx.fillStyle = `rgba(255,255,255,${i % 5 === 0 ? 0.2 : 0.08})`
      ctx.beginPath()
      ctx.arc(bx, by, i % 5 === 0 ? 1 : 0.5, 0, Math.PI * 2)
      ctx.fill()
    }

    systems.forEach(({ system, x, y, occupied }) => {
      const sx = x * zoom + pan.x
      const sy = y * zoom + pan.y
      if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) return

      const isHovered = hover === system
      const isSelected = selectedSystem === system
      const isOwn = occupied?.isOwn
      const isOccupied = !!occupied
      const r = DOT_RADIUS * zoom * (isHovered || isSelected ? 1.8 : 1)

      if (isOccupied || isHovered || isSelected) {
        const gc = isOwn ? 'rgba(0,229,255,0.15)' : isOccupied ? 'rgba(255,80,80,0.15)' : 'rgba(255,255,255,0.08)'
        const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 5)
        grd.addColorStop(0, gc)
        grd.addColorStop(1, 'transparent')
        ctx.fillStyle = grd
        ctx.beginPath()
        ctx.arc(sx, sy, r * 5, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.beginPath()
      ctx.arc(sx, sy, r, 0, Math.PI * 2)
      ctx.fillStyle = isOwn ? '#00e5ff' : isOccupied ? '#ff5555' : isHovered ? '#aaaacc' : '#334455'
      ctx.fill()

      if (isSelected) {
        ctx.beginPath()
        ctx.arc(sx, sy, r + 5 * zoom, 0, Math.PI * 2)
        ctx.strokeStyle = '#00e5ff'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      if (myPlanet?.system === system && myPlanet?.galaxy === galaxy) {
        ctx.beginPath()
        ctx.arc(sx, sy, r + 4 * zoom, 0, Math.PI * 2)
        ctx.strokeStyle = '#00e5ff88'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      if (zoom > 1.8 && isOccupied) {
        ctx.fillStyle = isOwn ? '#00e5ff' : '#ff8888'
        ctx.font = `${Math.floor(9 * zoom)}px monospace`
        ctx.textAlign = 'center'
        ctx.fillText(`[${galaxy}:${system}]`, sx, sy - r - 4)
      }
    })
  }, [systems, galaxy, myPlanet, selectedSystem])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      if (!stateRef.current.initialized && myPlanet?.galaxy === galaxy) {
        const pos = getStarPos(myPlanet.system)
        stateRef.current.pan = {
          x: canvas.width / 2 - pos.x * stateRef.current.zoom,
          y: canvas.height / 2 - pos.y * stateRef.current.zoom,
        }
        stateRef.current.initialized = true
      }
      draw()
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [draw, myPlanet, galaxy])

  useEffect(() => { draw() }, [draw])

  function getSystemAt(cx, cy) {
    const { pan, zoom } = stateRef.current
    let closest = null, minDist = 14 / zoom
    systems.forEach(({ system, x, y }) => {
      const dist = Math.hypot(x * zoom + pan.x - cx, y * zoom + pan.y - cy)
      if (dist < minDist) { minDist = dist; closest = system }
    })
    return closest
  }

  function onMouseDown(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    stateRef.current.dragging = true
    stateRef.current.dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    stateRef.current.panStart = { ...stateRef.current.pan }
  }

  function onMouseMove(e) {
    const s = stateRef.current
    const rect = canvasRef.current.getBoundingClientRect()
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top
    if (s.dragging) {
      s.pan.x = s.panStart.x + (cx - s.dragStart.x)
      s.pan.y = s.panStart.y + (cy - s.dragStart.y)
      s.hover = null
      setTooltip(null)
    } else {
      const sys = getSystemAt(cx, cy)
      if (sys !== s.hover) {
        s.hover = sys
        if (sys) {
          const { x, y } = getStarPos(sys)
          setTooltip({ x: x * s.zoom + s.pan.x, y: y * s.zoom + s.pan.y, system: sys, occupied: occupiedSystems[sys] })
        } else setTooltip(null)
      }
    }
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(draw)
  }

  function onMouseUp(e) {
    const s = stateRef.current
    const rect = canvasRef.current.getBoundingClientRect()
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top
    s.dragging = false
    if (Math.hypot(cx - s.dragStart.x, cy - s.dragStart.y) < 5) {
      const sys = getSystemAt(cx, cy)
      if (sys) onSelectSystem(sys)
    }
  }

  function onWheel(e) {
    e.preventDefault()
    const s = stateRef.current
    const rect = canvasRef.current.getBoundingClientRect()
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top
    const delta = e.deltaY > 0 ? 0.85 : 1.15
    const nz = Math.min(4, Math.max(0.25, s.zoom * delta))
    s.pan.x = cx - (cx - s.pan.x) * (nz / s.zoom)
    s.pan.y = cy - (cy - s.pan.y) * (nz / s.zoom)
    s.zoom = nz
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(draw)
  }

  return (
    <div className="relative w-full" style={{ height: 380 }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-2xl border border-gray-800/50 cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { stateRef.current.dragging = false; stateRef.current.hover = null; setTooltip(null); draw() }}
        onWheel={onWheel}
      />
      {tooltip && (
        <div className="absolute pointer-events-none bg-gray-900/95 border border-gray-700 rounded-lg px-3 py-2 text-xs z-10" style={{ left: tooltip.x + 14, top: tooltip.y - 36 }}>
          <p className="text-cyan-400 font-mono">[{galaxy}:{tooltip.system}]</p>
          {tooltip.occupied
            ? <p style={{ color: tooltip.occupied.isOwn ? '#00e5ff' : '#ff8888' }}>{tooltip.occupied.isOwn ? '👑 Your system' : `⚔️ ${tooltip.occupied.name}`}</p>
            : <p className="text-gray-500">Empty system</p>}
          <p className="text-gray-600 mt-0.5">Click to view</p>
        </div>
      )}
      <div className="absolute bottom-3 left-3 text-xs text-gray-700">Scroll to zoom · Drag to pan · Click a system to view</div>
      <div className="absolute bottom-3 right-3 flex items-center gap-3 text-xs text-gray-600">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Yours</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Enemy</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-700 inline-block" /> Empty</span>
      </div>
    </div>
  )
}

// ─── Planet Panel ─────────────────────────────────────────────────────────────
function PlanetPanel({ position, planet, isOwn, onClose, onAction }) {
  const config = PLANET_CONFIGS[position - 1]
  return (
    <div className="bg-gray-900 border border-cyan-900/50 rounded-xl p-4 w-64 shrink-0">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Position {position}</p>
          {planet
            ? <><h3 className="text-white font-bold mt-1">{planet.name}</h3>
                <p className="text-xs mt-0.5" style={{ color: isOwn ? '#00e5ff' : '#ff8888' }}>
                  {isOwn ? '👑 Your Planet' : `Cmdr: ${planet.ownerName ?? 'Unknown'}`}
                </p></>
            : <h3 className="text-gray-500 font-bold mt-1">Empty Slot</h3>}
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-white text-xl leading-none">×</button>
      </div>

      {planet && (
        <div className="space-y-1.5 mb-3 text-xs">
          <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="text-gray-300 capitalize">{config.type}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Diameter</span><span className="text-gray-300">{planet.diameter?.toLocaleString() ?? '12,800'} km</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Temp</span><span className="text-gray-300">{planet.temperature ?? 20}°C</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Fields</span><span className="text-gray-300">{planet.used_fields ?? 0} / {planet.max_fields ?? 163}</span></div>
        </div>
      )}

      {/* Intel from previous probes — only shown for non-own planets */}
      {planet && !isOwn && planet.intel && <IntelPanel intel={planet.intel} />}

      {planet && !isOwn && (
        <div className="space-y-2">
          <button
            onClick={() => onAction('espionage', planet)}
            className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-all"
          >
            <Search size={14} className="text-cyan-400" /> Send Espionage Probe
          </button>
          <button
            onClick={() => onAction('attack', planet)}
            className="w-full flex items-center gap-2 px-3 py-2 bg-red-900/50 hover:bg-red-800/50 text-red-300 rounded-lg text-xs transition-all"
          >
            <Target size={14} className="text-red-400" /> Launch Attack
          </button>
          <button
            onClick={() => onAction('transport', planet)}
            className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-all"
          >
            <Package size={14} className="text-yellow-400" /> Send Transport
          </button>
        </div>
      )}

      {planet && isOwn && (
        <div className="bg-cyan-950/30 border border-cyan-900/50 rounded-lg p-3 text-xs text-cyan-400">
          This is your planet. Manage it from Overview.
        </div>
      )}

      {!planet && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 mb-2">This position is unoccupied.</p>
          <button
            onClick={() => onAction('colonize', null)}
            className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-all"
          >
            <Send size={14} className="text-green-400" /> Send Colony Ship
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Planet Component ─────────────────────────────────────────────────────────
function PlanetComp({ config, position, planet, isOwn, isSelected, onClick }) {
  const hasOwner = !!planet
  const hasIntel = !!planet?.intel && !isOwn
  const borderColor = isOwn ? '#00e5ff' : hasOwner ? '#ff4444' : 'transparent'
  const glowColor = isOwn ? '#00e5ff' : hasOwner ? '#ff4444' : 'transparent'
  return (
    <div className="flex flex-col items-center gap-1 cursor-pointer group shrink-0" onClick={() => onClick(position, planet)}>
      <span className="text-xs text-gray-600 font-mono">{position}</span>
      <div className="relative flex items-center justify-center" style={{ width: config.size + 24, height: config.size + 24 }}>
        {isSelected && <div className="absolute rounded-full border-2 border-cyan-400 animate-ping" style={{ width: config.size + 16, height: config.size + 16 }} />}
        {hasOwner && <div className="absolute rounded-full border" style={{ width: config.size + 12, height: config.size + 12, borderColor, boxShadow: `0 0 8px ${glowColor}` }} />}
        {!hasOwner
          ? <div className="rounded-full border border-gray-800 bg-gray-900/30 group-hover:border-gray-600 transition-colors" style={{ width: 8, height: 8 }} />
          : <div className="rounded-full transition-transform group-hover:scale-110" style={{ width: config.size, height: config.size, background: `radial-gradient(circle at 35% 30%, ${config.color}dd, ${config.color} 50%, #111 100%)`, boxShadow: isSelected ? `0 0 12px ${config.color}88` : `0 0 6px ${config.color}44` }} />
        }
        {hasIntel && (
          <span
            className="absolute top-0 right-0 text-[10px] leading-none"
            title="You have scouting intel for this planet"
            style={{ filter: 'drop-shadow(0 0 2px #06b6d4)' }}
          >
            🔍
          </span>
        )}
      </div>
      {hasOwner && (
        <div className="text-center" style={{ maxWidth: 64 }}>
          <p className="text-xs truncate" style={{ color: isOwn ? '#00e5ff' : '#ff8888' }}>{planet.name?.split("'s")[0] ?? 'Planet'}</p>
          <p className="text-xs text-gray-600 truncate">{planet.ownerName ?? ''}</p>
        </div>
      )}
    </div>
  )
}

// ─── System View ──────────────────────────────────────────────────────────────
function SystemView({ galaxy, system, myPlanet, onAction }) {
  const { user } = useAuth()
  const [systemData, setSystemData] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedPos, setSelectedPos] = useState(null)
  const [selectedPlanet, setSelectedPlanet] = useState(null)
  const starConfig = getStarConfig(system)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setSelectedPos(null)
      setSelectedPlanet(null)
      const { data } = await supabase
        .from('planets')
        .select('*, profiles(username)')
        .eq('galaxy', galaxy)
        .eq('system', system)

      // Fetch your persistent intel for the planets in this system
      const planetIds = data?.map(p => p.id) ?? []
      const intelMap = {}
      if (planetIds.length > 0 && user?.id) {
        const { data: intelRows } = await supabase
          .from('planet_intel')
          .select('*')
          .eq('owner_id', user.id)
          .in('target_planet_id', planetIds)
        intelRows?.forEach(r => { intelMap[r.target_planet_id] = r })
      }

      const map = {}
      data?.forEach(p => {
        map[p.position] = {
          ...p,
          ownerName: p.profiles?.username ?? 'Unknown',
          intel: intelMap[p.id] ?? null,
        }
      })
      setSystemData(map)
      setLoading(false)
    }
    load()
  }, [galaxy, system, user?.id])

  function handlePlanetClick(pos, planet) {
    if (selectedPos === pos) { setSelectedPos(null); setSelectedPlanet(null) }
    else { setSelectedPos(pos); setSelectedPlanet(planet ?? null) }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-cyan-400 font-mono font-bold text-sm">[{galaxy}:{system}]</span>
        <span className="text-gray-500 text-xs">{starConfig.type} Star System</span>
        {loading && <span className="text-xs text-cyan-400 animate-pulse">Scanning...</span>}
      </div>

      <div className="flex gap-4">
        <div className="flex-1 bg-gray-950 border border-gray-800/50 rounded-2xl overflow-hidden relative" style={{ height: 280 }}>
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(80)].map((_, i) => (
              <div key={i} className="absolute rounded-full bg-white" style={{ width: Math.random() * 1.5 + 0.5 + 'px', height: Math.random() * 1.5 + 0.5 + 'px', top: Math.random() * 100 + '%', left: Math.random() * 100 + '%', opacity: Math.random() * 0.4 + 0.1 }} />
            ))}
          </div>
          <div className="absolute top-3 left-3 text-xs text-gray-600">{starConfig.type} · System [{galaxy}:{system}]</div>
          <div className="flex items-center h-full px-4 overflow-x-auto">
            <div className="shrink-0 mr-4 relative flex items-center justify-center" style={{ width: 110, height: 110 }}>
              <div className="absolute rounded-full animate-pulse" style={{ width: starConfig.size * 2, height: starConfig.size * 2, background: `radial-gradient(circle, ${starConfig.glow}22 0%, transparent 70%)` }} />
              <div className="absolute rounded-full" style={{ width: starConfig.size * 1.4, height: starConfig.size * 1.4, background: `radial-gradient(circle, ${starConfig.glow}44 0%, transparent 70%)` }} />
              <div className="absolute rounded-full" style={{ width: starConfig.size * 0.7, height: starConfig.size * 0.7, background: `radial-gradient(circle at 35% 35%, white, ${starConfig.color} 40%, ${starConfig.glow} 100%)`, boxShadow: `0 0 20px ${starConfig.glow}` }} />
            </div>
            <div className="flex-1 relative flex items-center">
              <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-800/40" />
              <div className="flex items-end gap-3 relative z-10 w-full justify-between px-1">
                {PLANET_CONFIGS.map((cfg, i) => {
                  const pos = i + 1
                  const planet = systemData[pos] ?? null
                  return (
                    <PlanetComp
                      key={pos}
                      config={cfg}
                      position={pos}
                      planet={planet}
                      isOwn={planet?.owner_id === user?.id}
                      isSelected={selectedPos === pos}
                      onClick={handlePlanetClick}
                    />
                  )
                })}
              </div>
            </div>
          </div>
          <div className="absolute bottom-3 right-3 flex items-center gap-3 text-xs text-gray-600">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Yours</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Enemy</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-700 inline-block" /> Empty</span>
          </div>
        </div>

        {selectedPos && (
          <PlanetPanel
            position={selectedPos}
            planet={selectedPlanet}
            isOwn={selectedPlanet?.owner_id === user?.id}
            onClose={() => { setSelectedPos(null); setSelectedPlanet(null) }}
            onAction={onAction}
          />
        )}
      </div>
    </div>
  )
}

// ─── Main Galaxy Page ─────────────────────────────────────────────────────────
export default function Galaxy({ planet: myPlanet }) {
  const { user } = useAuth()
  const [galaxy, setGalaxy] = useState(myPlanet?.galaxy ?? 1)
  const [selectedSystem, setSelectedSystem] = useState(null)
  const [occupiedSystems, setOccupiedSystems] = useState({})

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('planets')
        .select('system, owner_id, name, profiles(username)')
        .eq('galaxy', galaxy)
      const map = {}
      data?.forEach(p => {
        if (!map[p.system]) map[p.system] = { isOwn: false, name: p.profiles?.username ?? 'Unknown' }
        if (p.owner_id === user?.id) map[p.system].isOwn = true
      })
      setOccupiedSystems(map)
    }
    load()
  }, [galaxy, user])

  function handleAction(type, target) {
    window.__pendingMission = {
      type,
      target: target ? {
        galaxy: target.galaxy,
        system: target.system,
        position: target.position,
        name: target.name,
      } : null,
    }
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'fleet' }))
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-gray-500 uppercase tracking-wide">Galaxy</span>
        <div className="flex gap-1">
          {[1,2,3,4,5].map(g => (
            <button key={g} onClick={() => { setGalaxy(g); setSelectedSystem(null) }}
              className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${galaxy === g ? 'bg-cyan-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {g}
            </button>
          ))}
        </div>
        {myPlanet && galaxy !== myPlanet.galaxy && (
          <button onClick={() => { setGalaxy(myPlanet.galaxy); setSelectedSystem(null) }} className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
            <Home size={14} /> My galaxy
          </button>
        )}
        <span className="text-xs text-gray-600 ml-auto">{Object.keys(occupiedSystems).length} occupied systems in Galaxy {galaxy}</span>
      </div>

      <GalaxyCanvas
        galaxy={galaxy}
        myPlanet={myPlanet}
        occupiedSystems={occupiedSystems}
        selectedSystem={selectedSystem}
        onSelectSystem={setSelectedSystem}
      />

      {selectedSystem && (
        <SystemView
          galaxy={galaxy}
          system={selectedSystem}
          myPlanet={myPlanet}
          onAction={handleAction}
        />
      )}
    </div>
  )
}