import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Bell, Sword, Search, Package, X, ChevronRight } from 'lucide-react'

const TYPE_CONFIG = {
  combat_win:    { icon: Sword,  color: 'text-green-400', bg: 'bg-green-900/30 border-green-800', label: 'Victory!' },
  combat_loss:   { icon: Sword,  color: 'text-red-400',   bg: 'bg-red-900/30 border-red-800',     label: 'Defeat'   },
  espionage:     { icon: Search, color: 'text-cyan-400',  bg: 'bg-cyan-900/30 border-cyan-800',   label: 'Intel Report' },
  fleet_return:  { icon: Package,color: 'text-yellow-400',bg: 'bg-yellow-900/30 border-yellow-800',label: 'Fleet Returned' },
}

export default function Notifications({ userId, onNavigate }) {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const prevReportCount = useRef(0)
  const prevEspCount = useRef(0)

  // Poll for new reports every 15 seconds
  useEffect(() => {
    if (!userId) return
    checkForNewReports()
    const interval = setInterval(checkForNewReports, 15000)
    return () => clearInterval(interval)
  }, [userId])

  async function checkForNewReports() {
    // Check combat reports
    const { data: combat } = await supabase
      .from('combat_reports')
      .select('id, attacker_won, attacker_id, resources_plundered, created_at')
      .or(`attacker_id.eq.${userId},defender_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(10)

    // Check espionage reports
    const { data: espionage } = await supabase
      .from('espionage_reports')
      .select('id, resources_seen, created_at')
      .eq('spy_owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    const newNotifs = []

    // Add new combat notifications
    if (combat && combat.length > prevReportCount.current) {
      const newOnes = combat.slice(0, combat.length - prevReportCount.current)
      newOnes.forEach(r => {
        const isAttacker = r.attacker_id === userId
        const won = isAttacker ? r.attacker_won : !r.attacker_won
        const plunder = r.resources_plundered ?? {}
        const hasPlunder = plunder.metal > 0 || plunder.crystal > 0
        newNotifs.push({
          id: `combat-${r.id}`,
          type: won ? 'combat_win' : 'combat_loss',
          message: won
            ? hasPlunder
              ? `Victory! Plundered ⛏️${Math.floor(plunder.metal ?? 0).toLocaleString()} 💎${Math.floor(plunder.crystal ?? 0).toLocaleString()}`
              : 'Victory! Enemy fleet destroyed.'
            : isAttacker
              ? 'Your attack was repelled. Fleet returning home.'
              : 'Your planet was attacked!',
          time: r.created_at,
          page: 'reports',
        })
      })
      prevReportCount.current = combat.length
    } else if (prevReportCount.current === 0 && combat) {
      prevReportCount.current = combat.length
    }

    // Add new espionage notifications
    if (espionage && espionage.length > prevEspCount.current) {
      const newOnes = espionage.slice(0, espionage.length - prevEspCount.current)
      newOnes.forEach(r => {
        const res = r.resources_seen ?? {}
        newNotifs.push({
          id: `esp-${r.id}`,
          type: 'espionage',
          message: `Probes returned. Resources: ⛏️${Math.floor(res.metal ?? 0).toLocaleString()} 💎${Math.floor(res.crystal ?? 0).toLocaleString()}`,
          time: r.created_at,
          page: 'reports',
        })
      })
      prevEspCount.current = espionage.length
    } else if (prevEspCount.current === 0 && espionage) {
      prevEspCount.current = espionage.length
    }

    if (newNotifs.length > 0) {
      setNotifications(prev => [...newNotifs, ...prev].slice(0, 20))
      setUnread(prev => prev + newNotifs.length)
    }
  }

  function dismiss(id) {
    setNotifications(prev => prev.filter(n => n.id !== id))
    setUnread(prev => Math.max(0, prev - 1))
  }

  function dismissAll() {
    setNotifications([])
    setUnread(0)
  }

  function handleClick(notif) {
    onNavigate(notif.page)
    setOpen(false)
    dismiss(notif.id)
  }

  function formatAge(dateStr) {
    const secs = Math.floor((Date.now() - new Date(dateStr)) / 1000)
    if (secs < 60) return 'just now'
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
    return `${Math.floor(secs / 3600)}h ago`
  }

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        onClick={() => { setOpen(!open); setUnread(0) }}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 transition-all"
      >
        <Bell size={16} className={unread > 0 ? 'text-cyan-400' : 'text-gray-500'} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-10 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {notifications.length > 0 && (
              <button onClick={dismissAll} className="text-xs text-gray-500 hover:text-white">
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-600 text-xs">
                No new notifications
              </div>
            ) : (
              notifications.map(notif => {
                const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.fleet_return
                const Icon = cfg.icon
                return (
                  <div key={notif.id} className={`flex items-start gap-3 p-3 border-b border-gray-800/50 hover:bg-gray-800/50 transition-all cursor-pointer`}
                    onClick={() => handleClick(notif)}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.bg}`}>
                      <Icon size={14} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{notif.message}</p>
                      <p className="text-xs text-gray-600 mt-1">{formatAge(notif.time)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <ChevronRight size={12} className="text-gray-600" />
                      <button onClick={e => { e.stopPropagation(); dismiss(notif.id) }}
                        className="text-gray-700 hover:text-white">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}