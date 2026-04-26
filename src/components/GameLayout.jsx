import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Building2, FlaskConical,
  Rocket, Map, FileText, LogOut, Menu, X, Zap
} from 'lucide-react'
import Notifications from './Notifications'

const NAV_ITEMS = [
  { id: 'overview',  label: 'Overview',  icon: LayoutDashboard },
  { id: 'buildings', label: 'Buildings', icon: Building2 },
  { id: 'research',  label: 'Research',  icon: FlaskConical },
  { id: 'shipyard',  label: 'Shipyard',  icon: Rocket },
  { id: 'galaxy',    label: 'Galaxy',    icon: Map },
  { id: 'reports',   label: 'Reports',   icon: FileText },
  { id: 'fleet',     label: 'Fleet',     icon: Rocket },
]

export default function GameLayout({ activePage, setActivePage, resources, planet, user, children }) {
  const { profile, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const energy = resources?.energy ?? 0
  const energyColor = energy >= 0 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Top Bar */}
      <header className="bg-gray-900 border-b border-cyan-900/50 px-4 py-2 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="text-cyan-400 font-bold tracking-widest text-sm uppercase">Space Empire</h1>
        </div>

        {/* Resource Bar */}
        <div className="hidden sm:flex items-center gap-4 text-xs">
          <ResourcePill label="Metal"     value={resources?.metal}     color="text-gray-300" bg="bg-gray-800" />
          <ResourcePill label="Crystal"   value={resources?.crystal}   color="text-cyan-300" bg="bg-cyan-950" />
          <ResourcePill label="Deuterium" value={resources?.deuterium} color="text-blue-300" bg="bg-blue-950" />
          <div className={`flex items-center gap-1 px-2 py-1 rounded bg-gray-800 ${energyColor}`}>
            <Zap size={12} />
            <span>{Math.floor(energy)}</span>
          </div>
        </div>

        {/* Commander info */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 hidden sm:block">
            Commander <span className="text-cyan-400 font-semibold">{profile?.username}</span>
          </span>
          <Notifications userId={user?.id} onNavigate={setActivePage} />
          <button
            onClick={signOut}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            <LogOut size={14} />
            <span className="hidden sm:block">Logout</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`
          fixed md:static inset-y-0 left-0 z-10 w-48 bg-gray-900 border-r border-cyan-900/50
          transform transition-transform duration-200 ease-in-out pt-14 md:pt-0
          ${menuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="p-3 border-b border-cyan-900/30">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Current Planet</p>
            <p className="text-sm text-white font-medium truncate mt-1">{planet?.name ?? 'Loading...'}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {planet ? `${planet.galaxy}:${planet.system}:${planet.position}` : ''}
            </p>
          </div>

          <nav className="p-2 space-y-1">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setActivePage(id); setMenuOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  activePage === id
                    ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-800'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile overlay */}
        {menuOpen && (
          <div className="fixed inset-0 bg-black/50 z-0 md:hidden" onClick={() => setMenuOpen(false)} />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4">
          <div className="flex sm:hidden items-center gap-2 text-xs mb-4 flex-wrap">
            <ResourcePill label="Metal"     value={resources?.metal}     color="text-gray-300" bg="bg-gray-800" />
            <ResourcePill label="Crystal"   value={resources?.crystal}   color="text-cyan-300" bg="bg-cyan-950" />
            <ResourcePill label="Deuterium" value={resources?.deuterium} color="text-blue-300" bg="bg-blue-950" />
            <div className={`flex items-center gap-1 px-2 py-1 rounded bg-gray-800 ${energyColor}`}>
              <Zap size={12} />
              <span>{Math.floor(energy)}</span>
            </div>
          </div>
          <div id="page-content">{children}</div>
        </main>
      </div>
    </div>
  )
}

function ResourcePill({ label, value, color, bg }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${bg}`}>
      <span className="text-gray-500">{label}:</span>
      <span className={`font-mono font-medium ${color}`}>
        {value !== undefined ? Math.floor(value).toLocaleString() : '...'}
      </span>
    </div>
  )
}