import assert from 'node:assert/strict'
import test from 'node:test'
import { addStoryToFundus, DEFAULT_MATERIALS, DEFAULT_STATE, DEFAULT_TIMER, readMaterials, readState, restoreTimer } from '../src/state.js'
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
