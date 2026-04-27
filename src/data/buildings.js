// Building definitions — single source of truth for the building list.
// Imported by Buildings (rich data), AuthContext (signup seeding), DevPanel (type list),
// and matched in process_arrived_fleets SQL for colonize seeding (manually mirrored).

export const BUILDINGS = [
  {
    type: 'metal_mine',
    name: 'Metal Mine',
    category: 'Resources',
    description: 'Extracts metal ore from the planet surface.',
    icon: '⛏️',
    baseCost: { metal: 60, crystal: 15 },
    baseProd: (lvl) => Math.floor(30 * lvl * Math.pow(1.1, lvl)),
    energyUse: (lvl) => Math.floor(10 * lvl * Math.pow(1.1, lvl)),
  },
  {
    type: 'crystal_mine',
    name: 'Crystal Mine',
    category: 'Resources',
    description: 'Harvests crystal formations beneath the crust.',
    icon: '💎',
    baseCost: { metal: 48, crystal: 24 },
    baseProd: (lvl) => Math.floor(20 * lvl * Math.pow(1.1, lvl)),
    energyUse: (lvl) => Math.floor(10 * lvl * Math.pow(1.1, lvl)),
  },
  {
    type: 'deuterium_synthesizer',
    name: 'Deuterium Synthesizer',
    category: 'Resources',
    description: 'Extracts deuterium from the atmosphere.',
    icon: '🔵',
    baseCost: { metal: 225, crystal: 75 },
    baseProd: (lvl) => Math.floor(10 * lvl * Math.pow(1.1, lvl)),
    energyUse: (lvl) => Math.floor(20 * lvl * Math.pow(1.1, lvl)),
  },
  {
    type: 'solar_plant',
    name: 'Solar Plant',
    category: 'Energy',
    description: 'Converts solar energy into usable power.',
    icon: '☀️',
    baseCost: { metal: 75, crystal: 30 },
    baseProd: (lvl) => Math.floor(20 * lvl * Math.pow(1.1, lvl)),
    energyUse: () => 0,
  },
  {
    type: 'fusion_reactor',
    name: 'Fusion Reactor',
    category: 'Energy',
    description: 'Advanced energy source using deuterium fusion.',
    icon: '⚡',
    baseCost: { metal: 900, crystal: 360, deuterium: 180 },
    baseProd: (lvl) => Math.floor(30 * lvl * Math.pow(1.05, lvl)),
    energyUse: () => 0,
  },
  {
    type: 'metal_storage',
    name: 'Metal Storage',
    category: 'Storage',
    description: 'Increases metal storage capacity.',
    icon: '🏭',
    baseCost: { metal: 1000, crystal: 0 },
    baseProd: () => 0,
    energyUse: () => 0,
  },
  {
    type: 'crystal_storage',
    name: 'Crystal Storage',
    category: 'Storage',
    description: 'Increases crystal storage capacity.',
    icon: '🔷',
    baseCost: { metal: 1000, crystal: 500 },
    baseProd: () => 0,
    energyUse: () => 0,
  },
  {
    type: 'deuterium_tank',
    name: 'Deuterium Tank',
    category: 'Storage',
    description: 'Increases deuterium storage capacity.',
    icon: '🛢️',
    baseCost: { metal: 1000, crystal: 1000 },
    baseProd: () => 0,
    energyUse: () => 0,
  },
  {
    type: 'robotics_factory',
    name: 'Robotics Factory',
    category: 'Facilities',
    description: 'Reduces construction time for all buildings.',
    icon: '🤖',
    baseCost: { metal: 400, crystal: 120, deuterium: 200 },
    baseProd: () => 0,
    energyUse: () => 0,
  },
  {
    type: 'shipyard',
    name: 'Shipyard',
    category: 'Facilities',
    description: 'Required to build ships and defenses.',
    icon: '🚀',
    baseCost: { metal: 400, crystal: 200, deuterium: 100 },
    baseProd: () => 0,
    energyUse: () => 0,
  },
  {
    type: 'research_lab',
    name: 'Research Lab',
    category: 'Facilities',
    description: 'Required to research new technologies.',
    icon: '🔬',
    baseCost: { metal: 200, crystal: 400, deuterium: 200 },
    baseProd: () => 0,
    energyUse: () => 0,
  },
  {
    type: 'nanite_factory',
    name: 'Nanite Factory',
    category: 'Facilities',
    description: 'Drastically reduces all construction times.',
    icon: '🧬',
    baseCost: { metal: 1000000, crystal: 500000, deuterium: 100000 },
    baseProd: () => 0,
    energyUse: () => 0,
  },
  {
    type: 'missile_silo',
    name: 'Missile Silo',
    category: 'Facilities',
    description: 'Stores and launches interplanetary missiles.',
    icon: '🎯',
    baseCost: { metal: 20000, crystal: 20000, deuterium: 1000 },
    baseProd: () => 0,
    energyUse: () => 0,
  },
  {
    type: 'underground_vault',
    name: 'Underground Vault',
    category: 'Storage',
    description: 'Hides a portion of your resources from raiders. Higher levels protect more.',
    icon: '🔒',
    baseCost: { metal: 20000, crystal: 10000, deuterium: 0 },
    baseProd: () => 0,
    energyUse: () => 0,
    // Each level increases base bunker % by 1.5% up to 15% at level 10
    vaultBonus: (lvl) => Math.min(15, Math.floor(lvl * 1.5)),
  },
]

// Derived lookups
export const ALL_BUILDING_TYPES = BUILDINGS.map(b => b.type)
export const BUILDING_BY_TYPE   = Object.fromEntries(BUILDINGS.map(b => [b.type, b]))

// The 13 buildings seeded at signup (AuthContext) and at colonization
// (process_arrived_fleets SQL). underground_vault is intentionally omitted —
// players upgrade it from level 0 and the row is created lazily at upgrade time.
export const STARTING_BUILDING_TYPES = ALL_BUILDING_TYPES.filter(t => t !== 'underground_vault')

export const BUILDING_CATEGORIES = ['Resources', 'Energy', 'Storage', 'Facilities']
