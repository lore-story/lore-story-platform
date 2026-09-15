import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { CALLSIGNS, createLiveController, createMissionRepository, isParticipantConnected, missionErrorMessage, PRESENCE_TIMEOUT_MS, readyCount } from '../src/mission.js'

function clientMock() {
  const calls = []
  const client = {
    rpc: async (name, args) => { calls.push(['rpc', name, args]); return { data: [{ id: `${name}-${calls.length}` }], error: null } },
    from: table => {
      const query = { select(columns) { calls.push(['select', table, columns]); return query }, eq() { return query }, order() { return query }, then(resolve) { return resolve({ data: [], error: null }) } }
      return query
    },
    channel: name => ({ name, on() { return this }, subscribe() { return this } }),
    removeChannel: channel => calls.push(['remove', channel.name]),
  }
  return { client, calls }
}

test('uses exactly 30 unique, sorted, child-friendly callsigns', () => {
  assert.equal(CALLSIGNS.length, 30)
  assert.equal(new Set(CALLSIGNS).size, 30)
  assert.deepEqual([...CALLSIGNS].sort((a, b) => a.localeCompare(b, 'de')), CALLSIGNS)
})
test('teacher creates every replay through the server RPC without supplying a code', async () => {
  const mock = clientMock(); const repo = createMissionRepository(mock.client)
  const first = await repo.create('board'); const second = await repo.create('board')
  assert.notEqual(first.id, second.id)
  assert.deepEqual(mock.calls.filter(call => call[1] === 'create_mission_session').map(call => call[2]), [{ p_loreboard_id: 'board' }, { p_loreboard_id: 'board' }])
})
test('repository requests no participant auth UUID and mutations use narrow RPCs', async () => {
  const mock = clientMock(); const repo = createMissionRepository(mock.client)
  await repo.participants('session'); await repo.remove('participant'); await repo.update('session', 'start')
  assert.doesNotMatch(mock.calls.find(call => call[0] === 'select')[2], /auth_user_id/)
  assert.ok(mock.calls.some(call => call[1] === 'remove_mission_participant'))
  assert.ok(mock.calls.some(call => call[1] === 'update_mission_session'))
})
test('presence expires after the documented timeout and readiness is scene-bound', () => {
  const now = Date.now(); const participant = { status: 'connected', last_seen_at: new Date(now - PRESENCE_TIMEOUT_MS - 1).toISOString() }
  assert.equal(isParticipantConnected(participant, now), false)
  assert.equal(readyCount([{ status: 'connected', ready_scene_id: 'a' }, { status: 'removed', ready_scene_id: 'a' }, { status: 'connected', ready_scene_id: 'old' }], 'a'), 1)
})
test('mission errors include completed and removal states', () => {
  for (const code of ['INVALID_CODE', 'JOINING_CLOSED', 'CALLSIGN_TAKEN', 'INVALID_CALLSIGN', 'PARTICIPANT_REMOVED', 'MISSION_COMPLETED']) assert.notEqual(missionErrorMessage({ message: code }), missionErrorMessage({ message: 'unknown' }))
})
test('realtime cleanup removes its exact channel', () => {
  const mock = clientMock(); const cleanup = createMissionRepository(mock.client).subscribe('s1', () => {}, () => {})
  cleanup(); assert.deepEqual(mock.calls.at(-1), ['remove', 'mission:s1'])
})
test('migration declares narrow RPC-only writes, completed guards and collision retries', async () => {
  const sql = await readFile(new globalThis.URL('../supabase/migrations/202609150001_story_mode_stage_1.sql', import.meta.url), 'utf8')
  for (const fragment of ["security definer set search_path=''", 'for attempt in 1..8 loop', 'OPEN_SESSION_EXISTS', "mission_status='completed'", 'MISSION_COMPLETED', 'own_participant_select', 'remove_mission_participant', 'grant select(id,session_id,callsign,status', 'loreboards_confirmed_teacher_insert', 'alter publication supabase_realtime']) assert.match(sql, new RegExp(fragment.replace(/[()]/g, '\\$&'), 'i'))
  assert.doesNotMatch(sql, /grant select,update on public\.mission_participants/i)
})

test('live controller clears heartbeat and channel exactly once on removal, completion or unmount', () => {
  for (const reason of ['removal', 'completion', 'unmount']) {
    const removed = []; const cleared = []; const controller = createLiveController(channel => removed.push(channel), timer => cleared.push(timer))
    controller.replace(`${reason}-channel`, `${reason}-timer`)
    controller.stop(); controller.stop()
    assert.deepEqual(removed, [`${reason}-channel`])
    assert.deepEqual(cleared, [`${reason}-timer`])
  }
})
test('replacing a live connection cleans only the old resources and retains the new pair', () => {
  const removed = []; const cleared = []; const controller = createLiveController(channel => removed.push(channel), timer => cleared.push(timer))
  controller.replace('old-channel', 'old-timer'); controller.replace('new-channel', 'new-timer')
  assert.deepEqual(removed, ['old-channel']); assert.deepEqual(cleared, ['old-timer'])
  controller.stop(); assert.deepEqual(removed, ['old-channel', 'new-channel']); assert.deepEqual(cleared, ['old-timer', 'new-timer'])
})
