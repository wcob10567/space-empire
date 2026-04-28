// Building queue service.
//
// Queues are per-planet, ordered by `position`. Reservations (cost columns)
// are checked against `available = balance - reservation` at the call site;
// no balance change happens here — only when process_building_queue() starts
// the head of the queue server-side.

import { supabase } from '../lib/supabase'

/**
 * Insert a new queue row at the next position for this planet.
 *
 * Position is computed as max(existing position) + 1 from the DB. This avoids
 * a stale-local-state race AND the gap left when process_building_queue()
 * deletes a head row without compacting the rest (which used to violate the
 * unique (planet_id, position) index when the local queueLen lined up with
 * an existing row's position).
 *
 * @param {{
 *   planetId: string,
 *   buildingType: string,
 *   cost: { metal:number, crystal:number, deuterium:number },
 *   buildSeconds: number,        // snapshotted at queue time
 * }} args
 * @returns {Promise<object>} the inserted row
 */
export async function addToBuildingQueue({ planetId, buildingType, cost, buildSeconds }) {
  const { data: existing, error: qErr } = await supabase
    .from('building_queue')
    .select('position')
    .eq('planet_id', planetId)
    .order('position', { ascending: false })
    .limit(1)
  if (qErr) throw qErr
  const position = (existing?.[0]?.position ?? -1) + 1

  const { data, error } = await supabase.from('building_queue').insert({
    planet_id:      planetId,
    building_type:  buildingType,
    position,
    cost_metal:     cost?.metal     ?? 0,
    cost_crystal:   cost?.crystal   ?? 0,
    cost_deuterium: cost?.deuterium ?? 0,
    build_seconds:  buildSeconds,
  }).select().single()
  if (error) throw error
  return data
}

/**
 * Cancel (delete) a queued row by id. Reservation is released; balance unchanged.
 */
export async function cancelBuildingQueue(queueRowId) {
  const { error } = await supabase.from('building_queue').delete().eq('id', queueRowId)
  if (error) throw error
}

/**
 * Sum the cost columns of an array of queue rows. Used to compute the
 * reservation total displayed in the resource bar.
 */
export function sumReservation(queueRows) {
  return (queueRows ?? []).reduce((acc, q) => ({
    metal:     acc.metal     + (q.cost_metal     ?? 0),
    crystal:   acc.crystal   + (q.cost_crystal   ?? 0),
    deuterium: acc.deuterium + (q.cost_deuterium ?? 0),
  }), { metal: 0, crystal: 0, deuterium: 0 })
}
