// Default values that every new planet starts with on the JS side.
// Note: process_arrived_fleets (SQL) and claim_starting_planet (SQL) duplicate
// these values server-side. If you change them here, mirror in the SQL functions
// or the colonize / signup flow drifts.

export const DEFAULT_RESOURCES = {
  metal: 500,
  crystal: 300,
  deuterium: 100,
}

// Random ranges used by claim_starting_planet for fresh planets — kept here for
// reference / future client-side use. SQL is currently the source of truth.
export const PLANET_GEN = {
  diameterMin: 12800,
  diameterRange: 4000,
  temperatureMin: -20,
  temperatureRange: 80,
  maxFieldsMin: 163,
  maxFieldsRange: 57,
}
