import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STARTING_BUILDING_TYPES } from '../data/buildings'
import { DEFAULT_RESOURCES } from '../data/defaults'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  async function signUp(email, password, username) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error

    // Create profile
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      username,
    })
    if (profileError) throw profileError

   // Atomically claim a safe starting position
    const { data: placement, error: placementError } = await supabase
    .rpc('claim_starting_planet', {
        player_id: data.user.id,
        player_username: username,
    })
    if (placementError) throw placementError

    // Get the newly created planet
    const { data: planet, error: planetError } = await supabase
    .from('planets')
    .select('*')
    .eq('id', placement.planet_id)
    .single()
    if (planetError) throw planetError

    // Create starting resources + default building rows (level 0).
    // STARTING_BUILDING_TYPES excludes underground_vault — players upgrade it
    // from level 0 and the row is created lazily.
    await supabase.from('resources').insert({ planet_id: planet.id, ...DEFAULT_RESOURCES })
    await supabase.from('buildings').insert(
      STARTING_BUILDING_TYPES.map(type => ({ planet_id: planet.id, building_type: type }))
    )

    return data
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
