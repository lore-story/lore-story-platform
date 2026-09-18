import test from 'node:test'
import assert from 'node:assert/strict'
import { addScene, createProject, deleteScene, duplicateScene, LAYOUTS, moveScene, SCENE_TYPES, validateMetadata } from '../src/workshop/model.js'

test('a mission starts as a versioned draft with one scene', () => {
  const project = createProject({ title: '  Signal  ', description: 'Start', audience_level: 'class-3-6', availability_type: 'free' })
  assert.equal(project.title, 'Signal')
  assert.equal(project.status, 'draft')
  assert.equal(project.schema_version, 1)
  assert.equal(project.world_id, null)
  assert.equal(project.scenes.length, 1)
})

test('free and world missions remain unambiguous', () => {
  const free = createProject({ title: 'Frei', description: '', audience_level: 'custom', availability_type: 'free', world_id: 'astra' })
  const bound = createProject({ title: 'Welt', description: '', audience_level: 'class-1-2', availability_type: 'world', world_id: 'astra' })
  assert.equal(free.world_id, null)
  assert.equal(bound.world_id, 'astra')
  assert.deepEqual(validateMetadata({ ...bound, world_id: '' }), { world_id: 'Bitte wähle eine Welt.' })
})

test('scenes can be added, duplicated, reordered, and never all deleted', () => {
  let scenes = createProject({ title: 'Test', description: '', audience_level: 'class-3-6', availability_type: 'free' }).scenes
  assert.equal(deleteScene(scenes, 0), scenes)
  scenes = addScene(scenes)
  scenes = duplicateScene(scenes, 0)
  assert.equal(scenes.length, 3)
  assert.match(scenes[1].title, /Kopie/)
  const movedId = scenes[1].id
  scenes = moveScene(scenes, 1, 1)
  assert.equal(scenes[2].id, movedId)
  assert.deepEqual(scenes.map(scene => scene.position), [0, 1, 2])
  scenes = deleteScene(scenes, 1)
  assert.deepEqual(scenes.map(scene => scene.position), [0, 1])
})

test('stage one exposes exactly three scene types and three fixed layouts', () => {
  assert.deepEqual(Object.keys(SCENE_TYPES), ['narrative', 'assignment', 'transition'])
  assert.deepEqual(Object.keys(LAYOUTS), ['text', 'media', 'split'])
})

test('multiline assignments preserve intentional line breaks', () => {
  const scene = createProject({ title: 'Test', description: '', audience_level: 'class-7-12', availability_type: 'free' }).scenes[0]
  scene.scene_type = 'assignment'
  scene.content.assignment = 'Erste Zeile\n\nDritte Zeile'
  assert.equal(scene.content.assignment.split('\n').length, 3)
  assert.match(scene.content.assignment, /\n\n/)
})
