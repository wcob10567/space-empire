// Resource debit / credit service.
//
// Current implementation is a read-modify-write using the caller's cached
// resources value (matches the existing inline pattern in Buildings/Research/
// Shipyard/Fleet). It carries the same staleness risk those call sites already
// have. A future improvement is to replace with an atomic SQL RPC
// (UPDATE resources SET metal = metal - X) so concurrent debits can't desync.

import { supabase } from '../lib/supabase'

/**
 * Debit a cost from a planet's resources row.
 *
 * @param {string} planetId
 * @param {{metal:number, crystal:number, deuterium:number}} currentResources
 *   The caller's most recent snapshot of the planet's resources (so we don't
 *   re-fetch). Pass null/undefined fields treated as 0.
 * @param {{metal?:number, crystal?:number, deuterium?:number}} cost
 *
 * @returns {Promise<{metal:number, crystal:number, deuterium:number}>} the new values
 */
export async function debitResources(planetId, currentResources, cost) {
  const next = {
    metal:     (currentResources?.metal     ?? 0) - (cost.metal     ?? 0),
    crystal:   (currentResources?.crystal   ?? 0) - (cost.crystal   ?? 0),
    deuterium: (currentResources?.deuterium ?? 0) - (cost.deuterium ?? 0),
  }
  const { error } = await supabase.from('resources').update(next).eq('planet_id', planetId)
  if (error) throw error
  return next
}

/**
 * Credit cargo into a planet's resources row, capped at the storage caps.
 * Mirrors the SQL `least(metal + cargo, metal_cap)` pattern but on the client.
 *
 * Use sparingly — the SQL side already does this for fleet returns / transports.
 * This is here for any client-only credit paths (e.g. dev tools).
 */
export async function creditResources(planetId, currentResources, cargo) {
  const cap = {
    metal:     currentResources?.metal_cap     ?? Infinity,
    crystal:   currentResources?.crystal_cap   ?? Infinity,
    deuterium: currentResources?.deuterium_cap ?? Infinity,
  }
  const next = {
    metal:     Math.min((currentResources?.metal     ?? 0) + (cargo.metal     ?? 0), cap.metal),
    crystal:   Math.min((currentResources?.crystal   ?? 0) + (cargo.crystal   ?? 0), cap.crystal),
    deuterium: Math.min((currentResources?.deuterium ?? 0) + (cargo.deuterium ?? 0), cap.deuterium),
  }
  const { error } = await supabase.from('resources').update(next).eq('planet_id', planetId)
  if (error) throw error
  return next
}
