import assert from 'node:assert/strict'
import test from 'node:test'
import { addStoryToFundus, DEFAULT_STATE, readState } from '../src/state.js'

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
