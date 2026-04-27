// Centralized timing constants for polling, refresh intervals, and UI animations.
// Adjust these to tune how chatty the client is with the DB.

export const TICK = {
  // App-level: local resource ticker (no DB hit; values computed from buildings + last_updated)
  RESOURCES_MS: 5000,

  // App-level: process arrived fleets server-side, refresh planet list, refresh active-planet ships
  FLEET_PROCESS_MS: 3000,

  // App-level: NPC resource restock cadence
  NPC_RESTOCK_MS: 5 * 60 * 1000,

  // Per-page completion poll for setTimeout misses (research + building upgrades).
  // Will go away once the SQL completers in commit E ship.
  COMPLETION_POLL_MS: 2000,

  // Research page: refresh all-planets buildings + resources for the planet picker / state derivation
  RESEARCH_PLANET_DATA_MS: 5000,

  // Fleet page: refresh in-flight fleets local list (display only; server processes via FLEET_PROCESS_MS)
  FLEET_LIST_MS: 3000,

  // DevPanel: brief delay before window.location.reload after speed change so addLog renders
  DEV_RELOAD_DELAY_MS: 200,
}
