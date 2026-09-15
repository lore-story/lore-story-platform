import assert from 'node:assert/strict'
import chromiumBinary from '@sparticuz/chromium'
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173'
const backend = { version: 0, runs: [], participants: [], nextRun: 1, nextParticipant: 1, removals: {} }
const codeFor = number => `ASTR${String(number).padStart(3, '0')}`
function rpc(role, userId, name, args) {
  const fail = message => ({ data: null, error: { message } })
  if (name === 'create_mission_session') {
    if (role !== 'teacher') return fail('TEACHER_REQUIRED')
    if (backend.runs.some(run => run.status !== 'completed')) return fail('OPEN_SESSION_EXISTS')
    const now = new Date().toISOString(); const run = { id: `run-${backend.nextRun}`, story_slug: 'lore-astra-notruf-aus-dem-all', title: 'Notruf aus dem All', join_code: codeFor(backend.nextRun++), status: 'lobby', joining_open: true, current_scene_id: 'testszene', created_at: now, started_at: null, completed_at: null, updated_at: now }
    backend.runs.unshift(run); backend.version++; return { data: [run], error: null }
  }
  const run = backend.runs.find(item => item.id === args.p_session_id || item.join_code === args.p_code)
  if (name === 'inspect_mission') {
    if (!run) return fail('INVALID_CODE')
    const own = backend.participants.find(item => item.session_id === run.id && item.userId === userId)
    if (run.status === 'completed' && !own) return fail('MISSION_COMPLETED')
    return { data: [{ ...run, session_id: run.id, participant_id: own?.id || null, participant_status: own?.status || null, callsign: own?.callsign || null, ready_scene_id: own?.ready_scene_id || null, callsigns: ['Astrofuchs', 'Blitzbär', 'Cosmo'], taken_callsigns: backend.participants.filter(item => item.session_id === run.id && item.status !== 'removed').map(item => item.callsign) }], error: null }
  }
  if (name === 'join_mission') {
    if (!run) return fail('INVALID_CODE')
    const own = backend.participants.find(item => item.session_id === run.id && item.userId === userId)
    if (own?.status === 'removed') return fail('PARTICIPANT_REMOVED')
    if (run.status === 'completed') return fail('MISSION_COMPLETED')
    if (!own && !run.joining_open) return fail('JOINING_CLOSED')
    if (!own && backend.participants.some(item => item.session_id === run.id && item.status !== 'removed' && item.callsign === args.p_callsign)) return fail('CALLSIGN_TAKEN')
    const participant = own || { id: `participant-${backend.nextParticipant++}`, session_id: run.id, userId, callsign: args.p_callsign, status: 'connected', ready_scene_id: null, joined_at: new Date().toISOString(), removed_at: null }
    participant.status = 'connected'; participant.last_seen_at = new Date().toISOString(); if (!own) backend.participants.push(participant); backend.version++
    return { data: [{ ...run, session_id: run.id, participant_id: participant.id, callsign: participant.callsign, ready_scene_id: participant.ready_scene_id }], error: null }
  }
  if (name === 'update_mission_session') {
    if (!run || role !== 'teacher') return fail('MISSION_FORBIDDEN')
    if (run.status === 'completed') return fail('MISSION_COMPLETED')
    if (args.p_action === 'close_joining') run.joining_open = false
    if (args.p_action === 'open_joining') run.joining_open = true
    if (args.p_action === 'start') { run.status = 'active'; run.joining_open = false; run.started_at = new Date().toISOString() }
    if (args.p_action === 'complete') { run.status = 'completed'; run.joining_open = false; run.completed_at = new Date().toISOString() }
    backend.version++; return { data: [run], error: null }
  }
  if (name === 'remove_mission_participant') {
    const participant = backend.participants.find(item => item.id === args.p_participant_id)
    if (!participant || role !== 'teacher') return fail('PARTICIPANT_REMOVE_FORBIDDEN')
    participant.status = 'removed'; participant.removed_at = new Date().toISOString(); participant.ready_scene_id = null; backend.version++; return { data: null, error: null }
  }
  if (name === 'update_my_mission_presence') {
    const participant = backend.participants.find(item => item.session_id === args.p_session_id && item.userId === userId)
    if (run?.status === 'completed') return fail('MISSION_COMPLETED')
    if (!participant || participant.status === 'removed') return fail('PARTICIPANT_REMOVED')
    participant.status = args.p_connected ? 'connected' : 'disconnected'; participant.last_seen_at = new Date().toISOString()
    if (args.p_ready !== null) participant.ready_scene_id = args.p_ready ? run.current_scene_id : null
    backend.version++; return { data: null, error: null }
  }
  return fail('UNKNOWN')
}
async function install(context, role, userId) {
  await context.exposeFunction('__missionRpc', (name, args) => rpc(role, userId, name, args))
  await context.exposeFunction('__channelRemoved', () => { backend.removals[userId] = (backend.removals[userId] || 0) + 1 })
  await context.exposeFunction('__missionSnapshot', () => JSON.parse(JSON.stringify(backend)))
  await context.addInitScript(({ role, userId }) => {
    const listeners = new Set(); const teacher = { id: userId, email: 'teacher@example.test', is_anonymous: false, email_confirmed_at: '2026-01-01T00:00:00Z' }; const anonymous = { id: userId, is_anonymous: true }; let session = role === 'teacher' ? { user: teacher } : (localStorage.getItem('anonymous-session') ? { user: anonymous } : null)
    const makeQuery = table => { const filters = {}; let columns = ''; const q = { select(value) { columns = value; return q }, eq(key, value) { filters[key] = value; return q }, order() { return q }, then(resolve) { return window.__missionSnapshot().then(snapshot => { let data = table === 'mission_sessions' ? snapshot.runs : table === 'mission_participants' ? snapshot.participants : [{ id: 'board', state: {}, updated_at: new Date().toISOString() }]; data = data.filter(row => Object.entries(filters).every(([key, value]) => row[key] === value)); if (table === 'mission_participants') data = data.map(({ userId: ignored, ...row }) => row); resolve({ data, error: null, columns }) }) } }; return q }
    window.__LORE_SUPABASE__ = { auth: { getSession: async () => ({ data: { session }, error: null }), onAuthStateChange(callback) { listeners.add(callback); return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } } }, signInAnonymously: async () => { if (role === 'teacher') throw new Error('teacher session replaced'); session = { user: anonymous }; localStorage.setItem('anonymous-session', '1'); listeners.forEach(callback => callback('SIGNED_IN', session)); return { data: { session }, error: null } }, signOut: async () => ({ error: null }) }, rpc: (name, args) => window.__missionRpc(name, args), from: makeQuery, channel() { const handlers = []; let timer; let version = -1; return { on(event, filter, callback) { handlers.push({ filter, callback }); return this }, subscribe(callback) { callback('SUBSCRIBED'); timer = setInterval(async () => { const snapshot = await window.__missionSnapshot(); if (version >= 0 && snapshot.version !== version) handlers.forEach(({ filter, callback: handler }) => { const id = filter.filter?.split('eq.')[1]; const rows = filter.table === 'mission_sessions' ? snapshot.runs : snapshot.participants; const row = rows.find(item => item.id === id); if (row) handler({ new: row }) }); version = snapshot.version }, 100); this.__timer = timer; return this } } }, removeChannel(channel) { clearInterval(channel.__timer); window.__channelRemoved() } }
  }, { role, userId })
}
const browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const teacherContext = await browser.newContext(); const studentOneContext = await browser.newContext(); const studentTwoContext = await browser.newContext(); const newStudentContext = await browser.newContext()
await install(teacherContext, 'teacher', 'teacher'); await install(studentOneContext, 'student', 'student-1'); await install(studentTwoContext, 'student', 'student-2'); await install(newStudentContext, 'student', 'student-3')
try {
  const teacher = await teacherContext.newPage(); await teacher.goto(baseUrl); await teacher.evaluate(() => localStorage.setItem('lore-state', JSON.stringify({ view: 'mission', fundus: ['moosarchiv'], activeStory: 'moosarchiv', activeWorld: 'nebelmark' }))); await teacher.reload(); await teacher.getByRole('button', { name: 'Mission vorbereiten' }).click(); await teacher.getByText('ASTR001', { exact: true }).waitFor(); assert.equal(await teacher.getByRole('button', { name: 'Mission beginnen' }).isVisible(), true)
  const joinUrl = `${baseUrl}/join/ASTR001`; const studentOne = await studentOneContext.newPage(); await studentOne.goto(joinUrl); await studentOne.getByRole('button', { name: 'Astrofuchs', exact: true }).click(); await studentOne.getByRole('button', { name: /Mit Astrofuchs/ }).click(); await studentOne.getByText('Warte bitte').waitFor(); await teacher.locator('.crew-grid b').getByText('Astrofuchs', { exact: true }).waitFor()
  const studentTwo = await studentTwoContext.newPage(); await studentTwo.goto(joinUrl); assert.equal(await studentTwo.getByRole('button', { name: /Astrofuchs belegt/ }).isDisabled(), true); await studentTwo.getByRole('button', { name: 'Blitzbär', exact: true }).click(); await studentTwo.getByRole('button', { name: /Mit Blitzbär/ }).click(); await studentTwo.getByText('Warte bitte').waitFor(); await teacher.screenshot({ path: 'artifacts/mission-lobby-stage-1.png', fullPage: true })
  await teacher.getByRole('button', { name: 'Zugang schließen' }).click(); const newStudent = await newStudentContext.newPage(); await newStudent.goto(joinUrl); await newStudent.getByText('Zugang zu dieser Mission ist gerade geschlossen').waitFor()
  await studentOne.reload(); await studentOne.getByText('Warte bitte').waitFor(); teacher.once('dialog', dialog => dialog.accept()); await teacher.getByRole('button', { name: 'Mission beginnen' }).click()
  await studentOne.getByText('Missionssitzung ist aktiv').waitFor(); await studentOne.getByRole('button', { name: 'Ich bin bereit' }).click(); await teacher.getByText('1 von 2 bereit').waitFor()
  teacher.once('dialog', dialog => dialog.accept()); await teacher.getByRole('button', { name: 'Astrofuchs entfernen' }).click(); await studentOne.getByText('Du wurdest aus dieser Mission entfernt').waitFor(); await new Promise(resolve => setTimeout(resolve, 100)); assert.equal(backend.removals['student-1'], 1); await studentOne.reload(); await studentOne.getByText('Du wurdest aus dieser Mission entfernt').waitFor()
  teacher.once('dialog', dialog => dialog.accept()); await teacher.getByRole('button', { name: 'Mission abschließen' }).click(); await studentTwo.getByText('Mission ist abgeschlossen').waitFor(); await new Promise(resolve => setTimeout(resolve, 100)); assert.equal(backend.removals['student-2'], 1); assert.equal(rpc('student', 'student-2', 'update_my_mission_presence', { p_session_id: 'run-1', p_connected: true, p_ready: true }).error.message, 'MISSION_COMPLETED')
  await teacher.getByRole('button', { name: 'Mission erneut starten' }).click(); await teacher.getByText('ASTR002', { exact: true }).waitFor(); assert.equal(backend.runs.length, 2)
  const teacherJoin = await teacherContext.newPage(); await teacherJoin.goto(`${baseUrl}/join/ASTR002`); await teacherJoin.getByText('Dieser Browser ist als Lehrkraft angemeldet').waitFor(); assert.equal(await teacherJoin.evaluate(() => window.__LORE_SUPABASE__.auth.getSession().then(result => result.data.session.user.is_anonymous)), false)
  await studentTwo.goto(baseUrl); await studentTwo.getByText('Schülerzugang aktiv').waitFor(); assert.equal(await studentTwo.getByText('Deine Übersicht').count(), 0)
  await studentOne.close(); await new Promise(resolve => setTimeout(resolve, 50)); assert.ok(await studentOneContext.pages().length === 0)
  console.log('Mission E2E with isolated teacher/student contexts passed.')
} finally { await teacherContext.close(); await studentOneContext.close(); await studentTwoContext.close(); await newStudentContext.close(); await browser.close() }
