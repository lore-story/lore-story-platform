import { DEFAULT_MATERIALS, DEFAULT_TIMER, restoreTimer } from './state.js'

export const LOREBOARD_STORAGE_KEY = 'loreboard-state-v1'
export const MAX_MATERIALS = 8
export const MAX_ASSIGNMENT_LENGTH = 220
export const MAX_ASSIGNMENT_LINES = 8
export const DEFAULT_LOREBOARD_STATE = Object.freeze({ phases: ['Ankommen', 'Entdecken', 'Vertiefen', 'Teilen'], activePhase: 0, assignment: 'Findet heraus, wie Lebewesen im Wald miteinander verbunden sind.', materials: DEFAULT_MATERIALS, timer: DEFAULT_TIMER, noiseLevel: 'Partner', activeStory: 'moosarchiv', activeWorld: 'nebelmark', presentationWorldId: 'nebelmark' })

export function normalizeLoreboard(value, now = Date.now()) {
  const phases = Array.isArray(value?.phases) && value.phases.length ? value.phases.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()) : [...DEFAULT_LOREBOARD_STATE.phases]
  const materials = Array.isArray(value?.materials) ? value.materials.filter(x => typeof x === 'string' && x.trim()).slice(0, MAX_MATERIALS) : [...DEFAULT_MATERIALS]
  const activeWorld = typeof value?.activeWorld === 'string' ? value.activeWorld : DEFAULT_LOREBOARD_STATE.activeWorld
  const assignment = typeof value?.assignment === 'string' && value.assignment.trim()
    ? value.assignment.split('\n').slice(0, MAX_ASSIGNMENT_LINES).join('\n').slice(0, MAX_ASSIGNMENT_LENGTH)
    : DEFAULT_LOREBOARD_STATE.assignment
  return { phases, activePhase: Math.min(Math.max(0, Number(value?.activePhase) || 0), phases.length - 1), assignment, materials, timer: restoreTimer({ getItem: () => JSON.stringify(value?.timer ?? DEFAULT_TIMER) }, now), noiseLevel: ['Leise','Partner','Frei'].includes(value?.noiseLevel) ? value.noiseLevel : DEFAULT_LOREBOARD_STATE.noiseLevel, activeStory: typeof value?.activeStory === 'string' ? value.activeStory : DEFAULT_LOREBOARD_STATE.activeStory, activeWorld, presentationWorldId: typeof value?.presentationWorldId === 'string' ? value.presentationWorldId : activeWorld }
}

export function createLocalLoreboardRepository(storage) {
  return {
    hasSavedState: () => storage.getItem(LOREBOARD_STORAGE_KEY) !== null,
    async load() { try { return normalizeLoreboard(JSON.parse(storage.getItem(LOREBOARD_STORAGE_KEY))) } catch { return normalizeLoreboard(null) } },
    async save(state) { const value = normalizeLoreboard(state); storage.setItem(LOREBOARD_STORAGE_KEY, JSON.stringify(value)); return value },
  }
}

export function createSupabaseLoreboardRepository(client, user, storage = window.localStorage) {
  if (!user?.id) throw new Error('Für den Cloud-Zugriff ist eine gültige Sitzung erforderlich.')
  const local = createLocalLoreboardRepository(storage)
  const migrationKey = `${LOREBOARD_STORAGE_KEY}:migrated:${user.id}`
  let rowId = null
  let revision = null
  let queue = Promise.resolve()
  const repository = { offline: false, load, save }
  function load() {
    queue = queue.catch(() => undefined).then(loadNow)
    return queue
  }
  async function loadNow() {
    let result
    try { result = await client.from('loreboards').select('id,state,updated_at').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(1).maybeSingle() } catch { repository.offline = true; return local.load() }
    const { data, error } = result
    if (error) { repository.offline = true; return local.load() }
    if (data) {
      repository.offline = false; rowId = data.id; revision = data.updated_at
      const value = normalizeLoreboard(data.state); await local.save(value); storage.setItem(migrationKey, 'cloud'); return value
    }
    const migrateLocal = local.hasSavedState() && !storage.getItem(migrationKey)
    const initial = migrateLocal ? await local.load() : normalizeLoreboard(null)
    const { data: created, error: createError } = await client.from('loreboards').insert({ user_id: user.id, name: 'Mein Loreboard', state: initial }).select('id,state,updated_at').single()
    if (createError) throw createError
    repository.offline = false; rowId = created.id; revision = created.updated_at; storage.setItem(migrationKey, migrateLocal ? 'local' : 'default'); await local.save(initial)
    return normalizeLoreboard(created.state)
  }
  function save(state) {
    const snapshot = normalizeLoreboard(state)
    queue = queue.catch(() => undefined).then(async () => {
      await local.save(snapshot)
      if (!rowId) throw new Error('Das Loreboard wurde noch nicht geladen.')
      let query = client.from('loreboards').update({ state: snapshot }).eq('id', rowId).eq('user_id', user.id)
      if (revision) query = query.eq('updated_at', revision)
      const { data, error } = await query.select('updated_at').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Speicherkonflikt: Das Loreboard wurde zwischenzeitlich geändert.')
      revision = data.updated_at
      return snapshot
    })
    return queue
  }
  return repository
}
