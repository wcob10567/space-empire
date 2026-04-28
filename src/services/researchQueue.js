// Research queue service. Account-wide (keyed on owner_id, not planet_id);
// each row picks a `source_planet_id` at queue time so we know which planet's
// resources to debit. The picker modal still runs at queue time — it just
// stores the choice on the row instead of dispatching immediately.

import { supabase } from '../lib/supabase'

export async function addToResearchQueue({ ownerId, techType, sourcePlanetId, cost, researchSeconds }) {
  const { data: existing, error: qErr } = await supabase
    .from('research_queue')
    .select('position')
    .eq('owner_id', ownerId)
    .order('position', { ascending: false })
    .limit(1)
  if (qErr) throw qErr
  const position = (existing?.[0]?.position ?? -1) + 1

  const { data, error } = await supabase.from('research_queue').insert({
    owner_id:         ownerId,
    tech_type:        techType,
    source_planet_id: sourcePlanetId,
    position,
    cost_metal:       cost?.metal     ?? 0,
    cost_crystal:     cost?.crystal   ?? 0,
    cost_deuterium:   cost?.deuterium ?? 0,
    research_seconds: researchSeconds,
  }).select().single()
  if (error) throw error
  return data
}

export async function cancelResearchQueue(queueRowId) {
  const { error } = await supabase.from('research_queue').delete().eq('id', queueRowId)
  if (error) throw error
}

/**
 * Reservation per source planet. Returns a map keyed by source_planet_id so
 * each planet's resource bar reflects only the queued research debited from it.
 */
export function sumResearchReservationByPlanet(queueRows) {
  const byPlanet = {}
  for (const q of queueRows ?? []) {
    const id = q.source_planet_id
    if (!byPlanet[id]) byPlanet[id] = { metal: 0, crystal: 0, deuterium: 0 }
    byPlanet[id].metal     += q.cost_metal     ?? 0
    byPlanet[id].crystal   += q.cost_crystal   ?? 0
    byPlanet[id].deuterium += q.cost_deuterium ?? 0
  }
  return byPlanet
}
