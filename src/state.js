export const DEFAULT_STATE = Object.freeze({
  view: 'overview',
  fundus: ['moosarchiv'],
  activeStory: 'moosarchiv',
  activeWorld: 'nebelmark',
})

export function readState(storage) {
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(storage.getItem('lore-state')) }
  } catch {
    return { ...DEFAULT_STATE, fundus: [...DEFAULT_STATE.fundus] }
  }
}

export function addStoryToFundus(fundus, storyId) {
  return fundus.includes(storyId) ? fundus : [...fundus, storyId]
}

export const DEFAULT_MATERIALS = Object.freeze([
  'Lernjournal und Stift',
  'Forscherkarten',
  'Tablet oder Buch',
])

export const DEFAULT_TIMER = Object.freeze({
  duration: 600,
  remaining: 600,
  status: 'ready',
  startedAt: null,
  targetAt: null,
})

export function timerRemaining(timer, now = Date.now()) {
  if (timer.status !== 'running' || !Number.isFinite(timer.targetAt)) return timer.remaining
  return Math.max(0, Math.ceil((timer.targetAt - now) / 1000))
}

export function readMaterials(storage) {
  try {
    const saved = JSON.parse(storage.getItem('lore-materials'))
    return Array.isArray(saved) && saved.every(item => typeof item === 'string')
      ? saved
      : [...DEFAULT_MATERIALS]
  } catch {
    return [...DEFAULT_MATERIALS]
  }
}

export function restoreTimer(storage, now = Date.now()) {
  try {
    const saved = JSON.parse(storage.getItem('lore-timer'))
    const duration = Number.isFinite(saved?.duration) && saved.duration >= 0 ? saved.duration : DEFAULT_TIMER.duration
    const remaining = Number.isFinite(saved?.remaining) && saved.remaining >= 0 ? saved.remaining : duration
    if (saved?.status === 'running' && Number.isFinite(saved.targetAt)) {
      const restoredRemaining = Math.max(0, Math.ceil((saved.targetAt - now) / 1000))
      return { duration, remaining: restoredRemaining, status: restoredRemaining ? 'running' : 'expired', startedAt: saved.startedAt ?? null, targetAt: restoredRemaining ? saved.targetAt : null }
    }
    const status = ['ready', 'paused', 'expired'].includes(saved?.status) ? saved.status : 'ready'
    return { duration, remaining: status === 'expired' ? 0 : remaining, status, startedAt: saved?.startedAt ?? null, targetAt: null }
  } catch {
    return { ...DEFAULT_TIMER }
  }
}
