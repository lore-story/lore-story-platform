import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { ASTRA_SCENES, MEMORY_PROMPTS, sceneById, sceneIndex } from '../src/astraMission.js'
import { getWorldTheme, themeVariables } from '../src/worldThemes.js'
import { createMissionRepository } from '../src/mission.js'

test('Astra is a complete configured world rather than component constants', () => {
  const astra = getWorldTheme('astra')
  for (const key of ['colors','typography','surfaces','symbols','media','terms','layouts']) assert.ok(astra[key])
  assert.equal(themeVariables(astra)['--world-orange'], astra.colors.orange)
  assert.equal(astra.terms.callsign, 'Rufzeichen')
})
test('Notruf aus dem All contains the eight ordered reference scenes and manual end', () => {
  assert.equal(ASTRA_SCENES.length, 8)
  assert.deepEqual(ASTRA_SCENES.map(x => x.id), ['ankunft','erinnerungssignal','crew-check','navigation','missionsarchiv','ausruestung','sicherheitscheck','startfreigabe'])
  assert.equal(sceneIndex('startfreigabe'), 7)
  assert.equal(sceneById('missing').id, 'ankunft')
  assert.equal(MEMORY_PROMPTS.length, 4)
})
test('teacher scene mutations use narrow RPCs and readiness reset is scene-bound', async () => {
  const calls=[]; const client={rpc:async(name,args)=>{calls.push([name,args]);return {data:[{current_scene_id:args.p_scene_id}],error:null}}}
  const repo=createMissionRepository(client)
  await repo.setScene('session','navigation'); await repo.resetReady('session','navigation')
  assert.deepEqual(calls,[['set_mission_scene',{p_session_id:'session',p_scene_id:'navigation'}],['reset_mission_readiness',{p_session_id:'session',p_scene_id:'navigation'}]])
})
test('stage 2 migration is additive, hardened and protects completed sessions', async () => {
  const sql=await readFile(new globalThis.URL('../supabase/migrations/202609150003_story_mode_stage_2.sql',import.meta.url),'utf8')
  for(const value of ['set_mission_scene','navigate_mission_scene','reset_mission_readiness','#variable_conflict error',"security definer set search_path=''","status='completed'",'MISSION_COMPLETED','revoke all on function']) assert.match(sql,new RegExp(value.replace(/[()]/g,'\\$&'),'i'))
  assert.doesNotMatch(sql,/grant\s+(?:insert|update|delete)\s+on\s+public\.mission_/i)
})
test('Astra media contract has loops per scene and one non-looping final slot', async () => {
  const source=await readFile(new globalThis.URL('../src/MissionLobby.jsx',import.meta.url),'utf8')
  assert.match(source,/loop=\{!launch\}/)
  const theme=await readFile(new globalThis.URL('../src/worldThemes.js',import.meta.url),'utf8')
  assert.match(theme,/launch-final\.mp4/)
  assert.match(source,/onError=.*setFailed\(true\)/)
})
