import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { isStoryAvailableInWorld, stories, storyCategoryLabel, worldSwitchPlan } from '../src/data.js'
import { crewLabel, joinBlockedReason, readinessLabel } from '../src/mission.js'

test('world-bound and independent story categories enforce availability', () => {
  const astra = stories.find(story => story.id === 'notruf-aus-dem-all')
  const neutral = stories.find(story => story.id === 'moosarchiv')
  assert.equal(isStoryAvailableInWorld(astra, 'astra'), true)
  assert.equal(isStoryAvailableInWorld(astra, 'nebelmark'), false)
  for (const world of ['astra','nebelmark','aether','tiefsee']) assert.equal(isStoryAvailableInWorld(neutral, world), true)
  assert.equal(storyCategoryLabel(astra), 'Astra-Mission')
  assert.equal(storyCategoryLabel(neutral), 'Freie Mission')
  assert.ok(stories.filter(story => story.id !== astra.id).every(story => story.storyType === 'world_independent' && story.worldId === null))
})
test('world switch plans preserve free stories and replace incompatible bound stories only on apply', () => {
  const astra = stories.find(story => story.id === 'notruf-aus-dem-all')
  const moss = stories.find(story => story.id === 'moosarchiv')
  const fallback = worldSwitchPlan(astra, 'nebelmark')
  assert.equal(fallback.requiresFallback, true)
  assert.equal(fallback.story, moss)
  assert.equal(fallback.presentationWorldId, 'nebelmark')
  for (const worldId of ['astra','nebelmark','aether','tiefsee']) {
    const plan = worldSwitchPlan(moss, worldId)
    assert.equal(plan.story, moss)
    assert.equal(plan.requiresFallback, false)
    assert.equal(storyCategoryLabel(plan.story), 'Freie Mission')
    assert.equal(plan.presentationWorldId, worldId)
  }
})
test('join blocks expose concrete domain reasons and allow a free callsign', () => {
  const base={status:'lobby',joining_open:true,taken_callsigns:['Nova']}
  assert.equal(joinBlockedReason(base,'Cosmo'),'')
  assert.equal(joinBlockedReason({...base,status:'paused'},'Cosmo'),'')
  assert.match(joinBlockedReason({...base,joining_open:false},'Cosmo'),/Lehrkraft/)
  assert.match(joinBlockedReason(base,'Nova'),/bereits vergeben/)
  assert.match(joinBlockedReason({...base,status:'completed'},'Cosmo'),/beendet/)
  assert.match(joinBlockedReason({...base,participant_status:'removed'},'Cosmo'),/Gerät wurde/)
})
test('readiness is current-scene-only and never labels zero as complete', () => {
  const scene={id:'crew-check',readinessRequired:true}
  assert.equal(readinessLabel([{status:'connected',ready_scene_id:'old'}],scene),'0 von 1 bereit')
  assert.equal(readinessLabel([{status:'connected',ready_scene_id:'crew-check'}],scene),'Vollständig')
  assert.equal(readinessLabel([],scene),'Noch nicht begonnen')
  assert.equal(readinessLabel([], {id:'intro',readinessRequired:false}),null)
  assert.equal(crewLabel(1),'1 Crewmitglied')
})
test('world switch is preview-first and obsolete story notice is gone', async () => {
  const source=await readFile(new globalThis.URL('../src/App.jsx',import.meta.url),'utf8')
  const switcher=source.slice(source.indexOf('function WorldSwitcher'))
  assert.match(switcher,/previewWorld/)
  assert.match(switcher,/repository\.save/)
  assert.doesNotMatch(source,/Storymodus noch nicht angebunden/)
})
test('participant cleanup is teacher-only, heartbeat-bound and clears readiness', async () => {
  const sql=await readFile(new globalThis.URL('../supabase/migrations/202609160001_remove_disconnected_participants.sql',import.meta.url),'utf8')
  assert.match(sql,/is_mission_teacher/)
  assert.match(sql,/interval '70 seconds'/)
  assert.match(sql,/ready_scene_id=null/)
  assert.match(sql,/revoke all.*public,anon/is)
})
test('feedback archive and profile actions are honest and explicit', async () => {
  const mission=await readFile(new globalThis.URL('../src/MissionLobby.jsx',import.meta.url),'utf8')
  const app=await readFile(new globalThis.URL('../src/App.jsx',import.meta.url),'utf8')
  assert.match(mission,/Noch nicht verfügbar/)
  assert.match(app,/Kontomenü öffnen/)
  assert.match(app,/> Abmelden</)
})
test('Astra contrast tokens meet AA-oriented dark palette contract', async () => {
  const theme=await readFile(new globalThis.URL('../src/worldThemes.js',import.meta.url),'utf8')
  assert.match(theme,/text: '#f2f8fc'/)
  assert.match(theme,/muted: '#8ca9b9'/)
  const css=await readFile(new globalThis.URL('../src/styles.css',import.meta.url),'utf8')
  assert.match(css,/\.loreboard-mode\.world-astra[\s\S]*var\(--world-text\)/)
})

test('running mission keeps crew and access controls until final confirmation', async () => {
  const source=await readFile(new globalThis.URL('../src/MissionLobby.jsx',import.meta.url),'utf8')
  assert.match(source,/CrewManager compact/)
  assert.match(source,/person\.ready_scene_id === currentSceneId/)
  assert.match(source,/session\.joining_open\?'Zugang geöffnet':'Zugang geschlossen'/)
  assert.match(source,/session\.joining_open\?'close_joining':'open_joining'/)
  assert.match(source,/finished \? <button[\s\S]*Mission endgültig abschließen[\s\S]*CrewManager compact/)
})
