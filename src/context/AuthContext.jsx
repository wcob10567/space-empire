import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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

    // Create homeworld planet
    const galaxy = Math.floor(Math.random() * 5) + 1
    const system = Math.floor(Math.random() * 499) + 1
    const position = Math.floor(Math.random() * 15) + 1

    const { data: planet, error: planetError } = await supabase.from('planets').insert({
      owner_id: data.user.id,
      name: `${username}'s Homeworld`,
      galaxy,
      system,
      position,
      is_homeworld: true,
    }).select().single()
    if (planetError) throw planetError

    // Create starting resources for homeworld
    await supabase.from('resources').insert({
      planet_id: planet.id,
      metal: 500,
      crystal: 300,
      deuterium: 100,
    })

    // Create starting buildings (all at level 0)
    const buildingTypes = [
      'metal_mine', 'crystal_mine', 'deuterium_synthesizer',
      'solar_plant', 'fusion_reactor',
      'metal_storage', 'crystal_storage', 'deuterium_tank',
      'robotics_factory', 'shipyard', 'research_lab',
      'nanite_factory', 'missile_silo',
    ]
    await supabase.from('buildings').insert(
      buildingTypes.map(type => ({ planet_id: planet.id, building_type: type }))
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
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
