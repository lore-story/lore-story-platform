import assert from 'node:assert/strict'
import test from 'node:test'
import { addStoryToFundus, DEFAULT_MATERIALS, DEFAULT_STATE, readMaterials, readState, restoreTimer } from '../src/state.js'

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
