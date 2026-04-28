// Centralized Supabase query helpers. One place to grep when changing how a
// table is loaded, and a single source for query shapes used across pages.
//
// These return the supabase query builder (an awaitable thenable), so callers
// can `await` them or chain further if they need to.

import { supabase } from '../lib/supabase'

export const queries = {
  // Per-planet
  resources:  (planetId) => supabase.from('resources').select('*').eq('planet_id', planetId).single(),
  buildings:  (planetId) => supabase.from('buildings').select('*').eq('planet_id', planetId),
  ships:      (planetId) => supabase.from('ships').select('*').eq('planet_id', planetId),

  // Per-user
  planetsForUser:  (userId) => supabase.from('planets').select('*')
    .eq('owner_id', userId)
    .order('is_homeworld', { ascending: false })
    .order('created_at', { ascending: true }),
  researchForUser: (userId) => supabase.from('research').select('*').eq('owner_id', userId),
  fleetsInFlight:  (userId) => supabase.from('fleets').select('*')
    .eq('owner_id', userId)
    .eq('status', 'in_flight')
    .order('arrives_at', { ascending: true }),

  // Bulk multi-planet (e.g. research planet picker)
  buildingsForPlanets: (planetIds) => supabase.from('buildings').select('*').in('planet_id', planetIds),
  resourcesForPlanets: (planetIds) => supabase.from('resources').select('*').in('planet_id', planetIds),

  // Build queue (per planet, ordered)
  buildingQueue: (planetId) => supabase.from('building_queue').select('*')
    .eq('planet_id', planetId)
    .order('position', { ascending: true }),

  // Ship queue (per planet, ordered)
  shipQueue: (planetId) => supabase.from('ship_queue').select('*')
    .eq('planet_id', planetId)
    .order('position', { ascending: true }),

  // Research queue (account-wide, ordered)
  researchQueue: (ownerId) => supabase.from('research_queue').select('*')
    .eq('owner_id', ownerId)
    .order('position', { ascending: true }),
}
