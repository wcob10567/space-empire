// Build-queue slot progression rules.
//
// Each queue (building / ship / research) has its own tier list. Tiers are
// either earned by progression (`check` returns true based on current levels)
// or paid (`paid: true`, unlocked by Rush Tokens — economy not built yet, so
// these always render as "coming soon" placeholders today).
//
// Total slots = (count of earned non-paid tiers) + (count of paid tiers
// the player has redeemed). For now, paid slots are always 0 redeemed.

export const BUILDING_SLOT_TIERS = [
  { slot: 1, label: 'Default',            requirement: 'Always available',                check: () => true },
  { slot: 2, label: 'Robotics Factory 4', requirement: 'Robotics Factory level 4',        check: ({ robotics } = {}) => (robotics ?? 0) >= 4 },
  { slot: 3, label: 'Robotics Factory 8', requirement: 'Robotics Factory level 8',        check: ({ robotics } = {}) => (robotics ?? 0) >= 8 },
  { slot: 4, label: 'Paid slot',          requirement: '1 Rush Token',                    paid: true },
  { slot: 5, label: 'Paid slot',          requirement: '1 Rush Token',                    paid: true },
  { slot: 6, label: 'Paid slot',          requirement: '1 Rush Token',                    paid: true },
  { slot: 7, label: 'Paid slot',          requirement: '1 Rush Token',                    paid: true },
]

export const SHIP_SLOT_TIERS = [
  { slot: 1, label: 'Default',            requirement: 'Always available',                check: () => true },
  { slot: 2, label: 'Shipyard 2',         requirement: 'Shipyard level 2',                check: ({ shipyard } = {}) => (shipyard ?? 0) >= 2 },
  { slot: 3, label: 'Robotics Factory 8', requirement: 'Robotics Factory level 8',        check: ({ robotics } = {}) => (robotics ?? 0) >= 8 },
  { slot: 4, label: 'Paid slot',          requirement: '1 Rush Token',                    paid: true },
  { slot: 5, label: 'Paid slot',          requirement: '1 Rush Token',                    paid: true },
  { slot: 6, label: 'Paid slot',          requirement: '1 Rush Token',                    paid: true },
  { slot: 7, label: 'Paid slot',          requirement: '1 Rush Token',                    paid: true },
]

// Research is account-wide → uses max-across-planets levels.
export const RESEARCH_SLOT_TIERS = [
  { slot: 1, label: 'Default',            requirement: 'Always available',                check: () => true },
  { slot: 2, label: 'Research Lab 2',     requirement: 'Research Lab level 2 (any planet)', check: ({ researchLab } = {}) => (researchLab ?? 0) >= 2 },
  { slot: 3, label: 'Robotics Factory 8', requirement: 'Robotics Factory level 8 (any planet)', check: ({ robotics } = {}) => (robotics ?? 0) >= 8 },
  { slot: 4, label: 'Paid slot',          requirement: '1 Rush Token',                    paid: true },
  { slot: 5, label: 'Paid slot',          requirement: '1 Rush Token',                    paid: true },
  { slot: 6, label: 'Paid slot',          requirement: '1 Rush Token',                    paid: true },
  { slot: 7, label: 'Paid slot',          requirement: '1 Rush Token',                    paid: true },
]

/**
 * Count free (non-paid) slots that the player has earned given their level state.
 * `levels` is an object like `{ robotics, shipyard, researchLab }`.
 */
export function countEarnedFreeSlots(tiers, levels) {
  return tiers.filter(t => !t.paid && t.check?.(levels)).length
}

/**
 * Returns the next non-earned tier (so the UI can say "next slot needs X").
 * Returns null if all free slots are already earned.
 */
export function nextFreeTier(tiers, levels) {
  return tiers.find(t => !t.paid && !t.check?.(levels)) ?? null
}
