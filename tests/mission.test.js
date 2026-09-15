import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { CALLSIGNS, createMissionRepository, missionErrorMessage, readyCount, STORY_SLUG } from '../src/mission.js'

function queryMock() {
 const calls=[];let operation='select';let payload;const query={select(){return query},eq(k,v){calls.push(['eq',k,v]);return query},neq(k,v){calls.push(['neq',k,v]);return query},order(){return query},insert(v){operation='insert';payload=v;return query},update(v){operation='update';payload=v;return query},single:async()=>({data:{id:operation==='insert'?'new-run':'s1',story_slug:STORY_SLUG,...payload},error:null}),then(resolve){return resolve({data:[],error:null})}}
 return {client:{from:t=>{calls.push(['from',t]);return query},channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:c=>calls.push(['remove',c])},calls}
}

test('uses exactly 30 unique child-friendly callsigns in deterministic order',()=>{assert.equal(CALLSIGNS.length,30);assert.equal(new Set(CALLSIGNS).size,30);assert.deepEqual([...CALLSIGNS].sort((a,b)=>a.localeCompare(b,'de')),CALLSIGNS)})
test('teacher creates each replay as a new server-coded session',async()=>{const mock=queryMock();const repo=createMissionRepository(mock.client,{id:'teacher'});const first=await repo.create('board');const second=await repo.create('board');assert.equal(first.id,'new-run');assert.equal(second.id,'new-run');assert.equal(mock.calls.filter(x=>x[0]==='from'&&x[1]==='mission_sessions').length,2);assert.ok(!('join_code' in first))})
test('readiness counts once and only for the current scene',()=>{assert.equal(readyCount([{status:'connected',ready_scene_id:'a'},{status:'disconnected',ready_scene_id:'a'},{status:'removed',ready_scene_id:'a'},{status:'connected',ready_scene_id:'old'}],'a'),2)})
test('mission errors are distinct and understandable',()=>{for(const code of ['INVALID_CODE','JOINING_CLOSED','CALLSIGN_TAKEN','INVALID_CALLSIGN','PARTICIPANT_REMOVED'])assert.notEqual(missionErrorMessage({message:code}),missionErrorMessage({message:'unknown'}))})
test('realtime cleanup removes its exact channel',()=>{const mock=queryMock();const cleanup=createMissionRepository(mock.client,{id:'teacher'}).subscribe('s1',()=>{},()=>{});cleanup();assert.equal(mock.calls.at(-1)[0],'remove')})
test('migration contains RLS, secure RPC grants, constraints, realtime, and server code generation',async()=>{const sql=await readFile(new globalThis.URL('../supabase/migrations/202609150001_story_mode_stage_1.sql',import.meta.url),'utf8');for(const fragment of ['enable row level security','security definer set search_path=\'\'','gen_random_bytes(6)','unique(session_id, auth_user_id)','mission_participants_active_callsign','PARTICIPANT_REMOVED','JOINING_CLOSED','CALLSIGN_TAKEN','alter publication supabase_realtime','revoke all on function'])assert.match(sql,new RegExp(fragment.replace(/[()]/g,'\\$&'),'i'))})
