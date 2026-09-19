import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { URL } from 'node:url'
import { createScene, normalizeMediaPresentation, validateMediaFile } from '../src/workshop/model.js'
import { getWorldTokens } from '../src/workshop/worldTokens.js'

test('editor and test run share the one MissionStage renderer', () => {
  const editor=fs.readFileSync(new URL('../src/workshop/WorkshopApp.jsx',import.meta.url),'utf8')
  const run=fs.readFileSync(new URL('../src/workshop/TestRun.jsx',import.meta.url),'utf8')
  assert.match(editor,/import MissionStage/); assert.match(run,/import MissionStage/)
  assert.match(run,/createPortal/); assert.match(run,/data-testid="test-run-overlay"/)
  assert.doesNotMatch(run,/mission_session|createSession|startMission/)
})

test('stage contract is 16:9 and implements every structural scene type', () => {
  const css=fs.readFileSync(new URL('../src/styles.css',import.meta.url),'utf8')
  const renderer=fs.readFileSync(new URL('../src/workshop/MissionStage.jsx',import.meta.url),'utf8')
  assert.match(css,/\.mission-stage-frame[^}]*aspect-ratio:16\/9/)
  for (const type of ['narrative','assignment','transition']) assert.equal(createScene(0,type).scene_type,type)
  assert.match(renderer,/scene-kind-\$\{scene\.scene_type\}/)
})

test('Astra world tokens are centralized and media presentation is bounded', () => {
  const astra=getWorldTokens('astra'); assert.equal(astra.background,'#071827'); assert.equal(astra.accent,'#35d8f3')
  assert.deepEqual(normalizeMediaPresentation({positionX:22,zoom:1.5}),{fit:'cover',positionX:22,positionY:50,zoom:1.5,autoplay:false,loop:false,playback:'manual',muted:true})
  assert.deepEqual(normalizeMediaPresentation({positionX:-20,positionY:140,zoom:8,fit:'invalid'}),{fit:'cover',positionX:0,positionY:100,zoom:2,autoplay:false,loop:false,playback:'manual',muted:true})
})

test('all scene types receive three real grids, dark Astra cards and complete alignment styles', () => {
  const css=fs.readFileSync(new URL('../src/styles.css',import.meta.url),'utf8')
  for(const type of ['narrative','assignment','transition']) for(const layout of ['text','split','media']) assert.match(css,new RegExp(`scene-kind-${type}\\.scene-layout-${layout}`))
  assert.match(css,/scene-layout-text[^}]*2fr[^}]*1fr/)
  assert.match(css,/scene-layout-media[^}]*1fr[^}]*2\.15fr/)
  assert.doesNotMatch(css,/mission-stage\.scene-kind-assignment[^}]*#f8fbff/)
  for(const alignment of ['left','center','right']) assert.match(css,new RegExp(`text-align-${alignment}`))
})

test('focus metadata applies to image and video with fit, position, zoom and transform origin', () => {
  const renderer=fs.readFileSync(new URL('../src/workshop/MissionStage.jsx',import.meta.url),'utf8')
  for(const contract of ['objectFit','objectPosition','transformOrigin','scale','data-position-x','data-position-y','data-zoom']) assert.match(renderer,new RegExp(contract))
  assert.match(renderer,/video\?<Video/)
})

test('transition readiness reuses the existing content field and blocks navigation until ready', () => {
  const panel=fs.readFileSync(new URL('../src/workshop/PropertiesPanel.jsx',import.meta.url),'utf8')
  const run=fs.readFileSync(new URL('../src/workshop/TestRun.jsx',import.meta.url),'utf8')
  assert.match(panel,/Bereitschaft erforderlich/);assert.match(panel,/content\.readiness/)
  assert.match(run,/readinessRequired/);assert.match(run,/disabled=\{blocked\}/)
})

test('MP4 and WebM pass validation while unsafe and oversized media fail', () => {
  assert.equal(validateMediaFile({type:'video/mp4',size:100}),'')
  assert.equal(validateMediaFile({type:'video/webm',size:100}),'')
  assert.match(validateMediaFile({type:'video/quicktime',size:100}),/MP4- oder WebM/)
  assert.match(validateMediaFile({type:'video/mp4',size:101*1024*1024}),/100 MB/)
  assert.match(validateMediaFile({type:'image/png',size:11*1024*1024}),/10 MB/)
})

test('video migration keeps media private and scene data stores paths, never signed URLs', () => {
  const migration=fs.readFileSync(new URL('../supabase/migrations/202609180003_lore_workshop_shared_stage_video.sql',import.meta.url),'utf8')
  const storage=fs.readFileSync(new URL('../src/workshop/storage.js',import.meta.url),'utf8')
  assert.match(migration,/video\/mp4/); assert.match(migration,/video\/webm/)
  assert.match(storage,/\.insert\(\{ owner_id: userId, storage_path: path, file_name: file\.name, title, mime_type: file\.type, byte_size: file\.size \}\)/)
  assert.doesNotMatch(storage,/\.insert\(\{[^}]*url:/)
})
