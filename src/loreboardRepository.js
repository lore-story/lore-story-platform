import { DEFAULT_MATERIALS, DEFAULT_TIMER, restoreTimer } from './state.js'

export const LOREBOARD_STORAGE_KEY = 'loreboard-state-v1'
export const MAX_MATERIALS = 8
export const MAX_ASSIGNMENT_LENGTH = 220

export const DEFAULT_LOREBOARD_STATE = Object.freeze({
  phases: ['Ankommen', 'Entdecken', 'Vertiefen', 'Teilen'],
  activePhase: 0,
  assignment: 'Findet heraus, wie Lebewesen im Wald miteinander verbunden sind.',
  materials: DEFAULT_MATERIALS,
  timer: DEFAULT_TIMER,
  activeStory: 'moosarchiv',
  activeWorld: 'nebelmark',
})

function normalize(value, now = Date.now()) {
  const phases = Array.isArray(value?.phases) && value.phases.length
    ? value.phases.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim())
    : [...DEFAULT_LOREBOARD_STATE.phases]
  const materials = Array.isArray(value?.materials)
    ? value.materials.filter(item => typeof item === 'string' && item.trim()).slice(0, MAX_MATERIALS)
    : [...DEFAULT_MATERIALS]
  const timerStorage = { getItem: () => JSON.stringify(value?.timer ?? DEFAULT_TIMER) }
  return {
    phases,
    activePhase: Math.min(Math.max(0, Number(value?.activePhase) || 0), phases.length - 1),
    assignment: typeof value?.assignment === 'string' && value.assignment.trim()
      ? value.assignment.trim().slice(0, MAX_ASSIGNMENT_LENGTH)
      : DEFAULT_LOREBOARD_STATE.assignment,
    materials,
    timer: restoreTimer(timerStorage, now),
    activeStory: typeof value?.activeStory === 'string' ? value.activeStory : DEFAULT_LOREBOARD_STATE.activeStory,
    activeWorld: typeof value?.activeWorld === 'string' ? value.activeWorld : DEFAULT_LOREBOARD_STATE.activeWorld,
  }
}

/**
 * Browser-local adapter for the Loreboard repository contract.
 * A cloud adapter can implement the same asynchronous load/save methods later.
 * This adapter does not synchronize between browsers, devices, or accounts.
 */
export function createLocalLoreboardRepository(storage) {
  return {
    async load() {
      try {
        return normalize(JSON.parse(storage.getItem(LOREBOARD_STORAGE_KEY)))
      } catch {
        return normalize(null)
      }
    },
    async save(state) {
      const normalized = normalize(state)
      storage.setItem(LOREBOARD_STORAGE_KEY, JSON.stringify(normalized))
      return normalized
    },
  }
}

export function createLoreboardRepository(storage = window.localStorage) {
  return createLocalLoreboardRepository(storage)
}
