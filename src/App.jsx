import { useState, useEffect, useCallback, useMemo } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Overview from './pages/Overview'
import GameLayout from './components/GameLayout'
import Buildings from './pages/Buildings'
import Research from './pages/Research'
import Shipyard from './pages/Shipyard'
import Galaxy from './pages/Galaxy'
import Fleet from './pages/Fleet'
import DevPanel from './components/DevPanel'
import Reports from './pages/Reports'
import { TICK } from './config/tick'
import { queries } from './services/queries'
import { sumReservation } from './services/buildQueue'
import { sumShipReservation } from './services/shipQueue'
import { sumResearchReservationByPlanet } from './services/researchQueue'

const ACTIVE_PLANET_KEY = 'space-empire-active-planet'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-cyan-400 text-xl tracking-widest animate-pulse">
          Loading Empire...
        </div>
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

function Game() {
  const { user, profile, setProfile } = useAuth()

  const [activePage, setActivePage] = useState('overview')
  const [planets, setPlanets] = useState([])
  const [activePlanetId, setActivePlanetIdState] = useState(
    () => localStorage.getItem(ACTIVE_PLANET_KEY)
  )
  const [resources, setResources] = useState(null)
  const [buildings, setBuildings] = useState([])
  const [research, setResearch] = useState([])
  const [ships, setShips] = useState([])
  const [buildingQueue, setBuildingQueue] = useState([])
  const [shipQueue, setShipQueue] = useState([])
  const [researchQueue, setResearchQueue] = useState([])

  const planet = planets.find(p => p.id === activePlanetId) ?? planets[0] ?? null

  // Reservation = sum of queued costs for the active planet across all 3
  // queues. Reduces what's spendable but does NOT reduce balance (resources
  // stay plunderable until a queued build actually starts).
  // Research queue is account-wide but reservation is per-source-planet.
  const reservation = useMemo(() => {
    const buildRes = sumReservation(buildingQueue)
    const shipRes  = sumShipReservation(shipQueue)
    const resByPlanet = sumResearchReservationByPlanet(researchQueue)
    const researchRes = planet?.id ? (resByPlanet[planet.id] ?? { metal: 0, crystal: 0, deuterium: 0 }) : { metal: 0, crystal: 0, deuterium: 0 }
    return {
      metal:     buildRes.metal     + shipRes.metal     + researchRes.metal,
      crystal:   buildRes.crystal   + shipRes.crystal   + researchRes.crystal,
      deuterium: buildRes.deuterium + shipRes.deuterium + researchRes.deuterium,
    }
  }, [buildingQueue, shipQueue, researchQueue, planet?.id])

  const setActivePlanetId = useCallback((id) => {
    setActivePlanetIdState(id)
    if (id) localStorage.setItem(ACTIVE_PLANET_KEY, id)
  }, [])

  const getProduction = useCallback((buildings) => {
    const lvl = (type) => buildings?.find(b => b.building_type === type)?.level ?? 0
    return {
      metal:     30 * lvl('metal_mine') * Math.pow(1.1, lvl('metal_mine')),
      crystal:   20 * lvl('crystal_mine') * Math.pow(1.1, lvl('crystal_mine')),
      deuterium: 10 * lvl('deuterium_synthesizer') * Math.pow(1.1, lvl('deuterium_synthesizer')),
      energy:    20 * lvl('solar_plant') * Math.pow(1.1, lvl('solar_plant')),
    }
  }, [])

  // Reset activePlanetId if the stored id isn't in the list (e.g. deleted planet)
  useEffect(() => {
    if (planets.length === 0) return
    const valid = planets.some(p => p.id === activePlanetId)
    if (!valid) setActivePlanetId(planets[0].id)
  }, [planets, activePlanetId, setActivePlanetId])

  // Load planets list + research + research_queue (per-user, doesn't depend on active planet)
  useEffect(() => {
    if (!user) return
    async function loadUserData() {
      await supabase.rpc('update_last_online', { p_user_id: user.id })

      const { data: planetData }   = await queries.planetsForUser(user.id)
      if (planetData)   setPlanets(planetData)

      const { data: researchData } = await queries.researchForUser(user.id)
      if (researchData) setResearch(researchData)

      const { data: rqData } = await queries.researchQueue(user.id)
      if (rqData) setResearchQueue(rqData)
    }
    loadUserData()
  }, [user])

  // Load per-planet data whenever the active planet changes
  useEffect(() => {
    if (!planet?.id) return
    setResources(null)
    setBuildings([])
    setShips([])
    setBuildingQueue([])
    setShipQueue([])
    async function loadPlanetData() {
      const [
        { data: resData },
        { data: bldData },
        { data: shipData },
        { data: bqData },
        { data: sqData },
      ] = await Promise.all([
        queries.resources(planet.id),
        queries.buildings(planet.id),
        queries.ships(planet.id),
        queries.buildingQueue(planet.id),
        queries.shipQueue(planet.id),
      ])
      if (resData)  setResources(resData)
      if (bldData)  setBuildings(bldData)
      if (shipData) setShips(shipData)
      if (bqData)   setBuildingQueue(bqData)
      if (sqData)   setShipQueue(sqData)
    }
    loadPlanetData()
  }, [planet?.id])

  // Local resource tick (active planet only — DB doesn't store real-time anyway)
  useEffect(() => {
    if (!resources || !buildings.length) return
    const prod = getProduction(buildings)
    const interval = setInterval(() => {
      setResources(prev => {
        if (!prev) return prev
        const tickAmount = TICK.RESOURCES_MS / 1000 / 3600
        return {
          ...prev,
          metal:     Math.min(prev.metal + prod.metal * tickAmount, prev.metal_cap),
          crystal:   Math.min(prev.crystal + prod.crystal * tickAmount, prev.crystal_cap),
          deuterium: Math.min(prev.deuterium + prod.deuterium * tickAmount, prev.deuterium_cap),
          energy:    prod.energy,
        }
      })
    }, TICK.RESOURCES_MS)
    return () => clearInterval(interval)
  }, [resources, buildings, getProduction])

  // Fleet tick: process arrivals, advance building/ship/research queues,
  // refresh planet list (catches new colonies), refresh ships for active planet
  useEffect(() => {
    if (!user) return
    async function tick() {
      // Server-side processors. Fleets first (plunder/transport may free up
      // resources that the queues then deduct on the same tick).
      const [
        ,
        { data: bqStarted },
        { data: sqEvents },
        { data: rqStarted },
      ] = await Promise.all([
        supabase.rpc('process_arrived_fleets'),
        supabase.rpc('process_building_queue'),
        supabase.rpc('process_ship_queue'),
        supabase.rpc('process_research_queue'),
      ])

      // ── building queue starts ───────────────────────────────────────────
      if (Array.isArray(bqStarted) && bqStarted.length > 0 && planet?.id) {
        let activePlanetHadStart = false
        for (const ev of bqStarted) {
          if (ev.planet_id !== planet.id) continue
          activePlanetHadStart = true
          setResources(prev => prev ? ({
            ...prev,
            metal:     prev.metal     - (ev.metal     ?? 0),
            crystal:   prev.crystal   - (ev.crystal   ?? 0),
            deuterium: prev.deuterium - (ev.deuterium ?? 0),
          }) : prev)
          setBuildings(prev => prev.map(b =>
            b.building_type === ev.building_type
              ? { ...b, is_upgrading: true, upgrade_complete_at: ev.complete_at }
              : b
          ))
        }
        if (activePlanetHadStart) {
          const { data: q } = await queries.buildingQueue(planet.id)
          if (q) setBuildingQueue(q)
        }
      }

      // ── ship queue events ('started' = full cost deducted, 'completed' = ships popped) ──
      if (Array.isArray(sqEvents) && sqEvents.length > 0 && planet?.id) {
        let activePlanetHadEvent = false
        for (const ev of sqEvents) {
          if (ev.planet_id !== planet.id) continue
          activePlanetHadEvent = true
          if (ev.type === 'started') {
            setResources(prev => prev ? ({
              ...prev,
              metal:     prev.metal     - (ev.metal     ?? 0),
              crystal:   prev.crystal   - (ev.crystal   ?? 0),
              deuterium: prev.deuterium - (ev.deuterium ?? 0),
            }) : prev)
          } else if (ev.type === 'completed') {
            setShips(prev => {
              const exists = prev?.find(s => s.ship_type === ev.ship_type)
              if (exists) {
                return prev.map(s => s.ship_type === ev.ship_type
                  ? { ...s, quantity: s.quantity + (ev.delta ?? 0) }
                  : s
                )
              }
              return [...(prev ?? []), { ship_type: ev.ship_type, quantity: ev.delta ?? 0 }]
            })
          }
        }
        if (activePlanetHadEvent) {
          const { data: q } = await queries.shipQueue(planet.id)
          if (q) setShipQueue(q)
        }
      }

      // ── research queue starts (account-wide) ────────────────────────────
      if (Array.isArray(rqStarted) && rqStarted.length > 0) {
        for (const ev of rqStarted) {
          if (ev.source_planet_id === planet?.id) {
            setResources(prev => prev ? ({
              ...prev,
              metal:     prev.metal     - (ev.metal     ?? 0),
              crystal:   prev.crystal   - (ev.crystal   ?? 0),
              deuterium: prev.deuterium - (ev.deuterium ?? 0),
            }) : prev)
          }
          setResearch(prev => {
            const exists = prev?.find(r => r.tech_type === ev.tech_type)
            if (exists) {
              return prev.map(r => r.tech_type === ev.tech_type
                ? { ...r, is_researching: true, research_complete_at: ev.complete_at }
                : r
              )
            }
            return [...(prev ?? []), { tech_type: ev.tech_type, level: 0, is_researching: true, research_complete_at: ev.complete_at }]
          })
        }
        const { data: q } = await queries.researchQueue(user.id)
        if (q) setResearchQueue(q)
      }

      const { data: planetData } = await queries.planetsForUser(user.id)
      if (planetData) {
        setPlanets(prev => {
          const prevKey = prev.map(p => p.id).join()
          const newKey = planetData.map(p => p.id).join()
          if (prevKey === newKey) return prev
          return planetData
        })
      }

      if (planet?.id) {
        const { data } = await queries.ships(planet.id)
        if (data) setShips(data)
      }
    }
    async function restockNpcs() {
      await supabase.rpc('restock_npc_resources')
    }
    tick()
    restockNpcs()
    const fleetInterval = setInterval(tick, TICK.FLEET_PROCESS_MS)
    const npcInterval = setInterval(restockNpcs, TICK.NPC_RESTOCK_MS)
    return () => {
      clearInterval(fleetInterval)
      clearInterval(npcInterval)
    }
  }, [user, planet?.id])

  // Listen for navigation events from galaxy map
  useEffect(() => {
    function handleNav(e) {
      setActivePage(e.detail)
    }
    window.addEventListener('navigate', handleNav)
    return () => window.removeEventListener('navigate', handleNav)
  }, [])

  function renderPage() {
    switch (activePage) {
      case 'overview':
        return <Overview planet={planet} resources={resources} buildings={buildings} profile={profile} setProfile={setProfile} />
      case 'buildings':
        return <Buildings planet={planet} resources={resources} buildings={buildings} setBuildings={setBuildings} buildingQueue={buildingQueue} setBuildingQueue={setBuildingQueue} reservation={reservation} />
      case 'research':
        return <Research planet={planet} planets={planets} resources={resources} buildings={buildings} research={research} setResearch={setResearch} setResources={setResources} researchQueue={researchQueue} setResearchQueue={setResearchQueue} reservation={reservation} />
      case 'shipyard':
        return <Shipyard planet={planet} resources={resources} buildings={buildings} research={research} ships={ships} setShips={setShips} setResources={setResources} shipQueue={shipQueue} setShipQueue={setShipQueue} reservation={reservation} />
      case 'galaxy':
        return <Galaxy planet={planet} />
      case 'fleet':
        return <Fleet planet={planet} ships={ships} resources={resources} research={research} setShips={setShips} setResources={setResources} />
      case 'reports':
        return <Reports />
      default:
        return (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-2xl text-cyan-400 font-bold capitalize">{activePage}</p>
              <p className="text-gray-500 mt-2">Coming soon...</p>
            </div>
          </div>
        )
    }
  }

  return (
    <GameLayout
      activePage={activePage}
      setActivePage={setActivePage}
      resources={resources}
      reservation={reservation}
      planet={planet}
      planets={planets}
      onSelectPlanet={setActivePlanetId}
      user={user}
    >
      {renderPage()}
      <DevPanel
        planet={planet}
        resources={resources}
        buildings={buildings}
        research={research}
        ships={ships}
        setResources={setResources}
        setBuildings={setBuildings}
        setResearch={setResearch}
        setShips={setShips}
      />
    </GameLayout>
  )
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Game /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
