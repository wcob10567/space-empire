import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Bell, Sword, Search, Package, X, ChevronRight, Shield } from 'lucide-react'

const TYPE_CONFIG = {
  combat_win:    { icon: Sword,   color: 'text-green-400',  bg: 'bg-green-900/30 border-green-800',   label: 'Victory!'       },
  combat_loss:   { icon: Sword,   color: 'text-red-400',    bg: 'bg-red-900/30 border-red-800',        label: 'Defeat'         },
  espionage:     { icon: Search,  color: 'text-cyan-400',   bg: 'bg-cyan-900/30 border-cyan-800',      label: 'Intel Report'   },
  fleet_return:  { icon: Package, color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-800',  label: 'Fleet Returned' },
  message:       { icon: Package, color: 'text-purple-400', bg: 'bg-purple-900/30 border-purple-800',  label: 'Message'        },
}

export default function Notifications({ userId, onNavigate }) {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const channelRef = useRef(null)
  const dropdownRef = useRef(null)

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (!userId) return
    loadNotifications()

    // ✅ Poll every 5 seconds as reliable fallback
    const interval = setInterval(loadNotifications, 5000)

    // ✅ Also try real-time subscription
    channelRef.current = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev].slice(0, 20))
        setUnread(prev => prev + 1)
      })
      .subscribe()

    return () => {
      clearInterval(interval)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [userId])

  // ✅ Load from database — persists across sessions
  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (data) {
      setNotifications(data)
      setUnread(data.filter(n => !n.is_read).length)
    }
  }

  // ✅ Mark single notification as read in database
  async function markAsRead(id) {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnread(prev => Math.max(0, prev - 1))
  }

  // ✅ Delete single notification from database
  async function dismiss(id) {
    await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    setUnread(prev => Math.max(0, prev - 1))
  }

  // ✅ Delete all notifications from database
  async function dismissAll() {
    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
    setNotifications([])
    setUnread(0)
  }

  // ✅ Mark all as read in database
  async function markAllRead() {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnread(0)
  }

  // ✅ Opening bell marks all as read
  function handleOpen() {
    setOpen(!open)
    if (!open) markAllRead()
  }

  // ✅ Navigate to right page based on notification type
  // Ready for future message system
  function handleClick(notif) {
    if (notif.reference_type === 'combat_report') onNavigate('reports')
    else if (notif.reference_type === 'espionage_report') onNavigate('reports')
    else if (notif.reference_type === 'message') onNavigate('messages')
    else onNavigate('reports')
    setOpen(false)
    markAsRead(notif.id)
  }

  function formatAge(dateStr) {
    const secs = Math.floor((Date.now() - new Date(dateStr)) / 1000)
    if (secs < 60) return 'just now'
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
    return `${Math.floor(secs / 86400)}d ago`
  }

return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
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
              <div className="flex items-center gap-3">
                {/* ✅ Mark all read button */}
                <button onClick={markAllRead} className="text-xs text-gray-500 hover:text-white">
                  Mark all read
                </button>
                {/* ✅ Clear all button */}
                <button onClick={dismissAll} className="text-xs text-red-500 hover:text-red-400">
                  Clear all
                </button>
              </div>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-600 text-xs">
                No notifications
              </div>
            ) : (
              notifications.map(notif => {
                const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.fleet_return
                const Icon = cfg.icon
                return (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 p-3 border-b border-gray-800/50 hover:bg-gray-800/50 transition-all cursor-pointer ${
                      !notif.is_read ? 'bg-gray-800/30' : ''
                    }`}
                    onClick={() => handleClick(notif)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${cfg.bg}`}>
                      <Icon size={14} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-semibold ${cfg.color}`}>{notif.title}</p>
                        {/* ✅ Unread dot indicator */}
                        {!notif.is_read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{notif.message}</p>
                      <p className="text-xs text-gray-600 mt-1">{formatAge(notif.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <ChevronRight size={12} className="text-gray-600" />
                      <button
                        onClick={e => { e.stopPropagation(); dismiss(notif.id) }}
                        className="text-gray-700 hover:text-white"
                      >
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