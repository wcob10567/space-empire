// Shared game-balance formulas. Before this file, every page reinvented
// the wheel: Buildings used 1.5^level for cost and (M+C)/2500/robotics for
// time, Research used 1.75^level / 1000 / lab, Shipyard used per-ship cost
// and 2500 / shipyard×2^nanite for time. Same shapes, different constants.
//
// One canonical helper per shape, parameters for the constants that vary.

/**
 * Scale a base cost by `multiplier^level`. Used for buildings (1.5) and
 * research (1.75). Caller picks the multiplier; we floor each component.
 */
export function scaleCost(baseCost, multiplier, level) {
  const m = Math.pow(multiplier, level)
  return {
    metal:     Math.floor((baseCost?.metal     ?? 0) * m),
    crystal:   Math.floor((baseCost?.crystal   ?? 0) * m),
    deuterium: Math.floor((baseCost?.deuterium ?? 0) * m),
  }
}

/**
 * Compute build/research time in seconds.
 *
 *   seconds = floor( (cost.metal + cost.crystal) / divisor / factor * 3600 * speed )
 *
 * - `divisor` = 2500 for buildings/ships, 1000 for research (game-balance constant).
 * - `factor`  = the speed-up factor from supporting buildings:
 *     buildings: max(1, 1 + roboticsLvl)
 *     ships:     max(1, shipyardLvl) * 2^naniteLvl
 *     research:  max(1, labLvl)
 * - `minSeconds` = floor (1 for buildings/ships, 5 for research).
 * - `applyDevSpeed` = whether to multiply by `window.__devSpeed` (only in DEV mode).
 *   Buildings + ships do; research historically didn't — keeping that parity.
 */
export function computeDuration({ cost, divisor, factor, minSeconds = 1, applyDevSpeed = false }) {
  const base = ((cost?.metal ?? 0) + (cost?.crystal ?? 0)) / divisor
  const speed = applyDevSpeed && import.meta.env.DEV ? (window.__devSpeed ?? 1) : 1
  const safeFactor = Math.max(1, factor || 1)
  return Math.max(minSeconds, Math.floor(base / safeFactor * 3600 * speed))
}
