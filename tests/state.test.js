import assert from 'node:assert/strict'
import test from 'node:test'
import { addStoryToFundus, DEFAULT_MATERIALS, DEFAULT_STATE, DEFAULT_TIMER, readMaterials, readState, restoreTimer, timerRemaining } from '../src/state.js'
import { createLocalLoreboardRepository, LOREBOARD_STORAGE_KEY, MAX_ASSIGNMENT_LENGTH, MAX_MATERIALS } from '../src/loreboardRepository.js'

test('starts with a usable demo story when storage is empty', () => {
  const state = readState({ getItem: () => null })

  assert.deepEqual(state, DEFAULT_STATE)
})

test('restores a persisted market and loreboard selection', () => {
  const state = readState({
    getItem: () => JSON.stringify({
      loggedIn: true,
      fundus: ['moosarchiv', 'sternenuhr'],
      activeStory: 'sternenuhr',
      activeWorld: 'aether',
    }),
  })

  assert.equal(state.loggedIn, true)
  assert.deepEqual(state.fundus, ['moosarchiv', 'sternenuhr'])
  assert.equal(state.activeStory, 'sternenuhr')
  assert.equal(state.activeWorld, 'aether')
})

test('adds market stories once and preserves the existing collection', () => {
  const original = ['moosarchiv']
  const expanded = addStoryToFundus(original, 'korallenrat')

  assert.deepEqual(expanded, ['moosarchiv', 'korallenrat'])
  assert.deepEqual(original, ['moosarchiv'])
  assert.equal(addStoryToFundus(expanded, 'korallenrat'), expanded)
})

test('restores editable materials and falls back for invalid data', () => {
  assert.deepEqual(readMaterials({ getItem: () => '["Schere","Kleber"]' }), ['Schere', 'Kleber'])
  assert.deepEqual(readMaterials({ getItem: () => '[true,false]' }), DEFAULT_MATERIALS)
})

test('restores a running timer from its target time', () => {
  const timer = restoreTimer({ getItem: () => JSON.stringify({
    duration: 300,
    remaining: 290,
    status: 'running',
    startedAt: 1_000,
    targetAt: 101_000,
  }) }, 41_000)

  assert.deepEqual(timer, { duration: 300, remaining: 60, status: 'running', startedAt: 1_000, targetAt: 101_000 })
})

test('derives a running timer display locally without changing its persisted state', () => {
  const timer = { duration: 60, remaining: 60, status: 'running', startedAt: 1_000, targetAt: 61_000 }

  assert.equal(timerRemaining(timer, 1_000), 60)
  assert.equal(timerRemaining(timer, 2_001), 59)
  assert.equal(timerRemaining(timer, 61_000), 0)
  assert.equal(timer.remaining, 60)
})

test('keeps paused timers paused and marks elapsed running timers expired', () => {
  const paused = restoreTimer({ getItem: () => JSON.stringify({ duration: 90, remaining: 42, status: 'paused', startedAt: 1_000, targetAt: null }) }, 80_000)
  const expired = restoreTimer({ getItem: () => JSON.stringify({ duration: 5, remaining: 3, status: 'running', startedAt: 1_000, targetAt: 6_000 }) }, 10_000)

  assert.equal(paused.status, 'paused')
  assert.equal(paused.remaining, 42)
  assert.equal(expired.status, 'expired')
  assert.equal(expired.remaining, 0)
})

test('the asynchronous Loreboard repository saves and restores the complete board state', async () => {
  const values = new Map()
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  const repository = createLocalLoreboardRepository(storage)
  const saved = await repository.save({
    phases: ['Start', 'Ende'], activePhase: 1, assignment: 'Gemeinsam forschen',
    materials: Array.from({ length: 9 }, (_, index) => `Material ${index + 1}`),
    timer: { duration: 120, remaining: 42, status: 'paused', startedAt: 10, targetAt: null },
    activeStory: 'sternenuhr', activeWorld: 'aether',
  })

  assert.ok(values.has(LOREBOARD_STORAGE_KEY))
  assert.equal(saved.materials.length, MAX_MATERIALS)
  assert.deepEqual(await repository.load(), saved)
})

test('the Loreboard repository constrains projection content and tolerates broken storage', async () => {
  const repository = createLocalLoreboardRepository({ getItem: () => '{broken', setItem: () => {} })
  const defaults = await repository.load()
  const constrained = await repository.save({ assignment: 'x'.repeat(MAX_ASSIGNMENT_LENGTH + 20), materials: [], timer: DEFAULT_TIMER })

  assert.deepEqual(defaults.materials, DEFAULT_MATERIALS)
  assert.equal(constrained.assignment.length, MAX_ASSIGNMENT_LENGTH)
})

import { authErrorMessage, signIn, signUp } from '../src/auth.js'
import { createSupabaseLoreboardRepository, DEFAULT_LOREBOARD_STATE } from '../src/loreboardRepository.js'

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values }
}

function cloudMock(existing = null, { updateError = null } = {}) {
  let row = existing
  const calls = []
  const client = { from(table) {
    assert.equal(table, 'loreboards')
    let operation = 'select'; let payload; const filters = {}
    const query = {
      select() { return query }, eq(key, value) { filters[key] = value; return query }, order() { return query }, limit() { return query },
      insert(value) { operation = 'insert'; payload = value; return query }, update(value) { operation = 'update'; payload = value; return query },
      async maybeSingle() { return run() }, async single() { return run() },
    }
    async function run() {
      calls.push({ operation, payload, filters })
      if (operation === 'select') return { data: row, error: null }
      if (operation === 'insert') { row = { id: 'board', state: payload.state, updated_at: '2026-01-01T00:00:00Z' }; return { data: row, error: null } }
      if (updateError) return { data: null, error: updateError }
      if (filters.updated_at !== row.updated_at) return { data: null, error: null }
      row = { ...row, state: payload.state, updated_at: '2026-01-01T00:00:01Z' }
      return { data: { updated_at: row.updated_at }, error: null }
    }
    return query
  } }
  return { client, calls, getRow: () => row }
}

test('registration reports required email confirmation and sign-in returns a session', async () => {
  const session = { user: { id: 'u1' } }
  assert.deepEqual(await signUp({ auth: { signUp: async input => ({ data: { session: null, input }, error: null }) } }, 'neu@example.de', 'secret1'), { session: null, confirmationRequired: true })
  assert.equal(await signIn({ auth: { signInWithPassword: async () => ({ data: { session }, error: null }) } }, 'a@b.de', 'secret1'), session)
})

test('authentication exposes understandable German errors', async () => {
  await assert.rejects(() => signIn({ auth: { signInWithPassword: async () => ({ data: {}, error: { message: 'Invalid login credentials' } }) } }, 'a@b.de', 'wrong'), error => error.message === 'Invalid login credentials')
  assert.equal(authErrorMessage({ message: 'Invalid login credentials' }), 'E-Mail-Adresse oder Passwort ist nicht korrekt.')
  assert.equal(authErrorMessage({ message: 'Email not confirmed' }), 'Bitte bestätige zuerst deine E-Mail-Adresse.')
})

test('first cloud load creates a board and migrates existing local state once', async () => {
  const local = memoryStorage({ [LOREBOARD_STORAGE_KEY]: JSON.stringify({ ...DEFAULT_LOREBOARD_STATE, assignment: 'Mein lokaler Stand' }) })
  const cloud = cloudMock()
  const repository = createSupabaseLoreboardRepository(cloud.client, { id: 'u1' }, local)
  assert.equal((await repository.load()).assignment, 'Mein lokaler Stand')
  assert.equal(cloud.getRow().state.assignment, 'Mein lokaler Stand')
  assert.equal(local.getItem(`${LOREBOARD_STORAGE_KEY}:migrated:u1`), 'local')
})

test('existing cloud data has priority over local demo data', async () => {
  const cloudState = { ...DEFAULT_LOREBOARD_STATE, assignment: 'Cloud gewinnt' }
  const cloud = cloudMock({ id: 'board', state: cloudState, updated_at: '2026-01-01T00:00:00Z' })
  const local = memoryStorage({ [LOREBOARD_STORAGE_KEY]: JSON.stringify({ ...DEFAULT_LOREBOARD_STATE, assignment: 'Lokal' }) })
  const loaded = await createSupabaseLoreboardRepository(cloud.client, { id: 'u1' }, local).load()
  assert.equal(loaded.assignment, 'Cloud gewinnt')
  assert.equal(JSON.parse(local.getItem(LOREBOARD_STORAGE_KEY)).assignment, 'Cloud gewinnt')
})

test('a running cloud timer is restored from its absolute target in another browser', async () => {
  const targetAt = Date.now() + 10_000
  const cloudState = { ...DEFAULT_LOREBOARD_STATE, timer: { duration: 60, remaining: 60, status: 'running', startedAt: Date.now(), targetAt } }
  const cloud = cloudMock({ id: 'board', state: cloudState, updated_at: '2026-01-01T00:00:00Z' })
  const otherBrowser = memoryStorage()

  const restored = await createSupabaseLoreboardRepository(cloud.client, { id: 'u1' }, otherBrowser).load()

  assert.equal(restored.timer.status, 'running')
  assert.ok(restored.timer.remaining > 0 && restored.timer.remaining <= 10)
  assert.equal(restored.timer.targetAt, targetAt)
  assert.equal(JSON.parse(otherBrowser.getItem(LOREBOARD_STORAGE_KEY)).timer.targetAt, targetAt)
})

test('cloud saves are user-bound, revision checked, and keep the local fallback on failure', async () => {
  const cloud = cloudMock({ id: 'board', state: DEFAULT_LOREBOARD_STATE, updated_at: '2026-01-01T00:00:00Z' }, { updateError: new Error('offline') })
  const local = memoryStorage()
  const repository = createSupabaseLoreboardRepository(cloud.client, { id: 'u1' }, local)
  await repository.load()
  await assert.rejects(() => repository.save({ ...DEFAULT_LOREBOARD_STATE, assignment: 'Offline erhalten' }), /offline/)
  assert.equal(JSON.parse(local.getItem(LOREBOARD_STORAGE_KEY)).assignment, 'Offline erhalten')
  const update = cloud.calls.find(call => call.operation === 'update')
  assert.deepEqual(update.filters, { id: 'board', user_id: 'u1', updated_at: '2026-01-01T00:00:00Z' })
})
