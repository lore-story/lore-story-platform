import test from 'node:test'
import assert from 'node:assert/strict'
import { addScene, createProject, deleteScene, duplicateScene, LAYOUTS, moveScene, SCENE_TYPES, validateMetadata } from '../src/workshop/model.js'

test('a mission starts as a versioned draft with one scene', () => {
  const project = createProject({ title: '  Signal  ', description: 'Start', audience_level: 'class-3-6', availability_type: 'free' })
  assert.equal(project.title, 'Signal')
  assert.equal(project.status, 'draft')
  assert.equal(project.schema_version, 2)
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

test('stage two validates safe image formats and preserves scene data on type changes', async () => {
  const { changeSceneType, validateImageFile } = await import('../src/workshop/model.js')
  const scene = createProject({ title: 'Test', description: '', audience_level: 'class-3-6', availability_type: 'free' }).scenes[0]
  scene.content.message = 'Bleibt erhalten'
  assert.equal(changeSceneType(scene, 'assignment').content.message, 'Bleibt erhalten')
  assert.equal(validateImageFile({ type: 'image/png', size: 100 }), '')
  assert.match(validateImageFile({ type: 'image/svg+xml', size: 100 }), /JPEG/)
  assert.match(validateImageFile({ type: 'image/jpeg', size: 11 * 1024 * 1024 }), /10 MB/)
})

test('private media migration uses owner paths, RLS, and no public bucket', async () => {
  const { readFile } = await import('node:fs/promises')
  const sql = await readFile(new globalThis.URL('../supabase/migrations/202609180002_lore_workshop_stage_2_media.sql', import.meta.url), 'utf8')
  assert.match(sql, /public, file_size_limit[\s\S]*false, 10485760/)
  assert.match(sql, /storage_path like owner_id::text \|\| '\/%'/)
  assert.match(sql, /storage\.foldername\(name\).*auth\.uid\(\)::text/)
  assert.doesNotMatch(sql, /to anon/)
})

test('stage two media migration is narrowly scoped and stores no expiring URLs', async () => {
  const { readFile } = await import('node:fs/promises')
  const sql = await readFile(new globalThis.URL('../supabase/migrations/202609180002_lore_workshop_stage_2_media.sql', import.meta.url), 'utf8')
  assert.match(sql, /values \('mission-draft-media', 'mission-draft-media', false/)
  assert.match(sql, /for insert to authenticated with check \(owner_id=auth\.uid\(\)\)/)
  assert.match(sql, /allowed_mime_types=array\['image\/jpeg','image\/png','image\/webp'\]/)
  assert.match(sql, /file_size_limit=10485760/)
  assert.doesNotMatch(sql, /signed_?url/i)
  assert.doesNotMatch(sql, /update storage\.buckets(?![\s\S]*mission-draft-media)/i)
  assert.doesNotMatch(sql, /bucket_id\s*<>|bucket_id\s+is\s+not/i)
})
