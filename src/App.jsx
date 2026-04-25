import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Overview from './pages/Overview'
import GameLayout from './components/GameLayout'
import Buildings from './pages/Buildings'
import Research from './pages/Research'
import Shipyard from './pages/Shipyard'

const TICK_INTERVAL = 5000 // update resources every 5 seconds locally

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
  const { user } = useAuth()
  const [activePage, setActivePage] = useState('overview')
  const [planet, setPlanet] = useState(null)
  const [resources, setResources] = useState(null)
  const [buildings, setBuildings] = useState([])
  const [research, setResearch] = useState([])
  const [ships, setShips] = useState([])

  // Production rates per hour
  const getProduction = useCallback((buildings) => {
    const lvl = (type) => buildings?.find(b => b.building_type === type)?.level ?? 0
    return {
      metal:     30 * lvl('metal_mine') * Math.pow(1.1, lvl('metal_mine')),
      crystal:   20 * lvl('crystal_mine') * Math.pow(1.1, lvl('crystal_mine')),
      deuterium: 10 * lvl('deuterium_synthesizer') * Math.pow(1.1, lvl('deuterium_synthesizer')),
      energy:    20 * lvl('solar_plant') * Math.pow(1.1, lvl('solar_plant')),
    }
  }, [])

  // Load planet, resources, buildings from Supabase
  useEffect(() => {
    if (!user) return
    async function loadGameData() {
      // Get homeworld
      const { data: planetData } = await supabase
        .from('planets')
        .select('*')
        .eq('owner_id', user.id)
        .eq('is_homeworld', true)
        .single()
      if (!planetData) return
      setPlanet(planetData)

      // Get resources
      const { data: resData } = await supabase
        .from('resources')
        .select('*')
        .eq('planet_id', planetData.id)
        .single()
      if (resData) setResources(resData)

      // Get buildings
      const { data: bldData } = await supabase
        .from('buildings')
        .select('*')
        .eq('planet_id', planetData.id)
      if (bldData) setBuildings(bldData)
      
      const { data: resData2 } = await supabase
        .from('research')
        .select('*')
        .eq('owner_id', user.id)
      if (resData2) setResearch(resData2)
      
        const { data: shipData } = await supabase
        .from('ships')
        .select('*')
        .eq('planet_id', planetData.id)
      if (shipData) setShips(shipData)
    }
    loadGameData()
  }, [user])

  // Local resource tick — updates resources every 5s without hitting DB
  useEffect(() => {
    if (!resources || !buildings.length) return
    const prod = getProduction(buildings)
    const interval = setInterval(() => {
      setResources(prev => {
        if (!prev) return prev
        const tickAmount = TICK_INTERVAL / 1000 / 3600 // fraction of an hour
        return {
          ...prev,
          metal:     Math.min(prev.metal + prod.metal * tickAmount, prev.metal_cap),
          crystal:   Math.min(prev.crystal + prod.crystal * tickAmount, prev.crystal_cap),
          deuterium: Math.min(prev.deuterium + prod.deuterium * tickAmount, prev.deuterium_cap),
          energy:    prod.energy,
        }
      })
    }, TICK_INTERVAL)
    return () => clearInterval(interval)
  }, [resources, buildings, getProduction])

  function renderPage() {
    switch (activePage) {
      case 'overview':
        return <Overview planet={planet} resources={resources} buildings={buildings} />
      case 'buildings':
        return <Buildings planet={planet} resources={resources} buildings={buildings} setBuildings={setBuildings} setResources={setResources} />
      case 'research':
        return <Research planet={planet} resources={resources} buildings={buildings} research={research} setResearch={setResearch} />
      case 'shipyard':
        return <Shipyard planet={planet} resources={resources} buildings={buildings} research={research} ships={ships} setShips={setShips} setResources={setResources} />
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
      planet={planet}
    >
      {renderPage()}
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