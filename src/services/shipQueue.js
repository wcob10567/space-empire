// Ship queue service. Mirrors buildQueue.js — same shape:
//   addToShipQueue → INSERT a row (position = max+1, computed from DB)
//   cancelShipQueue → DELETE by id
//   sumShipReservation → cost columns summed for the resource bar
//
// One queue row = one "build N of ship X" job. The full cost (per_ship × qty)
// is snapshotted at queue time and acts as the reservation until process_ship_queue()
// pulls the row to head, deducts the full cost from balance, and starts ticking
// ships out one every build_seconds_per_ship.

import { supabase } from '../lib/supabase'

export async function addToShipQueue({ planetId, shipType, qty, cost, buildSecondsPerShip }) {
  const { data: existing, error: qErr } = await supabase
    .from('ship_queue')
    .select('position')
    .eq('planet_id', planetId)
    .order('position', { ascending: false })
    .limit(1)
  if (qErr) throw qErr
  const position = (existing?.[0]?.position ?? -1) + 1

  const { data, error } = await supabase.from('ship_queue').insert({
    planet_id:                planetId,
    ship_type:                shipType,
    qty,
    position,
    cost_metal:               cost?.metal     ?? 0,
    cost_crystal:             cost?.crystal   ?? 0,
    cost_deuterium:           cost?.deuterium ?? 0,
    build_seconds_per_ship:   buildSecondsPerShip,
  }).select().single()
  if (error) throw error
  return data
}

export async function cancelShipQueue(queueRowId) {
  // A row that's already started (started_at set, ships_completed > 0) has
  // cost already deducted — cancelling forfeits the in-progress build.
  // For simplicity v1, allow cancel either way; refund logic for partial
  // builds can come later if needed.
  const { error } = await supabase.from('ship_queue').delete().eq('id', queueRowId)
  if (error) throw error
}

export function sumShipReservation(queueRows) {
  // Only count rows that haven't started yet — once started_at is set, the
  // cost has been deducted from balance and is no longer reserved.
  return (queueRows ?? [])
    .filter(q => !q.started_at)
    .reduce((acc, q) => ({
      metal:     acc.metal     + (q.cost_metal     ?? 0),
      crystal:   acc.crystal   + (q.cost_crystal   ?? 0),
      deuterium: acc.deuterium + (q.cost_deuterium ?? 0),
    }), { metal: 0, crystal: 0, deuterium: 0 })
}
